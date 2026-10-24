// Express server: serves public/, keeps the key secret, exposes the API.

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { topics } from "./src/topics.js";
import { callJson, requireApiKey } from "./src/llm.js";
import { opponentPrompt, opponentSchema, resolveLevel } from "./src/prompts.js";

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

app.post("/api/turn", async (req, res) => {
  const { setup, history, message } = req.body ?? {};
  const level = resolveLevel(setup ?? {}, topics);
  if (!level || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Invalid debate turn request." });
  }
  try {
    const prompt = opponentPrompt({ setup, history: history ?? [], message, level });
    const result = await callJson({
      system: prompt.system,
      input: prompt.input,
      schema: opponentSchema,
    });
    res.json({ reply: result.reply, opponentLog: result.techniques ?? [] });
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
