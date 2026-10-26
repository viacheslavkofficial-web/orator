---
doc: spec
status: approved
---

# Orator – Technical Spec

## How This Works, In Plain Language
The app has two parts. The page is what you see in the browser tab: setup, the debate chat, the analysis column, the verdict. The server is a small program on your computer that keeps the Z.ai API key secret and talks to the GLM model; the page never sees the key.

When you send an argument, the page sends it to the server together with the debate so far. The server asks the model two separate questions. First, as the opponent: "here is the debate, reply in your role, and also list which techniques you used and in which phrase". Second, as the judge: "here is the user's argument, the opponent's reply, and the opponent's own list of techniques; analyze the exchange". The opponent and the judge are the same model with different instructions, kept apart so the judge reads the opponent's techniques from its log instead of guessing them. When the debate stops, the server asks the model a third question: the final verdict over the whole debate.

The debate lives only in the open page. Nothing is saved; reloading starts over. This is the simplest shape that still proves the kernel: no database, no accounts, one server file plus a few helpers.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.

1. You open `http://localhost:3000`. The server sends the page; the page asks `GET /api/topics` and fills the topic list.
2. You enter your name, pick a topic, a position, and a level, and press Start. The page keeps these choices in memory and switches to the debate screen.
3. You type an argument and send it. The page sends `POST /api/turn` with your setup, the history so far, and the new message.
4. The server calls the model as the opponent and gets back a reply plus a technique log.
5. The server calls the model as the judge with your message, the reply, and the log, and gets back the exchange analysis.
6. The server returns both. The page adds the opponent's reply to the chat and a collapsed analysis card to the right column, and adds the exchange (including the log) to its in-memory history.
7. Steps 3–6 repeat. On Stop, or after exchange 10, the page sends `POST /api/verdict` with the full history; the server calls the model as the judge once more and returns the verdict, which the page shows in the verdict panel.
8. New debate clears the in-memory state and shows setup again.

## Stack
- Node.js (already installed; tested with v22) – the server. https://nodejs.org/docs/latest-v22.x/api/
- Express – serves the page and the three API routes. https://expressjs.com/
- Model API with a GLM model, called with Node's built-in `fetch` (no SDK). Provider-neutral: any OpenAI-compatible chat-completions endpoint works. Default provider is OpenRouter: `POST https://openrouter.ai/api/v1/chat/completions`. https://openrouter.ai/docs/
- `dotenv` – reads the key from a local `.env` file. https://github.com/motdotla/dotenv
- The page: plain HTML, CSS, and JavaScript. No framework, no build step.

Rationale: the learner asked for what he already has and what is most convenient. Node is installed, one language covers server and page, and there is nothing to compile. Tradeoff accepted: no component framework, so the UI is hand-written DOM code, which is fine for three surfaces.

Model provider: the learner switched from Gemini to GLM. Revised during the build (see below): the app does not call Z.ai directly. It calls the model through OpenRouter with an OpenRouter API key, model `z-ai/glm-5.3-flash` by default, configured provider-neutrally via `LLM_BASE_URL` (default `https://openrouter.ai/api/v1`), `LLM_API_KEY`, and `LLM_MODEL` (default `z-ai/glm-5.3-flash`) in `.env`.

To verify at the very start of the build: (1) the key works on `z-ai/glm-5.3-flash`; (2) whether `response_format: { "type": "json_object" }` is honored; (3) whether the model's thinking mode can be switched off (`"thinking": { "type": "disabled" }`). Check against the provider's docs and keep all of this inside `src/llm.js` so nothing else depends on it. The throwaway script `npm run check:llm` runs these probes.

## Where It Runs and How Someone Tries It
- Runs locally on the learner's computer.
- Requires Node.js 18+ and an OpenRouter API key: https://openrouter.ai/settings/keys
- Setup and start:
  ```
  npm install
  copy .env.example .env      (then put the key into .env)
  npm start
  ```
  Open http://localhost:3000.
