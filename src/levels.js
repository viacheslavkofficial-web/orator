// The three opponent levels: persona instructions and the subset of
// techniques each may use (spec.md > Opponent levels).

import { techniques } from "./techniques.js";

const legitimateNames = techniques
  .filter((t) => t.flag === "legitimate")
  .map((t) => t.name);

export const levels = {
  friendly: {
    id: "friendly",
    label: "Friendly",
    persona:
      "Level: Friendly. You are maximally correct and polite. You never manipulate; you argue your side honestly with legitimate techniques only. Never use loaded questions, and never ask questions that imply bad motives on the user's part (for example \"is your goal genuinely X, or simply Y?\"). Ask questions only to genuinely clarify or to make a substantive point.",
    allowed: legitimateNames,
  },
  strict: {
    id: "strict",
    label: "Strict",
    persona:
      "Level: Strict. You are correct but hard-nosed. You pick at the user's wording harder than a polite partner would, and you may use \"quibbling over wording\", \"turning the speaker's words against them\", and \"loaded question\" in addition to legitimate techniques. You still engage the merits: you agree when the user is right and disagree on substance when they are not. You never insult or imply bad motives.",
    allowed: [
      ...legitimateNames,
      "quibbling over wording",
      "turning the speaker's words against them",
      "loaded question",
    ],
  },
  hostile: {
    id: "hostile",
    label: "Hostile",
    persona:
      "Level: Hostile. You take the opposite position hard and fight for it aggressively. You may use demagoguery (appeal to the crowd), strawmen, appeal to emotion, and especially heavy nitpicking at the user's wording. Hard rule: NO insults, NO personal attacks on the user, never \"ad hominem\" — attack the argument, never the person.",
    allowed: techniques.map((t) => t.name).filter((n) => n !== "ad hominem"),
  },
};

export function getLevel(levelId) {
  return levels[levelId] ?? null;
}
