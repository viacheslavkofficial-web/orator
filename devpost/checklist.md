---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast (learner hands implementation to GLM; checkpoints below still require the learner to try the app)

Agent split: slices 1–4 are built by GLM via `5-build`. Slice 5 is reserved for a separate Claude session – GLM stops after slice 4 and the early checkpoint, and tells the learner to continue with Claude. See `spec.md > Build Handoff`.

## Slices

- [x] **1. You can start a debate and get the opponent's first reply**
  Becomes usable: A running local app. The setup screen lists the eight topics; you enter a name, pick a topic, a position, and the Friendly level, press Start, type an argument, and the opponent replies in the chat, arguing the opposite position.
  Why now: Proves the whole path end to end – server, key, Z.ai call, page – and settles the riskiest unknowns (key, JSON mode, thinking switch) before anything depends on them.
  PRD ref: `prd.md > The Core Journey` (steps 1–4), `prd.md > Setup`
  Spec ref: `spec.md > Stack`, `spec.md > Server (server.js)`, `spec.md > Topics (src/topics.js)`, `spec.md > Model client (src/llm.js)`, `spec.md > API routes (in server.js)`, `spec.md > File Structure`, `spec.md > Where It Runs and How Someone Tries It`
  Build: Scaffold per the file structure (`package.json` with `"start": "node server.js"`, Express, dotenv, `.env.example`, MIT `LICENSE`, short `README.md`). First write a tiny throwaway check (or a first run of `src/llm.js`) that calls `glm-5.3-flash` with `response_format: json_object` and confirms parsed JSON comes back; try `thinking: disabled` and keep it only if accepted. Then `src/topics.js`, `src/llm.js`, an opponent prompt that returns `{ reply, techniques }` (techniques may be empty for now), `GET /api/topics`, `POST /api/turn` returning the reply, and a plain setup screen + chat in `public/`. Plain functional markup only – no styling work (`spec.md > Build Handoff`).
  Verify (mechanical): `npm start` starts with no errors and a missing key produces a clear message; `curl http://localhost:3000/api/topics` returns 8 topics with two positions each; a `curl -X POST` to `/api/turn` with a sample setup and message returns a non-empty English reply.
  Learner check: Put your Z.ai platform key in `.env`, run `npm start`, open http://localhost:3000, start a debate on any topic as Friendly, send one argument, and see the opponent answer your actual point.
  Commit: `Scaffold app and first opponent reply via GLM`

- [x] **2. The judge analyzes each exchange, using the opponent's own technique log**
  Becomes usable: After each reply, a collapsed card appears in the right column; "Show analysis" reveals which techniques the opponent used (with quotes), which techniques you used or seem to have used, what worked, and a short assessment.
  Why now: This is `scope.md > The Unique Kernel`. It must exist before levels and the full loop are layered on.
  PRD ref: `prd.md > The opponent's technique log`, `prd.md > Exchange analysis (behind "Show analysis")`
  Spec ref: `spec.md > Techniques (src/techniques.js)`, `spec.md > Prompts and schemas (src/prompts.js)`, `spec.md > API routes (in server.js)`, `spec.md > Page (public/index.html, public/app.js, public/styles.css)`
  Build: Add `src/techniques.js`; make the opponent log techniques only from that list with exact quotes; add the judge prompt and schema; `POST /api/turn` calls opponent then judge and returns `{ reply, opponentLog, analysis }`; validate that every logged quote is a substring of the reply (retry once if not); render the analysis card collapsed behind "Show analysis". No numeric scores.
  Verify (mechanical): Run 3 `/api/turn` requests (one per level is not needed yet); for each, assert every `opponentLog` quote appears in `reply`, every technique name is in the technique list, and every technique in `analysis.opponentTechniques` matches one in `opponentLog`. Print the results.
  Learner check: Send an argument, guess what the opponent did, then press "Show analysis" and compare. Does the analysis read as fair and useful?
  Commit: `Add opponent technique log and judge analysis`

