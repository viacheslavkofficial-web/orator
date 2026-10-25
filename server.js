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
  resolveLevel,
} from "./src/prompts.js";
import { isKnownTechnique } from "./src/techniques.js";

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
function opponentLogIsValid(result, reply, userMessage) {
  if (typeof result.reply !== "string" || !result.reply.trim()) return false;
  if (!Array.isArray(result.techniques)) return false;
  if (!Array.isArray(result.exposed ?? [])) return false;
  return (
    result.techniques.every(
      (t) =>
        t &&
        isKnownTechnique(t.name) &&
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

app.post("/api/turn", async (req, res) => {
  const { setup, history, message } = req.body ?? {};
  const level = resolveLevel(setup ?? {}, topics);
  if (!level || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Invalid debate turn request." });
  }
  try {
    const prompt = opponentPrompt({ setup, history: history ?? [], message, level });

    let result = null;
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      result = await callJson({
        system: prompt.system,
        input: prompt.input,
        schema: opponentSchema,
      });
      if (opponentLogIsValid(result, result.reply, message)) {
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
    res.status(status).json({ error: err.message || "The model call failed." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Rhetoric Sparring running at http://localhost:${PORT}`);
});
