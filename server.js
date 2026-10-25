// Express server: serves public/, keeps the Z.ai key secret, exposes the API.

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { topics } from "./src/topics.js";
import { callJson, requireApiKey } from "./src/llm.js";
import {
  opponentPrompt,
  opponentSchema,
  judgePrompt,
  judgeSchema,
  verdictPrompt,
  verdictSchema,
  resolveLevel,
} from "./src/prompts.js";
import { isKnownTechnique } from "./src/techniques.js";

const MAX_EXCHANGES = 10;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Refuse to start without a key, with a message a human can act on.
try {
  requireApiKey();
} catch (err) {
  console.error("Cannot start: " + err.message);
  process.exit(1);
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/topics", (req, res) => {
  res.json(topics);
});

// The opponent may only log known techniques, and every logged quote must be
// an exact substring of its reply — otherwise the judge's ground truth is not
// checkable. "exposed" entries must quote the user's message. One retry, then
// a readable failure.
function opponentLogIsValid(result, reply, userMessage, level) {
  if (typeof result.reply !== "string" || !result.reply.trim()) return false;
  if (!Array.isArray(result.techniques)) return false;
  if (!Array.isArray(result.exposed ?? [])) return false;
  const allowed = new Set(level.allowed.map((n) => n.toLowerCase()));
  return (
    result.techniques.every(
      (t) =>
        t &&
        isKnownTechnique(t.name) &&
        allowed.has(String(t.name).toLowerCase()) &&
        typeof t.quote === "string" &&
        reply.includes(t.quote)
    ) &&
    (result.exposed ?? []).every(
      (t) =>
        t &&
        isKnownTechnique(t.name) &&
        typeof t.quote_from_user === "string" &&
        userMessage.includes(t.quote_from_user)
    )
  );
}

function judgeAnalysisIsValid(analysis, opponentLog, exposed, userMessage) {
  if (typeof analysis.whatWorked !== "string") return false;
  if (typeof analysis.assessment !== "string") return false;
  if (!Array.isArray(analysis.opponentTechniques)) return false;
  if (!Array.isArray(analysis.userTechniques)) return false;
  if (!Array.isArray(analysis.opponentExposed ?? [])) return false;
  const loggedNames = new Set(
    opponentLog.map((t) => t.name.toLowerCase())
  );
  const exposedNames = new Set((exposed ?? []).map((t) => t.name.toLowerCase()));
  return (
    analysis.opponentTechniques.every(
      (t) =>
        t &&
        isKnownTechnique(t.name) &&
        loggedNames.has(t.name.toLowerCase()) &&
        countSentences(t.effect) <= 1
    ) &&
    analysis.userTechniques.every(
      (t) =>
        t &&
        isKnownTechnique(t.name) &&
        (t.confidence === "clear" || t.confidence === "likely")
    ) &&
    (analysis.opponentExposed ?? []).every(
      (t) =>
        t &&
        isKnownTechnique(t.name) &&
        exposedNames.has(t.name.toLowerCase()) &&
        typeof t.effect === "string" &&
        countSentences(t.effect) <= 1 &&
        userMessage.includes(t.quote)
    ) &&
    countSentences(analysis.whatWorked) <= 3 &&
    countSentences(analysis.assessment) <= 3
  );
}

// Rough sentence count: a sentence ends with ., !, or ? followed by
// whitespace or the end of the text.
function countSentences(text) {
  return String(text ?? "")
    .split(/[.!?]+\s|[.!?]+$/)
    .filter((s) => s.trim()).length;
}

// Plain, human-readable messages for the page (spec.md > Important Failure
// Modes). The user's text stays in the input so they can resend.
function clientMessage(err) {
  if (err.status === 429) {
    return "The model is busy. Wait a minute and send again.";
  }
  if (err.status === 401 || err.status === 403) {
    return "The key was rejected. Check .env and restart the app.";
  }
  if (!err.status || err.status >= 500) {
    return "The judge lost the thread. Send again.";
  }
  return err.message || "Something went wrong. Send again.";
}

app.post("/api/turn", async (req, res) => {
  const { setup, history, message } = req.body ?? {};
  const level = resolveLevel(setup ?? {}, topics);
  if (
    !level ||
    typeof message !== "string" ||
    !message.trim() ||
    !Array.isArray(history) ||
    history.length > MAX_EXCHANGES
  ) {
    return res.status(400).json({ error: "Invalid debate turn request." });
  }
  if (history.length >= MAX_EXCHANGES) {
    return res
      .status(400)
      .json({ error: `The debate is over after ${MAX_EXCHANGES} exchanges.` });
  }
  try {
    const prompt = opponentPrompt({ setup, history, message, level });

    let result = null;
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      result = await callJson({
        system: prompt.system,
        input: prompt.input,
        schema: opponentSchema,
      });
      if (opponentLogIsValid(result, result.reply, message, level)) {
        lastError = null;
        break;
      }
      lastError = new Error(
        "The opponent's technique log did not check out against its reply."
      );
      lastError.status = 500;
    }
    if (lastError) throw lastError;

    const opponentLog = result.techniques;
    const exposed = result.exposed ?? [];
    const judge = judgePrompt({
      userMessage: message,
      reply: result.reply,
      opponentLog,
      exposed,
    });

    let analysis = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      analysis = await callJson({
        system: judge.system,
        input: judge.input,
        schema: judgeSchema,
      });
      if (judgeAnalysisIsValid(analysis, opponentLog, exposed, message)) {
        lastError = null;
        break;
      }
      lastError = new Error(
        "The judge's analysis did not match the opponent's technique log."
      );
      lastError.status = 500;
    }
    if (lastError) throw lastError;

    res.json({ reply: result.reply, opponentLog, analysis });
  } catch (err) {
    const status = err.status ?? 500;
    if (status >= 500) console.error("Turn failed:", err.message);
    res.status(status).json({ error: clientMessage(err) });
  }
});

// The opponent's full technique list is computed from its own logs — ground
// truth by construction — rather than asked from the model.
function countOpponentTechniques(history) {
  const counts = new Map();
  for (const entry of history ?? []) {
    for (const t of entry.opponentLog ?? []) {
      const name = String(t.name).toLowerCase();
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count }));
}

app.post("/api/verdict", async (req, res) => {
  const { setup, history } = req.body ?? {};
  const level = resolveLevel(setup ?? {}, topics);
  if (!level || !Array.isArray(history) || !history.length) {
    return res.status(400).json({ error: "Invalid verdict request." });
  }
  try {
    const prompt = verdictPrompt({ setup, level, history });
    let verdict = null;
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      verdict = await callJson({
        system: prompt.system,
        input: prompt.input,
        schema: verdictSchema,
      });
      const strongerOk = ["user", "opponent", "even"].includes(verdict.stronger);
      const brevityOk =
        countSentences(verdict.userSummary) <= 3 &&
        countSentences(verdict.opponentSummary) <= 3 &&
        countSentences(verdict.why) <= 3 &&
        countSentences(verdict.manipulation) <= 3;
      if (strongerOk && brevityOk) {
        lastError = null;
        break;
      }
      lastError = new Error("The verdict did not check out.");
      lastError.status = 500;
    }
    if (lastError) throw lastError;

    res.json({ ...verdict, opponentTechniqueList: countOpponentTechniques(history) });
  } catch (err) {
    const status = err.status ?? 500;
    if (status >= 500) console.error("Verdict failed:", err.message);
    res.status(status).json({ error: clientMessage(err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Rhetoric Sparring running at http://localhost:${PORT}`);
});
