// One place that knows how to talk to the model API. Nothing else in the app
// touches the endpoint, the key, or the JSON-mode quirks. Provider-neutral by
// design: any OpenAI-compatible endpoint works (default: OpenRouter).

import "dotenv/config";

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";

// GLM-5.3-flash through OpenRouter; the exact id can be overridden in .env.
const DEFAULT_MODEL = "z-ai/glm-5.3-flash";

// GLM-5.3 family runs with thinking always on; some providers reject an
// explicit "thinking" parameter. We still try it once: if the API rejects
// the parameter, llm.js drops it for the rest of the run (the slice-1 check
// script confirms which mode the key actually gets).
let thinkingParamAccepted = true;

function baseUrl() {
  return (process.env.LLM_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

export function getModel() {
  return process.env.LLM_MODEL || DEFAULT_MODEL;
}

export function requireApiKey() {
  const key = process.env.LLM_API_KEY;
  if (!key) {
    throw new Error(
      "LLM_API_KEY is missing. Put your model-provider API key into the .env file (see .env.example) and start the app again."
    );
  }
  return key;
}

function chatCompletionsUrl() {
  return baseUrl().endsWith("/chat/completions")
    ? baseUrl()
    : `${baseUrl()}/chat/completions`;
}

function stripJsonFences(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : trimmed;
}

function hasRequiredFields(obj, schema) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  if (!schema || !Array.isArray(schema.required)) return true;
  return schema.required.every(
    (field) => obj[field] !== undefined && obj[field] !== null
  );
}

async function postChat(apiKey, body) {
  const res = await fetch(chatCompletionsUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const err = new Error(`Model request failed (${res.status}). ${detail}`.trim());
    err.status = res.status === 429 ? 429 : 500;
    throw err;
  }

  const data = await res.json();
  const message = data.choices?.[0]?.message;
  const content = typeof message?.content === "string" ? message.content : null;
  if (!content) {
    const err = new Error("The model returned an empty response.");
    err.status = 500;
    throw err;
  }
  return content;
}

// Calls the model and returns the parsed JSON object.
//   system – the role instruction, ends with the expected JSON shape
//   input  – the user message with the actual debate data
//   schema – { required: ["reply", ...] } fields the object must contain
export async function callJson({ system, input, schema }) {
  const apiKey = requireApiKey();
  const model = getModel();

  const baseBody = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: input },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  };

  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    const body = thinkingParamAccepted
      ? { ...baseBody, thinking: { type: "disabled" } }
      : baseBody;
    try {
      const content = await postChat(apiKey, body);
      const parsed = JSON.parse(stripJsonFences(content));
      if (!hasRequiredFields(parsed, schema)) {
        throw new Error(
          `Model JSON is missing required fields (${schema?.required?.join(", ")}).`
        );
      }
      return parsed;
    } catch (caught) {
      lastError = caught;
      // The API refused the thinking parameter: drop it and retry the same attempt.
      if (
        thinkingParamAccepted &&
        (caught.status === 400 || caught.status === 500) &&
        /thinking/i.test(String(caught.message))
      ) {
        thinkingParamAccepted = false;
        attempt -= 1;
        continue;
      }
      if (caught instanceof SyntaxError) {
        // Invalid JSON: retry once, then give up.
        continue;
      }
      throw caught; // network / HTTP / validation failure that a retry will not fix
    }
  }

  const err = new Error(
    `The model could not produce valid JSON after a retry. ${lastError?.message ?? ""}`.trim()
  );
  err.status = 500;
  throw err;
}
