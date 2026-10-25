// All state lives in this one in-memory object; nothing persists.
const state = {
  setup: { name: "", topicId: "", positionId: "", level: "" },
  history: [], // { user, reply, opponentLog, analysis }
  status: "setup", // "setup" | "debating" | "waiting" | "finished"
  verdict: null,
};

const topics = [];

// --- Setup screen -----------------------------------------------------------

const setupScreen = document.getElementById("setup-screen");
const debateScreen = document.getElementById("debate-screen");
const topicSelect = document.getElementById("topic-select");
const positionGroup = document.getElementById("position-group");
const levelSelect = document.getElementById("level-select");
const nameInput = document.getElementById("name-input");
const startButton = document.getElementById("start-button");
const chatPanel = document.getElementById("chat-panel");
const messageInput = document.getElementById("message-input");
const turnForm = document.getElementById("turn-form");
const sendButton = document.getElementById("send-button");

async function loadTopics() {
  const res = await fetch("/api/topics");
  topics.push(...(await res.json()));
  for (const topic of topics) {
    const option = document.createElement("option");
    option.value = topic.id;
    option.textContent = topic.title;
    topicSelect.appendChild(option);
  }
}

topicSelect.addEventListener("change", () => {
  state.setup.topicId = topicSelect.value;
  state.setup.positionId = "";
  positionGroup.innerHTML = "";
  const topic = topics.find((t) => t.id === topicSelect.value);
  if (!topic) return updateStartButton();
  for (const position of topic.positions) {
    const label = document.createElement("label");
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "position";
    radio.value = position.id;
    radio.addEventListener("change", () => {
      state.setup.positionId = position.id;
      updateStartButton();
    });
    label.appendChild(radio);
    label.appendChild(document.createTextNode(" " + position.label));
    positionGroup.appendChild(label);
  }
  updateStartButton();
});

function updateStartButton() {
  state.setup.name = nameInput.value.trim();
  state.setup.level = levelSelect.value;
  startButton.disabled = !(
    state.setup.name &&
    state.setup.topicId &&
    state.setup.positionId &&
    state.setup.level
  );
}

nameInput.addEventListener("input", updateStartButton);
levelSelect.addEventListener("change", updateStartButton);

document.getElementById("setup-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (startButton.disabled) return;
  state.status = "debating";
  state.history = [];
  startDebateScreen();
});

function startDebateScreen() {
  const topic = topics.find((t) => t.id === state.setup.topicId);
  const position = topic.positions.find((p) => p.id === state.setup.positionId);
  const levelLabel = levelSelect.options[levelSelect.selectedIndex].textContent;
  document.getElementById("debate-title").textContent =
    `${topic.title} — you argue: ${position.label} — opponent: ${levelLabel}`;
  chatPanel.innerHTML = "";
  setupScreen.hidden = true;
  debateScreen.hidden = false;
  messageInput.focus();
}

// --- Debate -----------------------------------------------------------------

function addChatMessage(speaker, text) {
  const bubble = document.createElement("div");
  bubble.className = `message ${speaker}`;
  const who = document.createElement("strong");
  who.textContent =
    speaker === "user" ? state.setup.name : "Opponent";
  bubble.appendChild(who);
  bubble.appendChild(document.createElement("br"));
  bubble.appendChild(document.createTextNode(text));
  chatPanel.appendChild(bubble);
  chatPanel.scrollTop = chatPanel.scrollHeight;
}

turnForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = messageInput.value.trim();
  if (!message || state.status === "waiting") return;

  state.status = "waiting";
  messageInput.disabled = true;
  sendButton.disabled = true;
  addChatMessage("user", message);
  messageInput.value = "";

  try {
    const res = await fetch("/api/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        setup: state.setup,
        history: state.history,
        message,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Something went wrong.");
    state.history.push({
      user: message,
      reply: data.reply,
      opponentLog: data.opponentLog ?? [],
      analysis: data.analysis ?? null,
    });
    addChatMessage("opponent", data.reply);
    addAnalysisCard(state.history.length, data.analysis);
    state.status = "debating";
  } catch (err) {
    // Keep the user's text so they can resend without retyping.
    messageInput.value = message;
    addChatMessage("system", err.message);
    state.status = "debating";
  } finally {
    messageInput.disabled = false;
    sendButton.disabled = false;
    messageInput.focus();
  }
});

// --- Judge analysis column --------------------------------------------------

const analysisCards = document.getElementById("analysis-cards");

// One card per exchange, collapsed behind "Show analysis" so the user can
// first try to spot the techniques themselves.
function addAnalysisCard(exchangeNumber, analysis) {
  const card = document.createElement("details");
  card.className = "analysis-card";

  const summary = document.createElement("summary");
  summary.textContent = `Exchange ${exchangeNumber} — Show analysis`;
  card.appendChild(summary);

  if (!analysis) {
    const placeholder = document.createElement("p");
    placeholder.textContent = "No analysis available for this exchange.";
    card.appendChild(placeholder);
  } else {
    card.appendChild(
      analysisSection("Opponent used", formatTechniques(analysis.opponentTechniques, "effect"))
    );
    card.appendChild(
      analysisSection("You used or seem to have used", formatTechniques(analysis.userTechniques, "confidence"))
    );
    card.appendChild(
      analysisSection("Opponent exposed", formatTechniques(analysis.opponentExposed, "effect"))
    );
    card.appendChild(analysisSection("What worked", [analysis.whatWorked]));
    card.appendChild(analysisSection("Assessment", [analysis.assessment]));
  }

  analysisCards.appendChild(card);
}

function analysisSection(title, lines) {
  const section = document.createElement("div");
  section.className = "analysis-section";
  const heading = document.createElement("h3");
  heading.textContent = title;
  section.appendChild(heading);
  for (const line of lines) {
    const paragraph = document.createElement("p");
    paragraph.textContent = line;
    section.appendChild(paragraph);
  }
  return section;
}

function formatTechniques(list, detailField) {
  if (!list || !list.length) return ["None spotted."];
  return list.map(
    (t) => `“${t.quote}” — ${t.name} (${t[detailField] ?? ""})`.replace(/ \(\)$/, "")
  );
}

loadTopics();
