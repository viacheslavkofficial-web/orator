---
doc: scope
status: approved
---

# Orator

A debate sparring app: you argue a topic against an AI opponent, while a neutral AI judge analyzes every exchange and tells you who used which rhetorical technique, who manipulated, and who was more convincing.

## The Unique Kernel
One model plays two roles at once: the opponent and a neutral judge. The judge knows exactly which techniques the opponent used, because the opponent logs them as it argues, so its verdict on the opponent is ground truth, not a guess. For the user's side, the judge infers and matches techniques from what the user wrote. Practice on recognizing manipulation becomes checkable instead of vague.

## Who It's For
International relations students and early-career negotiators who want to learn to use rhetorical techniques competently in a real discussion, and to recognize which techniques are being used on them, what effect they have, and when they cross into manipulation. Today they practice only in seminars or with classmates, with no one telling them precisely what just happened in the argument.

## The Core Loop
Pick a discussion topic and an opponent level, then argue. Each exchange is: the user's message, the opponent's reply, and the judge's analysis of that exchange. The analysis is always generated but starts hidden behind a "Show analysis" button, so the user can first try to spot the techniques themselves and check whenever they want. Up to 10 exchanges. The user can press Stop at any time; after any stop (manual or after the 10th exchange) the judge gives an overall verdict: how each side argued, who was stronger and more convincing, who manipulated.

Three opponent levels:
- Friendly: maximally correct and polite, does not manipulate.
- Strict: picks at wording harder and can turn the user's words against them, but agrees or disagrees on the merits.
- Hostile: takes the diametrically opposite position, may use demagoguery, and picks at wording especially hard.

## Inspiration & Identity
Not yet discussed beyond the tone of the three opponents. To be filled in `3-prd`.

## Why This Matters to the Learner
The learner studies international relations and negotiation and wants a practice partner that makes rhetoric and manipulation visible.

## What "Working" Looks Like
A user opens the app, picks a topic (for example "AI in education: benefit or harm") and the Hostile opponent, argues for several exchanges, sees the judge's analysis after each one, presses Stop, and gets a final verdict naming the techniques both sides used and who was more convincing. All in English.

## The POC Boundary
- A fixed list of relatively neutral topics (for example: six-day vs five-day work week, progressive taxes on the rich, AI in education: benefit or harm).
- Three opponent levels: Friendly, Strict, Hostile.
- Up to 10 exchanges, each with a judge analysis; a Stop button.
- Final verdict after any stop.
- Opponent's techniques logged per turn and used by the judge.
- English only.

## Later
- Russian and other languages.
- User-defined topics.
- Saved sessions and progress over time.

## Explicitly Cut
- Hot-button topics (migration, abortion and similar): the point is practicing rhetoric, not emotional flashpoints.
- Accounts and login: not needed to prove the core loop.
