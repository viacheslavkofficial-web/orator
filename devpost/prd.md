---
doc: prd
status: approved
---

# Orator – Product Requirements

A web app where international relations students and early-career negotiators argue a topic against an AI opponent while a neutral AI judge shows which rhetorical techniques each side used, who manipulated, and who was more convincing.
Source: `scope.md > The Unique Kernel`, `scope.md > Who It's For`.

## The Core Journey
Source: `scope.md > The Core Loop`.

1. The user opens the app in a browser tab and sees the setup screen.
2. They enter their name, pick a topic from a list, pick one of the two opposite positions on it, and pick an opponent level: Friendly, Strict, or Hostile.
3. They press Start and land on the debate screen. The user speaks first.
4. The user writes an argument and sends it. The opponent replies, arguing the opposite position in the style of its level.
5. A judge analysis for that exchange appears in the right column, hidden behind a "Show analysis" button. The user can open it now, later, or never.
6. Steps 4–5 repeat, up to 10 exchanges. One exchange = one user message + one opponent reply + one judge analysis.
7. The debate ends when the user presses Stop, or automatically after the 10th exchange.
8. After any stop the judge gives the final verdict: how each side argued, who was stronger and why, who manipulated, and the opponent's full list of techniques it used, revealed.
9. The user can start a new debate from the verdict.

## Screens and Layout

### Setup screen
Name field, topic list, the two positions for the chosen topic, three opponent levels, Start button.

### Debate screen
- Most of the screen: a large square panel with the debate as a chat between the user and the opponent, the message input under it.
- Right column: one analysis card per exchange, in order, each collapsed behind "Show analysis".
- Visible at all times: topic, the user's position, opponent level, exchange counter (for example "3 / 10"), Stop button.

### Final verdict
Shown on the debate screen after the debate ends: the input is disabled and the verdict appears as a prominent panel, with a "New debate" button back to setup. (Placement is an agent suggestion the learner left open to design judgment.)

## Look and Feel
- A website that opens in a browser tab.
- A debate stage: slightly strict, formal style, not a casual messenger.
- The user and the opponent read as two clearly distinct voices; the judge column reads as a neutral third party.
- The learner delegated finer visual decisions (fonts, colors, exact layout) to design judgment in the final UI slice.

## Features and Behavior

### Setup
- As a student, I want to choose a topic, my side, and how tough the opponent is, so that I can practice the kind of argument I need.
  - [ ] Start is unavailable until a name, topic, position, and level are chosen.
  - [ ] Choosing a topic shows its two opposite positions; the user picks one, the opponent gets the other.

Topics (relatively neutral, no hot-button issues), each with two opposite positions:
- Six-day vs five-day work week
- Progressive taxes on the rich
- AI in education: benefit or harm
- Top athletes' salaries: justified or excessive
- Remote work vs working from the office
- Smartphones in schools: ban or allow
- Esports in the Olympics: yes or no
- Space exploration: worth the money or not

### Opponent levels
- Friendly: maximally correct and polite, does not manipulate.
- Strict: picks at wording harder and can turn the user's words against them, but agrees or disagrees on the merits.
- Hostile: takes the diametrically opposite position, may use demagoguery, strawmen, and especially hard nitpicking at wording. Never uses direct insults or personal attacks on the user.
- [ ] The three levels are noticeably different in tone and tactics on the same topic.
- [ ] The opponent addresses the user's actual argument, not a generic speech.

### The opponent's technique log
- With every reply, the opponent records which rhetorical techniques it used and in which phrase. The user does not see this log directly; the judge uses it.
- [ ] The judge's statements about the opponent's techniques match what the opponent logged.

### Exchange analysis (behind "Show analysis")
For each exchange the judge gives, in words:
- which techniques the opponent used and where (quoting the phrase);
- which techniques the user used or seems to have used;
- what worked and what did not;
- a short assessment of the exchange.
- [ ] Each exchange gets its own card in the right column, collapsed by default.
- [ ] Opening a card shows all four parts above.
- [ ] No numeric scores.

### Stop and final verdict
- [ ] Stop is available from the first completed exchange onward.
- [ ] After the 10th exchange the debate ends automatically.
- [ ] After any stop the verdict names how each side argued, who was stronger and more convincing and why, who manipulated, and reveals the opponent's full technique list.
- [ ] No numeric scores, a verbal verdict only.

## States and Boundaries
- First use: setup screen, nothing preselected except what is needed to make the choice obvious.
- Waiting: after the user sends, the input is disabled and a clear indicator shows the opponent is replying; the analysis card appears when ready.
- Empty message: cannot be sent.
- Off-topic, one-word, or rude user messages: the debate continues; the opponent calls out that the user is diluting the topic; the judge notes that in front of an audience this would look ridiculous.
- Error: if the AI fails to respond, the user sees a plain message and can resend the same argument without losing the debate so far.
- Nothing persists: reloading the page starts over.
- Language: English only.

## Product Decisions
- The user speaks first – they open the argument.
- The user chooses their side; the opponent always takes the opposite.
- No numeric scores – they would be barely objective; verbal analysis instead.
- Analysis is always generated but hidden by default – so the user first tries to spot techniques themselves.
- One model plays opponent and neutral judge; the judge knows the opponent's techniques from its log and infers the user's.
- Rude or off-topic messages do not end the debate; they are called out in role and in the analysis.
- Hostile level boundary: demagoguery and nitpicking yes, insults and personal attacks no.

## What We're Building
Setup screen; debate screen with chat and the analysis column; three opponent levels; opponent technique log; per-exchange analysis behind "Show analysis"; Stop and auto-stop after 10 exchanges; final verdict; New debate.

## Deferred From the POC
- Russian and other languages – English only for the hackathon submission.
- User-defined topics – the fixed list keeps topics neutral and predictable.
- Saved sessions and progress over time – needs storage and accounts.

## Possible Later Enhancements
- A glossary of techniques the user can open from any analysis card.
- Replaying a past debate with a different opponent level.

## Non-Goals
- Hot-button topics (migration, abortion and similar) – the point is rhetoric, not emotional flashpoints.
- Accounts and login – not needed to prove the core loop.
- Numeric scoring or leaderboards.

## Open Questions
- Final project name – resolved pre-ship: **Orator**.