- Demo recording: a screen recording of the browser tab running the core journey (see `prd.md > The Core Journey`), uploaded to YouTube, under 3 minutes.
- Public repository: https://github.com/viacheslavkofficial-web/orator (created and pushed pre-ship; branch `master`).
- Deployment: none. The hackathon's judging criteria (Design, Potential Impact, Innovation/Idea, Presentation) contain nothing about deployment, and the rules say reviewers won't clone or run code and may judge from the video and description alone. A local app plus the video is sufficient.

## Look and Feel
Carried from `prd.md > Look and Feel`. Applied in full only in the final UI slice; earlier slices use plain, readable, unstyled-but-tidy markup.

- Feeling: a debate stage. Formal, slightly strict, calm, not a casual messenger and not a generic AI chat app.
- Palette: deep ink navy background for the stage, off-white "paper" panels, one restrained accent (muted brass or deep crimson) for the active speaker and primary buttons. No purple-blue gradients, no glassmorphism.
- Typography: a serif with character for headings and the topic title (for example IBM Plex Serif or Source Serif 4), a clean sans for body and controls (for example IBM Plex Sans). Load from Google Fonts with system fallbacks.
- Layout: debate chat in a large central square; analysis column on the right; topic, position, level, counter "N / 10", and Stop in a header bar above the stage.
- Voices: the user and the opponent are visually distinct speakers (side, color, label with name); the judge column looks like a neutral clerk's notes – smaller type, muted, labelled "Judge".
- Copy tone: brief and formal ("The floor is yours.", "The opponent is preparing a reply…").

## Components

### Server (`server.js`)
Starts Express on port 3000 (or `PORT`), serves `public/`, mounts the API routes, and exits with a clear message if `LLM_API_KEY` is missing.
PRD ref: `prd.md > Screens and Layout`.

### Topics (`src/topics.js`)
The fixed list of eight topics from `prd.md > Setup`, each with `id`, `title`, and two positions `{ id, label }`. Served by `GET /api/topics`.

### Techniques (`src/techniques.js`)
A fixed list of named techniques, each with a one-line definition and a flag: `legitimate` or `manipulative`. Starting list:
- Legitimate: evidence and examples, concession and pivot, reframing, analogy, rhetorical question, appeal to shared values, appeal to authority.
- Manipulative: strawman, false dilemma, slippery slope, red herring / whataboutism, appeal to emotion, false authority, appeal to the crowd (demagoguery), loaded question, cherry-picking, moving the goalposts, quibbling over wording, turning the speaker's words against them, ad hominem.
The opponent may only log techniques from this list. The judge uses the same list for the user and may say "appears to use".
PRD ref: `prd.md > The opponent's technique log`.

### Opponent levels (`src/levels.js`)
Per level: persona instructions and the subset of techniques allowed.
- Friendly: legitimate techniques only; polite and correct.
- Strict: legitimate + quibbling over wording, turning words against them, loaded question; agrees or disagrees on the merits.
- Hostile: all techniques except ad hominem; takes the opposite position hard; may use demagoguery and heavy nitpicking. Hard rule in the prompt: no insults, no personal attacks on the user.
PRD ref: `prd.md > Opponent levels`.

### Prompts and schemas (`src/prompts.js`)
Builds the three prompts and their JSON schemas.
- Opponent: role, level persona, topic, opponent's position, the user's name, history, the new message. Must reply in English, address the user's actual argument, keep replies to a few sentences, and call out off-topic or rude messages as diluting the topic (`prd.md > States and Boundaries`). Returns `{ reply, techniques: [{ name, quote }] }`, where every `quote` is an exact substring of `reply`.
- Judge (exchange): neutral role. Gets the user message, the reply, and the opponent's log. Treats the log as ground truth for the opponent; infers the user's techniques. If the user was rude or off-topic, says plainly that in front of an audience this would look ridiculous. Returns `{ opponentTechniques: [{ name, quote, effect }], userTechniques: [{ name, quote, confidence: "clear" | "likely" }], whatWorked, assessment }`. No scores.
- Judge (verdict): gets the full history with all logs. Returns `{ userSummary, opponentSummary, stronger: "user" | "opponent" | "even", why, manipulation, opponentTechniqueList: [{ name, count }] }`. No scores.
PRD ref: `prd.md > Exchange analysis (behind "Show analysis")`, `prd.md > Stop and final verdict`.