- [x] **3. A full debate: three levels, up to ten exchanges, Stop, and the final verdict**
  Becomes usable: You can pick Friendly, Strict, or Hostile and feel the difference; the header shows topic, position, level, and "N / 10"; Stop ends the debate (available after the first exchange), the 10th exchange ends it automatically, and the verdict panel shows how each side argued, who was stronger and why, who manipulated, and the opponent's full technique list. New debate returns to setup.
  Why now: Completes `prd.md > The Core Journey` on top of the working kernel.
  PRD ref: `prd.md > Opponent levels`, `prd.md > Stop and final verdict`, `prd.md > Screens and Layout`
  Spec ref: `spec.md > Opponent levels (src/levels.js)`, `spec.md > Prompts and schemas (src/prompts.js)`, `spec.md > API routes (in server.js)`, `spec.md > Data Model`
  Build: Add `src/levels.js` with personas and allowed techniques (Hostile: no ad hominem, no insults); pass the level into the opponent prompt and enforce allowed techniques in validation; header bar with counter and Stop; `POST /api/verdict`; verdict panel with input disabled; New debate clears state; server rejects an 11th exchange.
  Verify (mechanical): For the same topic and message, call `/api/turn` once per level and print the replies and logs – Friendly logs only legitimate techniques, Hostile never logs ad hominem; call `/api/verdict` with a 2-exchange history and confirm all verdict fields are present; confirm an 11th-exchange request returns 400.
  Learner check: Run the same opening argument against Friendly and then Hostile; check they feel different; argue three exchanges, press Stop, and read the verdict.
  Commit: `Add opponent levels, debate loop, stop and verdict`

- [x] **4. Waiting, empty input, errors, and rude or off-topic messages behave as planned**
  Becomes usable: Send is disabled for empty input and while waiting; a clear waiting indicator shows while the opponent replies; if the model fails, you see a plain message and your text stays in the box to resend; a rude or off-topic message gets called out by the opponent and the judge says it would look ridiculous in front of an audience.
  Why now: These are the states most likely to appear in the demo video; doing them before styling means the final slice only changes looks.
  PRD ref: `prd.md > States and Boundaries`
  Spec ref: `spec.md > Important Failure Modes`, `spec.md > Page (public/index.html, public/app.js, public/styles.css)`
  Build: Disable/enable controls by `state.status`; waiting indicator; error handling for 500 and 429 with the spec's messages; keep the unsent text on failure; confirm the opponent and judge prompts handle rude/off-topic input as specified.
  Verify (mechanical): Temporarily set an invalid key and confirm `/api/turn` returns a readable error; send an empty message to `/api/turn` and confirm 400; send a rude one-word message and print the reply and analysis to confirm both call it out.
  Learner check: Try sending nothing, then something rude, then break the key in `.env` and restart to see the error message; restore the key.
  Commit: `Handle waiting, empty input, errors and off-topic messages`

- [x] **5. The debate stage look (Claude session)**
  Becomes usable: The app looks like a formal debate stage: navy stage, paper panels, one restrained accent, serif headings, distinct speaker voices, the judge column as neutral clerk's notes.
  Why now: Last, by the learner's choice – behavior is settled, so styling cannot break it; done by Claude for design quality.
  PRD ref: `prd.md > Look and Feel`, `prd.md > Screens and Layout`
  Spec ref: `spec.md > Look and Feel`, `spec.md > Page (public/index.html, public/app.js, public/styles.css)`
  Build: Reserved for a separate Claude session. GLM does not build this slice. Restyle `public/styles.css` and adjust markup in `public/index.html` / `public/app.js` only as needed for layout; no behavior changes.
  Verify (mechanical): `npm start`, load the page, run one exchange, open an analysis card, Stop, and see the verdict – no console errors; same results from the slice 3 and 4 checks.
  Learner check: Look at setup, the debate, an open analysis card, and the verdict; say whether it feels like a debate stage and what you'd change.
  Commit: `Apply debate stage look and feel`

## Hands-on Checkpoints

- [ ] Early usable behavior explored – after slice 2 (the kernel): learner runs a short debate, opens analysis cards, and gives feedback before levels and the loop are built
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

