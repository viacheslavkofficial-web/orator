// All state lives in this one in-memory object; nothing persists.
const MAX_EXCHANGES = 10;

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
const stopButton = document.getElementById("stop-button");
const headerTopic = document.getElementById("header-topic");
const headerPosition = document.getElementById("header-position");
const headerLevel = document.getElementById("header-level");
const headerCounter = document.getElementById("header-counter");
const verdictPanel = document.getElementById("verdict-panel");
const verdictContent = document.getElementById("verdict-content");
const waitingIndicator = document.getElementById("waiting-indicator");
const analysisCards = document.getElementById("analysis-cards");

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
  if (!topic) {
    const placeholder = document.createElement("p");
    placeholder.className = "side-placeholder";
    placeholder.textContent = "Choose a motion to see both sides.";
    positionGroup.appendChild(placeholder);
    return updateStartButton();
  }
  for (const position of topic.positions) {
    const label = document.createElement("label");
    label.className = "side-option";
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "position";
    radio.value = position.id;
    radio.addEventListener("change", () => {
      state.setup.positionId = position.id;
      updateStartButton();
    });
    const text = document.createElement("span");
    text.textContent = position.label;
    label.appendChild(radio);
    label.appendChild(text);
    positionGroup.appendChild(label);
  }
  updateStartButton();
});

// One-line description under the opponent select (prd.md > Opponent levels).
const LEVEL_HINTS = {
  friendly: "Polite and correct. Argues on the merits and does not manipulate.",
  strict: "Picks at your wording and can turn your words against you, but argues on the merits.",
  hostile: "Takes the opposite side hard. Expect demagoguery, strawmen and nitpicking – never personal insults.",
};
const levelHint = document.getElementById("level-hint");
levelSelect.addEventListener("change", () => {
  levelHint.textContent = LEVEL_HINTS[levelSelect.value] ?? "";
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
  state.verdict = null;
  startDebateScreen();
});

function startDebateScreen() {
  const topic = topics.find((t) => t.id === state.setup.topicId);
  const position = topic.positions.find((p) => p.id === state.setup.positionId);
  const levelLabel = levelSelect.options[levelSelect.selectedIndex].textContent;
  headerTopic.textContent = topic.title;
  headerPosition.textContent = position.label;
  headerLevel.textContent = levelLabel;
  debateScreen.dataset.level = state.setup.level;
  updateCounter();
  chatPanel.innerHTML = "";
  analysisCards.innerHTML = "";
  verdictPanel.hidden = true;
  verdictContent.innerHTML = "";
  waitingIndicator.hidden = true;
  stopButton.disabled = true; // available from the first completed exchange
  messageInput.disabled = false;
  sendButton.disabled = true; // enabled once the user types something
  setupScreen.hidden = true;
  debateScreen.hidden = false;
  messageInput.focus();
}

function updateCounter() {
  headerCounter.textContent = `${state.history.length} / ${MAX_EXCHANGES}`;
  stopButton.disabled = state.history.length === 0 || state.status === "finished";
}

// --- Debate -----------------------------------------------------------------

// Send stays disabled while the input is empty (empty messages cannot be sent).
messageInput.addEventListener("input", () => {
  if (state.status !== "waiting" && state.status !== "finished") {
    sendButton.disabled = !messageInput.value.trim();
  }
});

function addChatMessage(speaker, text) {
  const bubble = document.createElement("div");
  bubble.className = `message ${speaker}`;
  if (speaker !== "system") {
    const who = document.createElement("p");
    who.className = "speaker";
    const name = document.createElement("span");
    name.className = "speaker-name";
    name.textContent = speaker === "user" ? state.setup.name : "Opponent";
    const side = document.createElement("span");
    side.className = "speaker-side";
    side.textContent =
      speaker === "user"
        ? headerPosition.textContent
        : `${headerLevel.textContent} opponent`;
    who.appendChild(name);
    who.appendChild(side);
    bubble.appendChild(who);
  }
  const speech = document.createElement("p");
  speech.className = "speech";
  speech.textContent = text;
  bubble.appendChild(speech);
  chatPanel.appendChild(bubble);
  chatPanel.scrollTop = chatPanel.scrollHeight;
}

turnForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = messageInput.value.trim();
  if (!message || state.status === "waiting" || state.status === "finished") return;

  state.status = "waiting";
  messageInput.disabled = true;
  sendButton.disabled = true;
  stopButton.disabled = true;
  waitingIndicator.textContent = "The opponent is preparing a reply…";
  waitingIndicator.hidden = false;
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
    updateCounter();
    if (state.history.length >= MAX_EXCHANGES) {
      addChatMessage("system", "The debate is over after 10 exchanges.");
      await finishDebate();
      return;
    }
    state.status = "debating";
  } catch (err) {
    // Keep the user's text so they can resend without retyping.
    messageInput.value = message;
    addChatMessage("system", err.message);
    state.status = "debating";
  } finally {
    waitingIndicator.hidden = true;
    if (state.status !== "finished") {
      messageInput.disabled = false;
      sendButton.disabled = !messageInput.value.trim();
      messageInput.focus();
    }
    updateCounter();
  }
});

// --- Stop and final verdict ---------------------------------------------------

