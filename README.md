# Rhetoric Sparring

A debate sparring app: argue a topic against an AI opponent while a neutral AI
judge analyzes every exchange — which rhetorical techniques each side used,
who manipulated, and who was more convincing. The opponent logs its own
techniques as it argues, so the judge's assessment of the opponent is ground
truth.

Built for the Build With AI: Basics hackathon (Devpost).

## Setup and run

Requires Node.js 18+ and an OpenRouter API key (any OpenAI-compatible
provider works — see `.env.example`): https://openrouter.ai/settings/keys

```
npm install
copy .env.example .env      (then put the key into .env)
npm start
```

Open http://localhost:3000.

## How it works

- The browser page keeps the whole debate in memory; nothing is saved.
- The Express server (`server.js`) serves the page and three API routes,
  calling the GLM model through an OpenAI-compatible chat-completions endpoint
  (OpenRouter by default; `src/llm.js`) as the opponent, the exchange judge,
  and the final verdict judge.
- The opponent replies with a log of the rhetorical techniques it used
  (`src/techniques.js`); the judge analyzes the exchange against that log
  (`src/prompts.js`).

## License

MIT — see `LICENSE`.