- [x] Final review fix 1 – "exposed" tightened: only weak or manipulative user moves that the opponent explicitly called out as flawed; acknowledging or conceding a point is not exposing it (opponent prompt + judge mirroring)
- [x] Final review fix 2 – "appeal to authority" (legitimate) and "false authority" (manipulative) added to the technique vocabulary and level allowances
- [x] Final review fix 3 – judge analyzes the user's message independently, before seeing the opponent's exposed list (it copied the opponent's "analogy" label and missed the strawman); one quote may carry several labels; escalate to a separate user-side model call if prompt fixes miss the strawman
- [x] Final review fix 4 – verdict addresses the user in the second person ("You argued…", not "John argued…") and weighs the user's manipulation consistently with the exchange analyses (a move the analyses labeled manipulative must not be praised as the user's strongest argument)
- [x] Final review fix 5 – the opponent logged its call-outs of the user's moves as its own techniques (the user's "every serious study" claim logged as the opponent's "cherry-picking"; its strawman rebuttal logged as "quibbling over wording"), leaving "exposed" empty. Opponent prompt now: any sentence whose purpose is to name or rebut a flaw in the user's message goes into "exposed" with the user's technique it exposes, never into "techniques". Server validation moves a "techniques" entry whose quote describes the user's message ("your claim…", "to suggest…", or quoting the user's words) into "exposed". Fallback if one re-verification still misfires: drop the "Opponent exposed" card section and stop feeding exposed to the judge.
- [x] Final review fix 6 – the second-person rule leaked into opponentSummary ("You challenged the user's…"). Verdict voice convention: the user is always "you/your" (never the name, never "the user"), the opponent is always third person ("The opponent…"); opponentSummary must not use second person for the opponent
- [x] Final review complete – feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [x] Learning activity complete – guided route, focused alternative, prior practice connected, or brief recap
- [x] Optional edit and transfer reflection addressed – offered/declined/already covered/not applicable as appropriate
- [x] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: Focused-alternative recap (experienced plan-first user). The learner's own final-review debugging served as the hands-on practice: they traced three model-behavior bugs from observed exchanges to their causes and specified the fixes (fix 3: the judge anchoring on the opponent's labels; fix 5: call-outs misrouted into the opponent's technique log; fix 6: the verdict-voice leak). Evidence: `checklist.md > Revisions` (fixes 3, 5, 6) and the re-verification results recorded there.
Route and stops: Reference route (not toured interactively, labeled as such in the map): `public/app.js` turnForm submit handler → `server.js` `POST /api/turn` → `src/llm.js` `callJson` → collapsed analysis card via `addAnalysisCard`.
Edit outcome: No optional edit — the final-review fix work itself was the hands-on practice; pre-ship time-box.
Reflection: Transfer question ("What would you do differently next time you start with an agent?") offered in chat at handoff; response pending.
Activity mode: Focused alternative (evidence-based recap) + generated app map.

## Revisions

- 2026-10-25, during slice 1: model provider switched from the Z.ai platform endpoint to OpenRouter, on the learner's instruction. `src/llm.js` and `scripts/check-llm.js` are provider-neutral: they read `LLM_BASE_URL` (default `https://openrouter.ai/api/v1`), `LLM_API_KEY`, and `LLM_MODEL` (default `z-ai/glm-5.3-flash`) from `.env`. `spec.md` updated in the same pass (Stack, Where It Runs, Model client, External Services, Failure Modes, file structure, Decisions and Open Issues); README and `.env.example` updated to match. Reason: the GLM Coding Plan cannot be used for app calls (restricted to supported coding tools), and OpenRouter provides the same GLM model through one general-purpose key. The check script now probes json_object and the thinking parameter against OpenRouter; slice 1 verification (including the thinking-param verdict) still runs once the key is in `.env`.
- 2026-10-25, after the slice-2 hands-on check (learner feedback), verified live before slice 3:
  - **Opponent log purity.** The log mixed techniques the opponent used with techniques it exposed in the user's message (exchange 1 logged "false dilemma" only because it called out the user's false dilemma). The opponent output now has an optional `exposed: [{name, quote_from_user}]` array for techniques it caught in the user's message; the log (`techniques`) must contain only what the opponent itself used. The judge receives `exposed` as ground truth and the analysis card gains an "Opponent exposed" section. Slice-2 assertions kept; new assertion added: no technique appears in the log only because the user's message named it.
  - **Friendly persona tightened.** No loaded questions and no questions implying bad motives ("is your goal genuinely X, or simply Y?"); questions only to clarify or make a substantive point.
  - **Analysis brevity.** Each technique explanation max 1 sentence, "What worked" max 3 sentences, "Assessment" max 3 sentences — the card and the demo video need short text. Brevity is enforced server-side (validated with the same retry-once mechanism as the other checks).