stopButton.addEventListener("click", async () => {
  if (state.status === "waiting" || !state.history.length) return;
  state.status = "waiting";
  messageInput.disabled = true;
  sendButton.disabled = true;
  stopButton.disabled = true;
  waitingIndicator.hidden = false;
  await finishDebate();
});

async function finishDebate() {
  state.status = "finished";
  messageInput.disabled = true;
  sendButton.disabled = true;
  stopButton.disabled = true;
  waitingIndicator.textContent = "The judge is writing the verdict…";
  waitingIndicator.hidden = false;
  try {
    const res = await fetch("/api/verdict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setup: state.setup, history: state.history }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Something went wrong.");
    state.verdict = data;
    renderVerdict(data);
  } catch (err) {
    addChatMessage("system", err.message);
  }
  waitingIndicator.hidden = true;
  updateCounter();
}

function renderVerdict(verdict) {
  verdictContent.innerHTML = "";

  const strongerLabel =
    verdict.stronger === "user"
      ? `${state.setup.name} was stronger`
      : verdict.stronger === "opponent"
        ? "The opponent was stronger"
        : "The debate was even";
  const ruling = document.createElement("div");
  ruling.className = `ruling ruling-${verdict.stronger ?? "even"}`;
  appendVerdictSection(ruling, "p", strongerLabel).className = "ruling-headline";
  appendVerdictSection(ruling, "p", verdict.why).className = "ruling-why";
  verdictContent.appendChild(ruling);

  const sides = document.createElement("div");
  sides.className = "verdict-sides";
  const userCol = document.createElement("div");
  userCol.className = "verdict-side user-side";
  appendVerdictSection(userCol, "h3", "How you argued");
  appendVerdictSection(userCol, "p", verdict.userSummary);
  const oppCol = document.createElement("div");
  oppCol.className = "verdict-side opponent-side";
  appendVerdictSection(oppCol, "h3", "How the opponent argued");
  appendVerdictSection(oppCol, "p", verdict.opponentSummary);
  sides.appendChild(userCol);
  sides.appendChild(oppCol);
  verdictContent.appendChild(sides);

  const manip = document.createElement("div");
  manip.className = "verdict-block";
  appendVerdictSection(manip, "h3", "Who manipulated");
  appendVerdictSection(manip, "p", verdict.manipulation);
  verdictContent.appendChild(manip);

  const reveal = document.createElement("div");
  reveal.className = "verdict-block reveal";
  appendVerdictSection(reveal, "h3", "Every technique the opponent used");
  if (verdict.opponentTechniqueList?.length) {
    const list = document.createElement("ul");
    list.className = "technique-tally";
    for (const t of verdict.opponentTechniqueList) {
      const item = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = t.name;
      const count = document.createElement("span");
      count.className = "tally-count";
      count.textContent = `× ${t.count}`;
      item.appendChild(name);
      item.appendChild(count);
      list.appendChild(item);
    }
    reveal.appendChild(list);
  } else {
    appendVerdictSection(reveal, "p", "The opponent used no techniques.");
  }
  verdictContent.appendChild(reveal);

  verdictPanel.hidden = false;
  verdictPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function appendVerdictSection(parent, tag, text) {
  const element = document.createElement(tag);
  element.textContent = text;
  parent.appendChild(element);
  return element;
}

document.getElementById("new-debate-button").addEventListener("click", () => {
  state.history = [];
  state.verdict = null;
  state.status = "setup";
  debateScreen.hidden = true;
  setupScreen.hidden = false;
  updateStartButton();
});

// --- Judge analysis column --------------------------------------------------

// One card per exchange, collapsed behind "Show analysis" so the user can
// first try to spot the techniques themselves.
function addAnalysisCard(exchangeNumber, analysis) {
  const card = document.createElement("details");
  card.className = "analysis-card";

  const summary = document.createElement("summary");
  const title = document.createElement("span");
  title.className = "card-title";
  title.textContent = `Exchange ${exchangeNumber}`;
  const toggle = document.createElement("span");
  toggle.className = "card-toggle";
  summary.appendChild(title);
  summary.appendChild(toggle);
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
    if (line instanceof Node) {
      section.appendChild(line);
      continue;
    }
    const paragraph = document.createElement("p");
    paragraph.textContent = line;
    section.appendChild(paragraph);
  }
  return section;
}

// Each technique: its name, the exact quote, and the judge's short note.
function formatTechniques(list, detailField) {
  if (!list || !list.length) {
    const none = document.createElement("p");
    none.className = "none";
    none.textContent = "None spotted.";
    return [none];
  }
  return list.map((t) => {
    const item = document.createElement("div");
    item.className = "technique";
    const name = document.createElement("p");
    name.className = "technique-name";
    name.textContent = t.name;
    const detail = t[detailField];
    if (detailField === "confidence" && detail) {
      const badge = document.createElement("span");
      badge.className = `confidence confidence-${detail}`;
      badge.textContent = detail;
      name.appendChild(badge);
    }
    item.appendChild(name);
    if (t.quote) {
      const quote = document.createElement("q");
      quote.className = "technique-quote";
      quote.textContent = t.quote;
      item.appendChild(quote);
    }
    if (detailField !== "confidence" && detail) {
      const note = document.createElement("p");
      note.className = "technique-note";
      note.textContent = detail;
      item.appendChild(note);
    }
    return item;
  });
}

loadTopics();
