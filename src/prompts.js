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
    `With your reply, log which rhetorical techniques you used. Choose ONLY from this fixed list:`,
    techniqueListText,
    ``,
    `Return JSON only, in exactly this shape:`,
    `{"reply": "<your reply>", "techniques": [{"name": "<technique name from the list>", "quote": "<exact phrase from your reply>"}], "exposed": [{"name": "<technique name from the list>", "quote_from_user": "<exact phrase from the user's message>"}]}`,
    `The "techniques" array lists ONLY the rhetorical techniques YOU yourself used in your own reply — never a technique you exposed in the user's message. If you merely named or called out a technique in the user's message, that belongs in "exposed", not in "techniques"; never list the same occurrence in both. Every "quote" must be copied word-for-word from your reply. If you used none, return an empty array.`,
    `The "exposed" array lists techniques you caught in the USER's message (for example a strawman or false dilemma you called out). Every "quote_from_user" must be copied word-for-word from the user's message. Whenever you call out a technique in the user's message, you MUST list it here. If you exposed none, return an empty array.`,
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
      "Level: Friendly. You are maximally correct and polite. You never manipulate; you argue your side honestly with legitimate techniques only. Never use loaded questions, and never ask questions that imply bad motives on the user's part (for example \"is your goal genuinely X, or simply Y?\"). Ask questions only to genuinely clarify or to make a substantive point.",
  };
}

// --- Judge (per exchange) ---------------------------------------------------

function judgeSystemPrompt() {
  return [
    `You are a neutral judge of a practice debate exchange. You are not a participant.`,
    `You receive: the user's message, the opponent's reply, the opponent's own technique log, and the opponent's list of techniques it exposed in the user's message.`,
    `Treat the opponent's log and exposed list as ground truth: the opponent really used and really exposed those techniques in those phrases. Base every statement about the opponent on them and quote those phrases.`,
    `For the user's side, infer which techniques from the list they used or seem to have used, and mark each as "clear" or "likely".`,
    `Use ONLY technique names from this fixed list:`,
    techniqueListText,
    ``,
    `If the user was rude or off-topic, say plainly that in front of an audience this would look ridiculous.`,
    `Write in English. Be concrete and fair; no numeric scores.`,
    `Keep it short: every technique's "effect" is at most ONE sentence; "whatWorked" and "assessment" are at most THREE sentences each.`,
    ``,
    `Return JSON only, in exactly this shape:`,
    `{"opponentTechniques": [{"name": "<technique>", "quote": "<phrase from the opponent's reply>", "effect": "<one sentence>"}], "userTechniques": [{"name": "<technique>", "quote": "<phrase from the user's message>", "confidence": "clear"}], "opponentExposed": [{"name": "<technique>", "quote": "<phrase from the user's message>", "effect": "<one sentence>"}], "whatWorked": "<at most three sentences>", "assessment": "<at most three sentences>"}`,
    `The userTechniques confidence is "clear" or "likely". All five top-level fields are required; the arrays may be empty. "opponentExposed" mirrors the opponent's exposed list — include an entry for every exposed technique, quoting the user's message.`,
  ].join("\n");
}

export function judgePrompt({ userMessage, reply, opponentLog, exposed }) {
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
    ``,
    `Techniques the opponent exposed in the user's message (ground truth):`,
    exposed?.length
      ? exposed
          .map((t) => `- "${t.name}" in the phrase: "${t.quote_from_user}"`)
          .join("\n")
      : "(empty — the opponent exposed nothing)",
  ].join("\n");
  return { system, input };
}

export const judgeSchema = {
  required: [
    "opponentTechniques",
    "userTechniques",
    "opponentExposed",
    "whatWorked",
    "assessment",
  ],
};
