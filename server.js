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

// Quote matching tolerates the small cosmetic differences models introduce:
// curly vs straight quotes, dashes, collapsed whitespace, and case. Only used
// for comparison — stored quotes stay verbatim.
function normalizeForQuoteMatch(text) {
  return String(text ?? "")
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u00A0\u2000-\u200B]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

function quoteMatches(quote, source) {
  return normalizeForQuoteMatch(source).includes(normalizeForQuoteMatch(quote));
}

// A "techniques" entry whose quote is really about the user's message — it
// names or rebuts a flaw in it ("your claim…", "to suggest we…") or simply
// quotes the user's own words back — is a call-out, not the opponent's own
// move. It gets moved to "exposed".
const CALLOUT_PATTERNS =
  /\b(your claim|your argument|your position|your logic|your framing|your wording|your side|your own words|your suggestion|you claim|you suggest|you argue|you admit|you imply|you are saying|are you saying|to suggest|so you want|you want us|dodging the question|that is a strawman|that cherry-pick)\b/i;

function quoteDescribesUserMessage(quote, userMessage) {
  const text = String(quote ?? "");
  return CALLOUT_PATTERNS.test(text) || quoteMatches(text, userMessage);
}

// The opponent may only log known, level-allowed techniques, and every logged
// quote must match its reply (after normalization). Entries that are actually
// call-outs of the user's message are MOVED to "exposed"; anything else that
// still does not match is DROPPED rather than failing the whole turn — the
// judge's ground truth stays checkable.
function sanitizeOpponentResult(result, reply, userMessage, level) {
  const allowed = new Set(level.allowed.map((n) => n.toLowerCase()));
  const techniques = [];
  const movedToExposed = [];
  for (const t of Array.isArray(result.techniques) ? result.techniques : []) {
    if (!t || !isKnownTechnique(t.name) || typeof t.quote !== "string") continue;
    if (quoteDescribesUserMessage(t.quote, userMessage)) {
      movedToExposed.push({ name: t.name, quote_from_user: t.quote, moved: true });
      continue;
    }
    if (
      allowed.has(String(t.name).toLowerCase()) &&
      quoteMatches(t.quote, reply)
    ) {
      techniques.push({ name: t.name, quote: t.quote });
    }
  }
  const exposed = movedToExposed.concat(
    (Array.isArray(result.exposed) ? result.exposed : []).filter(
      (t) =>
        t &&
        isKnownTechnique(t.name) &&
        typeof t.quote_from_user === "string" &&
        (quoteMatches(t.quote_from_user, userMessage) || t.moved === true)
    )
  );
  return { techniques, exposed };
}

// Same contract for the judge: entries naming a technique that is not in the
// (sanitized) log, or quoting a phrase that is not in the source, are dropped;
// only failures of the top-level fields or brevity still reject the turn.
function sanitizeJudgeAnalysis(analysis, opponentLog, exposed, reply, userMessage) {
  const loggedNames = new Set(opponentLog.map((t) => t.name.toLowerCase()));
  const exposedNames = new Set(exposed.map((t) => t.name.toLowerCase()));
  return {
    opponentTechniques: analysis.opponentTechniques.filter(
      (t) =>
        t &&
        isKnownTechnique(t.name) &&
        loggedNames.has(t.name.toLowerCase()) &&
        typeof t.effect === "string" &&
        countSentences(t.effect) <= 1 &&
        quoteMatches(t.quote, reply)
    ),
    userTechniques: analysis.userTechniques.filter(
      (t) =>
        t &&
        isKnownTechnique(t.name) &&
        (t.confidence === "clear" || t.confidence === "likely") &&
        quoteMatches(t.quote, userMessage)
    ),
    opponentExposed: analysis.opponentExposed.filter(
      (t) =>
        t &&
        isKnownTechnique(t.name) &&
        exposedNames.has(t.name.toLowerCase()) &&
        typeof t.effect === "string" &&
        countSentences(t.effect) <= 1 &&
        quoteMatches(t.quote, userMessage)
    ),
  };
}

function judgeTopLevelIsValid(analysis) {
  return (
    typeof analysis.whatWorked === "string" &&
    typeof analysis.assessment === "string" &&
    Array.isArray(analysis.opponentTechniques) &&
    Array.isArray(analysis.userTechniques) &&
    Array.isArray(analysis.opponentExposed ?? []) &&
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
      if (typeof result.reply === "string" && result.reply.trim()) {
        lastError = null;
        break;
      }
      lastError = new Error("The model returned an empty reply.");
      lastError.status = 500;
    }
    if (lastError) throw lastError;

    // Log entries whose quotes do not match (after normalization) are dropped,
    // not retried — the reply itself is the debate's substance.
    const sanitized = sanitizeOpponentResult(result, result.reply, message, level);
    const opponentLog = sanitized.techniques;
    const exposed = sanitized.exposed;
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
      if (judgeTopLevelIsValid(analysis)) {
        analysis = {
          ...analysis,
          ...sanitizeJudgeAnalysis(analysis, opponentLog, exposed, result.reply, message),
        };
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
  console.log(`Orator running at http://localhost:${PORT}`);
});
