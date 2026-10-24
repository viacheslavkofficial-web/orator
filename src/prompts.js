// The role prompts and the JSON shapes they must return.
// The opponent and the judge are the same model with different instructions;
// the judge reads the opponent's techniques from the opponent's own log.

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
    `Return JSON only, in exactly this shape:`,
    `{"reply": "<your reply>", "techniques": [{"name": "<technique name>", "quote": "<exact phrase from your reply>"}]}`,
    `The "techniques" array lists the rhetorical techniques you deliberately used in this reply. Every "quote" must be copied word-for-word from your reply. If you used none, return an empty array.`,
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

// The resolved level (topic + position + persona) is assembled here so
// server.js stays thin. Slice 3 replaces the fixed Friendly persona with
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

export const opponentSchema = { required: ["reply", "techniques"] };
