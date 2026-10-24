// The three role prompts and the JSON shapes they must return.
// The opponent and the judge are the same model with different instructions;
// the judge reads the opponent's techniques from the opponent's own log.

import { techniques } from "./techniques.js";

const techniqueListText = techniques
  .map((t) => `- "${t.name}" (${t.flag}): ${t.definition}`)
  .join("\n");

// --- Opponent -------------------------------------------------------------

function opponentSystemPrompt({ topic, position, levelPersona }) {
  return [
    `You are the opponent in a formal practice debate, playing a single role. You argue ${position.label.toLowerCase()} — the position opposite to the user's.`,
    `Topic: ${topic.title}.`,
    levelPersona,
    `Rules:`,
    `- Reply in English only.`,
    `- Directly address the user's actual argument. Never give a generic speech.`,
    `- Keep the reply to a few sentences (2–5).`,
    `- If the user's message is off-topic, one-word, or rude, say briefly that this dilutes the topic and invite them back to the argument; stay in role.`,
    `- You must never break character or mention being an AI.`,
    ``,
    `With your reply, log which rhetorical techniques you deliberately used. Choose ONLY from this fixed list:`,
    techniqueListText,
    ``,
    `Return JSON only, in exactly this shape:`,
    `{"reply": "<your reply>", "techniques": [{"name": "<technique name from the list>", "quote": "<exact phrase from your reply>"}]}`,
    `Every "quote" must be copied word-for-word from your reply. If you used none, return an empty array.`,
  ].join("\n");
}

function buildHistoryText(history) {
  if (!history.length) return "This is the opening message of the debate.";
  return history
    .map(
      (h, i) =>
        `Exchange ${i + 1}:\nUser: ${h.user}\nOpponent: ${h.reply}`
    )
    .join("\n\n");
}

export function opponentPrompt({ setup, history, message, level }) {
  const { topic, position, persona } = level; // resolved by the caller
  const system = opponentSystemPrompt({
    topic,
    position,
    levelPersona: persona,
  });
  const input = [
    `The debater you are arguing against is called ${setup.name}.`,
    ``,
    `Debate so far:`,
    buildHistoryText(history),
    ``,
    `${setup.name}'s new message: ${message}`,
  ].join("\n");
  return { system, input };
}

export const opponentSchema = { required: ["reply", "techniques"] };

// The resolved level (topic + opponent position + persona) is assembled here
// so server.js stays thin. Slice 3 replaces the fixed Friendly persona with
// src/levels.js.
export function resolveLevel(setup, topics) {
  const topic = topics.find((t) => t.id === setup.topicId);
  if (!topic) return null;
  const position = topic.positions.find((p) => p.id !== setup.positionId);
  if (!position) return null;
  return {
    topic,
    position,
    persona:
      "Level: Friendly. You are maximally correct and polite. You never manipulate; you argue your side honestly with legitimate techniques only.",
  };
}

// --- Judge (per exchange) ---------------------------------------------------

function judgeSystemPrompt() {
  return [
    `You are a neutral judge of a practice debate exchange. You are not a participant.`,
    `You receive: the user's message, the opponent's reply, and the opponent's own technique log.`,
    `Treat the opponent's log as ground truth: the opponent really used those techniques in those phrases. Base every statement about the opponent on the log and quote the logged phrases.`,
    `For the user's side, infer which techniques from the list they used or seem to have used, and mark each as "clear" or "likely".`,
    `Use ONLY technique names from this fixed list:`,
    techniqueListText,
    ``,
    `If the user was rude or off-topic, say plainly that in front of an audience this would look ridiculous.`,
    `Write in English. Be concrete and fair; no numeric scores.`,
    ``,
    `Return JSON only, in exactly this shape:`,
    `{"opponentTechniques": [{"name": "<technique>", "quote": "<phrase from the opponent's reply>", "effect": "<what the technique did in the argument>"}], "userTechniques": [{"name": "<technique>", "quote": "<phrase from the user's message>", "confidence": "clear"}], "whatWorked": "<what worked and what did not, for both sides>", "assessment": "<short assessment of the exchange>"}`,
    `The userTechniques confidence is "clear" or "likely". All four top-level fields are required; the arrays may be empty.`,
  ].join("\n");
}

export function judgePrompt({ userMessage, reply, opponentLog }) {
  const system = judgeSystemPrompt();
  const input = [
    `User's message: ${userMessage}`,
    ``,
    `Opponent's reply: ${reply}`,
    ``,
    `Opponent's own technique log (ground truth):`,
    opponentLog.length
      ? opponentLog
          .map((t) => `- "${t.name}" in the phrase: "${t.quote}"`)
          .join("\n")
      : "(empty — the opponent logged no techniques)",
  ].join("\n");
  return { system, input };
}

export const judgeSchema = {
  required: ["opponentTechniques", "userTechniques", "whatWorked", "assessment"],
};