- 2026-10-25, during slice 3: the verdict's `opponentTechniqueList` is computed by the server from the opponent's own logs (counts by technique) instead of being generated by the model. The API shape is unchanged; this keeps the list ground truth by construction and removes a miscounting risk.
- 2026-10-25, after slice 5, before the final review: about 1 in 3 rude-message turns failed quote validation because the model's logged quote differed cosmetically from the reply (curly vs straight quotes, dashes, whitespace). Quote comparison now normalizes both sides (quotes, dashes, whitespace, case) before matching, and a log/analysis entry whose quote still does not match its source is DROPPED instead of failing the whole turn; only an empty reply or a malformed judge top-level/brevity failure still rejects with a readable error. The user's slice-2 assertions still hold — normalization only widens matching.
- 2026-10-25, final review feedback (fix 1): "exposed" was too loose — the opponent listed the user's analogy there just because it acknowledged it. The opponent prompt now says "exposed" contains ONLY weak or manipulative user moves explicitly called out as flawed in the reply; acknowledging, granting, or agreeing with a point is never exposing it. The judge's mirroring instruction says the same.
- 2026-10-25, final review feedback (fix 2): two techniques added — "appeal to authority" (legitimate, citing a relevant credible source) and "false authority" (manipulative, an irrelevant or vague authority). `src/techniques.js` updated; level allowances pick them up automatically from the flags (Friendly/Strict get appeal to authority, only Hostile gets false authority). Spec's technique list updated to match. The judge initially never chose the new names (citations kept landing in "evidence and examples"), so the judge prompt gained one classification hint: citations of a source, organization, study, or expert should be considered "appeal to authority" or "false authority". After the hint, the UNESCO test message classified as "appeal to authority" in 3 of 3 runs.
- 2026-10-25, final review feedback (fix 3): the judge anchored on the opponent's labels — it copied "analogy" and missed the user's strawman. The judge prompt now prescribes the order explicitly: analyze the user's message on its own merits FIRST, then read the opponent's log/exposed list for the opponent-side sections only; the log and exposed list are never a source of labels for the user side. One phrase may carry several labels (e.g. "analogy" + "strawman"), each as its own entry. Stress-tested with a message that is both an analogy and a strawman: 3 of 3 runs detected the strawman independently, so the escalation to a separate user-side model call was not needed.
- 2026-10-25, final review feedback (fix 4): the final verdict spoke about the user in the third person ("John argued…") under the heading "How you argued", and called the user's strawman line their "strongest" move, contradicting the exchange analyses. The verdict prompt now requires the second person for "userSummary", feeds the per-exchange user-side labels from the exchange analyses into the verdict input alongside the opponent's logs, and requires manipulative user moves to be weighed as manipulation, never praised as strongest. Note: Claude's technique-tally style change was already part of the slice-5 commit (`a5f2b54`) — the working tree was clean; nothing further to include.
- 2026-10-25, final review feedback (fix 5): the opponent logged its call-outs of the user's moves as its own techniques (the user's "every serious study" claim logged as the opponent's "cherry-picking"; its strawman rebuttal logged as "quibbling over wording"), leaving "exposed" empty. Fixed in one pass: the opponent prompt now states that any sentence whose purpose is to name or rebut a flaw in the user's message goes into "exposed" — with the user's technique it exposes — and never into "techniques"; and the server moves a "techniques" entry whose quote describes the user's message (call-out phrases like "your claim…", "to suggest…", or a normalized verbatim quote of the user's words) into "exposed" instead of dropping or failing. Re-verification: with an explicit strawman rebuttal the entry stayed out of "techniques" and appeared in "exposed"; with a concede-and-reframe reply (no explicit call-out) "exposed" was correctly empty and nothing was misrouted. The fallback (dropping the card section and the judge feed) was not triggered.
- 2026-10-25, pre-ship: the project is named **Orator** (the open "final project name" question from `prd.md > Open Questions` is resolved). Renamed in the page `<title>`, the brand line on the setup screen, `package.json` ("orator"), the README title, the planning docs' title lines (`scope.md`, `prd.md`, `spec.md`), and the server startup log line; the stale "can wait until 6-ship" notes in prd/spec were updated to record the decision. Git identity also rewritten pre-ship from the repo-local placeholder (`yyou2 <yyou2@users.noreply.github.com>`) to the learner's real identity (Viacheslav Kolodiazhnyi <viacheslav.k.official@gmail.com>) with the repo's local commit history rewritten to match — safe because the repository has never been published.
- 2026-10-25, final review feedback (fix 6): the second-person rule leaked into opponentSummary ("You challenged the user's sweeping study claim…"). The verdict prompt now defines the voice for the whole verdict: the user is always "you/your" (never by name, never "the user"), the opponent always third person ("the opponent", never "you"). Re-run of the user's smartphones debate (both test messages, Hostile, then Stop): userSummary reads entirely in the second person, opponentSummary entirely in the third person, no "the user" and no name anywhere; "Who manipulated" charges only the user (strawman, slippery slope) and credits the opponent's rebuttals as reframing — no cherry-picking or quibbling charged to the opponent.