### Model client (`src/llm.js`)
One function, `callJson({ system, input, schema })`, that sends a chat completion to the configured OpenAI-compatible endpoint (system message + user message), asks for JSON output, and returns the parsed object. The expected JSON shape (`schema`) is described in the system prompt, and the parsed result is checked for the required fields. Model name from `LLM_MODEL` (default `z-ai/glm-5.3-flash`). On invalid JSON or missing fields, retries once; then throws a readable error.
PRD ref: `prd.md > The opponent's technique log`.

### API routes (in `server.js`)
- `GET /api/topics` → the topic list.
- `POST /api/turn` – body `{ setup: { name, topicId, positionId, level }, history: [...], message }`. Rejects an empty message or more than 10 exchanges (400). Calls opponent, then judge. Returns `{ reply, opponentLog, analysis }`.
- `POST /api/verdict` – body `{ setup, history }`. Returns the verdict object.
- Errors return `{ error: "plain message" }` with status 500 (model failure) or 429 (quota).
PRD ref: `prd.md > The Core Journey`.

### Page (`public/index.html`, `public/app.js`, `public/styles.css`)
- Setup screen: name, topic select, the two positions, three levels, Start (disabled until all are set). Implements `prd.md > Setup`.
- Debate screen: header bar (topic, position, level, counter, Stop), chat panel with input, right column of analysis cards collapsed behind "Show analysis". Implements `prd.md > Screens and Layout`, `prd.md > Exchange analysis (behind "Show analysis")`.
- Verdict panel on the debate screen, input disabled, New debate button. Implements `prd.md > Stop and final verdict`.
- States: Send disabled for empty input and while waiting; waiting indicator; on error, a plain message and the user's text left in the input so they can resend. Implements `prd.md > States and Boundaries`.

## Data Model
All state lives in one in-memory object in `public/app.js`:
```
state = {
  setup: { name, topicId, positionId, level },
  history: [ { user, reply, opponentLog: [{name, quote}], analysis } ],
  status: "setup" | "debating" | "waiting" | "finished",
  verdict: null | {...}
}
```
- Updated after every successful `/api/turn` (one history entry appended) and after `/api/verdict`.
- The server keeps nothing between requests; the page sends the history each time.
- Leaving or reloading the page loses the debate, by design (`prd.md > States and Boundaries`).

## File Structure
```
negotiation-sparring/          (C:\basics-ai-october-2026 on the learner's machine)
├── server.js              # Express server, API routes, key check
├── src/
│   ├── llm.js             # Z.ai GLM call with JSON output, retry once
│   ├── prompts.js         # opponent / judge / verdict prompts and schemas
│   ├── levels.js          # Friendly / Strict / Hostile personas and allowed techniques
│   ├── techniques.js      # fixed technique list with definitions
│   └── topics.js          # eight topics with two positions each
├── public/
│   ├── index.html         # setup screen, debate screen, verdict panel
│   ├── app.js             # in-memory state, rendering, API calls
│   └── styles.css         # Look and Feel
├── .env.example           # LLM_BASE_URL=, LLM_API_KEY=, LLM_MODEL=z-ai/glm-5.3-flash
├── package.json           # "start": "node server.js"
├── README.md              # what it is, setup, run
├── LICENSE                # MIT (required: open-source license visible on GitHub)
└── devpost/               # Devpost learning workspace
```

