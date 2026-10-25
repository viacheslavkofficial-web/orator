// The three role prompts and the JSON shapes they must return.
// The opponent and the judge are the same model with different instructions;
// the judge reads the opponent's techniques from the opponent's own log.

import { techniques } from "./techniques.js";
import { getLevel } from "./levels.js";

const techniqueListText = techniques
  .map((t) => `- "${t.name}" (${t.flag}): ${t.definition}`)
  .join("\n");

// --- Opponent -------------------------------------------------------------

function opponentSystemPrompt({ topic, position, level }) {
  const allowedText = level.allowed
    .map((name) => `- "${name}"`)
    .join("\n");
  return [
    `You are the opponent in a formal practice debate, playing a single role. You argue ${position.label.toLowerCase()} — the position opposite to the user's.`,
    `Topic: ${topic.title}.`,
    level.persona,
    `Rules:`,
    `- Reply in English only.`,
    `- Directly address the user's actual argument. Never give a generic speech.`,
    `- Keep the reply to a few sentences (2–5).`,
    `- If the user's message is off-topic, one-word, or rude, say briefly that this dilutes the topic and invite them back to the argument; stay in role.`,
    `- You must never break character or mention being an AI.`,
    ``,
    `With your reply, log which rhetorical techniques you used. At this level you may ONLY use and log these techniques:`,
    allowedText,
    ``,
    `Return JSON only, in exactly this shape:`,
    `{"reply": "<your reply>", "techniques": [{"name": "<technique name from the allowed list>", "quote": "<exact phrase from your reply>"}], "exposed": [{"name": "<technique name from the list>", "quote_from_user": "<exact phrase from the user's message>"}]}`,
    `The "techniques" array lists ONLY the rhetorical techniques YOU yourself used in your own reply — never a technique you exposed in the user's message. If you merely named or called out a technique in the user's message, that belongs in "exposed", not in "techniques"; never list the same occurrence in both. Every "quote" must be copied word-for-word from your reply. If you used none, return an empty array.`,
    `The "exposed" array lists ONLY weak or manipulative moves in the USER's message that you explicitly called out as flawed in your reply (for example a strawman or false dilemma you named and rejected). Merely acknowledging, granting, or agreeing with the user's point — however politely — is NOT exposing it and must NOT be listed here. Every "quote_from_user" must be copied word-for-word from the user's message. If you called out none of the user's moves, return an empty array.`,
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
  const system = opponentSystemPrompt({ topic: level.topic, position: level.position, level });
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

// The resolved level (topic + opponent position + persona + allowed
// techniques) is assembled here so server.js stays thin.
export function resolveLevel(setup, topics) {
  const topic = topics.find((t) => t.id === setup.topicId);
  if (!topic) return null;
  const position = topic.positions.find((p) => p.id !== setup.positionId);
  if (!position) return null;
  const level = getLevel(setup.level);
  if (!level) return null;
  return { ...level, topic, position };
}

// --- Judge (per exchange) ---------------------------------------------------

function judgeSystemPrompt() {
  return [
    `You are a neutral judge of a practice debate exchange. You are not a participant.`,
    `Work in this order: FIRST analyze the user's message on its own merits and label its techniques yourself; only afterwards read the opponent's log and exposed list for the opponent-side sections.`,
    `You receive: the user's message, the opponent's reply, the opponent's own technique log, and the opponent's list of user moves it exposed.`,
    `The log and exposed list are ground truth for the OPPONENT-side sections only. Never copy a label from them into your analysis of the user: if your independent reading of the user's message differs from the exposed list, keep your own reading. And remember: a move the opponent merely acknowledged or conceded is not "exposed".`,
    `A single phrase can carry several labels — the same sentence may be both "analogy" and "strawman". Give each label its own entry.`,
    `For the user's side, infer which techniques from the list they used or seem to have used, and mark each as "clear" or "likely". When the user cites a source, organization, study, or expert, consider "appeal to authority" (relevant and credible) or "false authority" (irrelevant or vague) rather than lumping it into "evidence and examples".`,
    `Use ONLY technique names from this fixed list:`,
    techniqueListText,
    ``,
    `If the user was rude or off-topic, say plainly that in front of an audience this would look ridiculous.`,
    `Write in English. Be concrete and fair; no numeric scores.`,
    `Keep it short: every technique's "effect" is at most ONE sentence; "whatWorked" and "assessment" are at most THREE sentences each.`,
    ``,
    `Return JSON only, in exactly this shape:`,
    `{"opponentTechniques": [{"name": "<technique>", "quote": "<phrase from the opponent's reply>", "effect": "<one sentence>"}], "userTechniques": [{"name": "<technique>", "quote": "<phrase from the user's message>", "confidence": "clear"}], "opponentExposed": [{"name": "<technique>", "quote": "<phrase from the user's message>", "effect": "<one sentence>"}], "whatWorked": "<at most three sentences>", "assessment": "<at most three sentences>"}`,
    `The userTechniques confidence is "clear" or "likely". All five top-level fields are required; the arrays may be empty. "opponentExposed" mirrors the opponent's exposed list — include an entry for every exposed technique, quoting the user's message. Remember: exposed means explicitly called out as flawed, never merely acknowledged.`,
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

// --- Judge (final verdict) ---------------------------------------------------

function verdictSystemPrompt() {
  return [
    `You are a neutral judge giving the final verdict of a formal practice debate. You are not a participant.`,
    `You receive the full debate history. For every exchange it includes the opponent's own technique log — treat those logs as ground truth: the opponent really used those techniques in those phrases. It also includes the user-side technique labels the exchange analyses found — treat those the same way: the user really made those moves.`,
    `Your verdict must name: how each side argued, who was stronger and more convincing and why, and who manipulated (either side, both, or neither) — with examples.`,
    `Hold both sides to the same standard: if the exchange analyses identified manipulative moves by the user (a strawman, a false dilemma, and so on), name them in "manipulation" and weigh them in "stronger" and "why". Never praise a move the exchange analyses identified as manipulative as the user's strongest or most effective argument.`,
    `Use ONLY technique names from this fixed list when naming techniques:`,
    techniqueListText,
    ``,
    `Write in English. Be concrete and fair; no numeric scores, a verbal verdict only.`,
    `Keep it short: "userSummary", "opponentSummary", "why" and "manipulation" are at most THREE sentences each.`,
    ``,
    `Return JSON only, in exactly this shape:`,
    `{"userSummary": "<how the user argued, addressed to them directly in the second person ('You argued…') — never by name, at most three sentences>", "opponentSummary": "<how the opponent argued, at most three sentences>", "stronger": "user", "why": "<at most three sentences>", "manipulation": "<who manipulated and how, at most three sentences>"}`,
    `"stronger" must be exactly one of "user", "opponent" or "even". The opponent's full technique list with counts is computed from the logs and will be added to the verdict; do not include it yourself.`,
  ].join("\n");
}

function buildVerdictHistory(history) {
  if (!history.length) return "The debate had no exchanges.";
  return history
    .map((h, i) => {
      const log = h.opponentLog?.length
        ? h.opponentLog.map((t) => `"${t.name}": "${t.quote}"`).join("; ")
        : "no techniques logged";
      const userLabels = h.analysis?.userTechniques?.length
        ? h.analysis.userTechniques
            .map((t) => `"${t.name}" (${t.confidence}): "${t.quote}"`)
            .join("; ")
        : "none recorded";
      return [
        `Exchange ${i + 1}:`,
        `User: ${h.user}`,
        `Opponent: ${h.reply}`,
        `Opponent's own log for this exchange (ground truth): ${log}`,
        `User-side labels from the exchange analysis (ground truth): ${userLabels}`,
      ].join("\n");
    })
    .join("\n\n");
}

export function verdictPrompt({ setup, level, history }) {
  const system = verdictSystemPrompt();
  const input = [
    `The debater is called ${setup.name} and argued: ${level.position.label}`,
    `The opponent (you are judging the debate, not participating) argued: ${level.topic.positions.find((p) => p.id !== setup.positionId)?.label ?? "the opposite position"}`,
    `Topic: ${level.topic.title}. Opponent level: ${level.label}.`,
    ``,
    `Full debate history with the opponent's logs:`,
    buildVerdictHistory(history),
  ].join("\n");
  return { system, input };
}

export const verdictSchema = {
  required: ["userSummary", "opponentSummary", "stronger", "why", "manipulation"],
};
