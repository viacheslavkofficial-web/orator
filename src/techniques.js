// The fixed technique vocabulary. The opponent may only log techniques from
// this list; the judge uses the same list for the user's side.

export const techniques = [
  // Legitimate
  {
    name: "evidence and examples",
    flag: "legitimate",
    definition: "Supports the claim with facts, data, or concrete cases.",
  },
  {
    name: "concession and pivot",
    flag: "legitimate",
    definition: "Grants a valid point, then shows it does not decide the question.",
  },
  {
    name: "reframing",
    flag: "legitimate",
    definition: "Moves the discussion to a framing where the argument is stronger.",
  },
  {
    name: "analogy",
    flag: "legitimate",
    definition: "Compares the situation to a similar, better-understood one.",
  },
  {
    name: "rhetorical question",
    flag: "legitimate",
    definition: "Asks a question to lead the listener to the intended conclusion.",
  },
  {
    name: "appeal to shared values",
    flag: "legitimate",
    definition: "Grounds the argument in values both sides accept.",
  },
  // Manipulative
  {
    name: "strawman",
    flag: "manipulative",
    definition: "Distorts the opponent's argument and then attacks the distortion.",
  },
  {
    name: "false dilemma",
    flag: "manipulative",
    definition: "Presents only two options when more exist.",
  },
  {
    name: "slippery slope",
    flag: "manipulative",
    definition: "Claims one step will inevitably lead to extreme consequences.",
  },
  {
    name: "red herring / whataboutism",
    flag: "manipulative",
    definition: "Redirects to a different issue instead of answering the point.",
  },
  {
    name: "appeal to emotion",
    flag: "manipulative",
    definition: "Substitutes fear, pity, or anger for an argument.",
  },
  {
    name: "appeal to the crowd (demagoguery)",
    flag: "manipulative",
    definition: "Claims everyone already agrees, so the opponent looks isolated.",
  },
  {
    name: "loaded question",
    flag: "manipulative",
    definition: "Asks a question that presumes something unproven.",
  },
  {
    name: "cherry-picking",
    flag: "manipulative",
    definition: "Selects only the facts that support the claim.",
  },
  {
    name: "moving the goalposts",
    flag: "manipulative",
    definition: "Raises the bar for proof every time it is met.",
  },
  {
    name: "quibbling over wording",
    flag: "manipulative",
    definition: "Attacks the phrasing instead of engaging the substance.",
  },
  {
    name: "turning the speaker's words against them",
    flag: "manipulative",
    definition: "Reuses the opponent's own statement as a weapon, out of context.",
  },
  {
    name: "ad hominem",
    flag: "manipulative",
    definition: "Attacks the speaker instead of the argument.",
  },
];

const byName = new Map(techniques.map((t) => [t.name.toLowerCase(), t]));

export function isKnownTechnique(name) {
  return byName.has(String(name).toLowerCase());
}

export function techniqueDefinition(name) {
  return byName.get(String(name).toLowerCase())?.definition ?? "";
}

export function techniqueFlag(name) {
  return byName.get(String(name).toLowerCase())?.flag ?? "";
}