## External Services and Dependencies
### Model API (GLM via OpenRouter)
- Docs: https://openrouter.ai/docs/
- Endpoint: `POST {LLM_BASE_URL}/chat/completions` (default `https://openrouter.ai/api/v1/chat/completions`), header `Authorization: Bearer <LLM_API_KEY>`. Any OpenAI-compatible provider works; only the URL, key, and model id change.
- Payload: `{ "model": "z-ai/glm-5.3-flash", "messages": [{ "role": "system", "content": ... }, { "role": "user", "content": ... }], "response_format": { "type": "json_object" }, "temperature": 0.7 }` (plus `"thinking": { "type": "disabled" }` if the provider accepts it; `src/llm.js` drops it automatically if refused).
- Response: `choices[0].message.content` holds the JSON text.
- Key: `LLM_API_KEY` in `.env`, an OpenRouter key. Never committed.
- Calls per debate: 2 per exchange + 1 verdict, so at most 21.
- Cost and limits: priced per the provider's model page for `z-ai/glm-5.3-flash` (a full debate is at most 21 short calls; expected well under a cent-scale budget per debate). Unverified: exact rate limits; check in slice 1.

## Important Failure Modes
- **Model returns malformed JSON or a quote that is not in the reply** → retry once; if still malformed, the user sees "The judge lost the thread. Send again." and their text stays in the input.
- **Rate or concurrency limit (429)** → "The model is busy. Wait a minute and send again." Switching `LLM_MODEL` to another model id on the same provider (for example a smaller GLM flash model) is the manual fallback.
- **Key missing or invalid** → the server refuses to start with a clear message; if it fails mid-run, the page shows a plain error.

## What Was Simplified and Why
- **History sent from the page every turn** instead of server-side sessions – no storage needed; a debate is at most ten short exchanges.
- **Fixed technique list** instead of open-ended detection – keeps the opponent's log checkable and the judge's vocabulary consistent.
- **Three model calls per flow, no streaming** – simpler to build and verify; the waiting indicator covers the delay.
- **Local run only** – no hosting setup; the video is what judges see.

## Build Handoff
The build is split between agents by the learner's choice:
- Slices for the working app (server, model calls, opponent log, judge, levels, loop, Stop, verdict, states) are built by GLM via `5-build`, with plain functional markup only.
- The last slice, "Look and Feel", is reserved for a separate Claude session. GLM stops before it.
Recommended slice order for `5-build` (kernel early):
1. Setup + first exchange end-to-end: server, topics, GLM call; the user sends an argument and the opponent replies (Friendly level).
2. The kernel: opponent technique log + judge analysis card behind "Show analysis".
3. All three levels, the 10-exchange loop, Stop, auto-stop, final verdict, New debate.
4. States and errors: waiting, empty input, resend on error, rude/off-topic handling checked.
5. Look and Feel (Claude session): apply `spec.md > Look and Feel` to the page.

## Decisions and Open Issues
- Stack: Node + Express + plain page – recommended by the agent, accepted by the learner ("what I already have and what is most convenient").
- Model: GLM – the learner's choice (switched from Gemini). Revised during the build: access goes through OpenRouter (key `LLM_API_KEY`, model `z-ai/glm-5.3-flash` by default) instead of a direct Z.ai platform key, because the learner's GLM Coding Plan cannot be used for app calls (it is restricted to supported coding tools) and OpenRouter provides the same model through one general-purpose OpenAI-compatible key. `src/llm.js` stays provider-neutral so the endpoint can change by editing `.env` alone.
- No deployment – learner asked whether the rules require it; they don't (see `Where It Runs and How Someone Tries It`).
- Learner uncertainty discussed: whether a model is good enough to detect rhetorical techniques and manipulation. Clarified by design: the opponent logs its own techniques, so the judge's statements about the opponent are ground truth; only the user's techniques are inferred, with a "clear / likely" confidence. Checked in slice 2: every opponent technique the judge names must match the log, and every quote must appear in the reply.
- Open: JSON mode and thinking switch on `glm-5.3-flash` (see Stack) – verify in slice 1.
- Open: project name – resolved pre-ship: **Orator** (from `prd.md > Open Questions`).
