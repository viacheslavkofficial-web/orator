// Eight fixed debate topics, each with two opposite positions.
// The user picks one position; the opponent argues the other.

export const topics = [
  {
    id: "work-week",
    title: "Six-day vs five-day work week",
    positions: [
      { id: "six-day", label: "A six-day work week is better" },
      { id: "five-day", label: "A five-day work week is better" },
    ],
  },
  {
    id: "progressive-taxes",
    title: "Progressive taxes on the rich",
    positions: [
      { id: "for", label: "Progressive taxes on the rich are necessary" },
      { id: "against", label: "Progressive taxes on the rich are harmful" },
    ],
  },
  {
    id: "ai-education",
    title: "AI in education: benefit or harm",
    positions: [
      { id: "benefit", label: "AI in education is a benefit" },
      { id: "harm", label: "AI in education is a harm" },
    ],
  },
  {
    id: "athlete-salaries",
    title: "Top athletes' salaries: justified or excessive",
    positions: [
      { id: "justified", label: "Top athletes' salaries are justified" },
      { id: "excessive", label: "Top athletes' salaries are excessive" },
    ],
  },
  {
    id: "remote-work",
    title: "Remote work vs working from the office",
    positions: [
      { id: "remote", label: "Remote work is better" },
      { id: "office", label: "Working from the office is better" },
    ],
  },
  {
    id: "smartphones-schools",
    title: "Smartphones in schools: ban or allow",
    positions: [
      { id: "ban", label: "Smartphones should be banned in schools" },
      { id: "allow", label: "Smartphones should be allowed in schools" },
    ],
  },
  {
    id: "esports-olympics",
    title: "Esports in the Olympics: yes or no",
    positions: [
      { id: "yes", label: "Esports belong in the Olympics" },
      { id: "no", label: "Esports do not belong in the Olympics" },
    ],
  },
  {
    id: "space-exploration",
    title: "Space exploration: worth the money or not",
    positions: [
      { id: "worth", label: "Space exploration is worth the money" },
      { id: "not-worth", label: "Space exploration is not worth the money" },
    ],
  },
];

export function getTopic(topicId) {
  return topics.find((t) => t.id === topicId) || null;
}

export function getPosition(topic, positionId) {
  return topic.positions.find((p) => p.id === positionId) || null;
}

// The opponent always argues the position opposite to the user's.
export function opponentPosition(topic, positionId) {
  return topic.positions.find((p) => p.id !== positionId) || null;
}
