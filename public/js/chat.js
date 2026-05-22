import { api } from "./api.js";

const conversationEl = document.getElementById("conversation");
const formEl = document.getElementById("chat-form");
const inputEl = document.getElementById("chat-input");
const sendEl = document.getElementById("chat-send");
const introEl = conversationEl.querySelector(".chat-intro");

// History persists in sessionStorage so a hard refresh keeps the conversation;
// closing the tab clears it (ephemeral, no DB).
const STORAGE_KEY = "sofi_chat_history_v1";
let history = loadHistory();

function loadHistory() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    /* ignore quota errors */
  }
}

// --- Rendering ---

const MAX_CELLS_PER_LINE = 6;

function renderUserBubble(text) {
  const bubble = document.createElement("div");
  bubble.className = "chat-bubble chat-bubble-user";
  bubble.textContent = text;
  conversationEl.appendChild(bubble);
}

function renderPhraseTable(phrase, container) {
  // Same SAAC-style table layout as session blocks.
  const initialLines = [[]];
  for (const unit of phrase) {
    if (unit && unit.break) initialLines.push([]);
    else if (unit && typeof unit.word === "string") {
      initialLines[initialLines.length - 1].push(unit);
    }
  }
  const lines = [];
  for (const line of initialLines) {
    if (!line.length) continue;
    for (let i = 0; i < line.length; i += MAX_CELLS_PER_LINE) {
      lines.push(line.slice(i, i + MAX_CELLS_PER_LINE));
    }
  }

  const wrap = document.createElement("div");
  wrap.className = "phrase";

  for (const line of lines) {
    const lineEl = document.createElement("div");
    lineEl.className = "phrase-line";
    lineEl.style.gridTemplateColumns = `repeat(${line.length}, minmax(0, 1fr))`;
    for (const unit of line) {
      const cell = document.createElement("div");
      cell.className = "phrase-cell" + (unit.pic ? "" : " no-pic");
      const picCell = document.createElement("div");
      picCell.className = "phrase-pic-cell";
      if (unit.pic) {
        const img = document.createElement("img");
        img.src = `https://static.arasaac.org/pictograms/${unit.pic}/${unit.pic}_300.png`;
        img.alt = unit.word;
        img.loading = "lazy";
        img.className = "phrase-pic";
        picCell.appendChild(img);
      }
      cell.appendChild(picCell);
      const wordCell = document.createElement("div");
      wordCell.className = "phrase-word-cell";
      wordCell.textContent = unit.word;
      cell.appendChild(wordCell);
      lineEl.appendChild(cell);
    }
    wrap.appendChild(lineEl);
  }
  container.appendChild(wrap);
}

function renderAssistantTurn(reply) {
  const card = document.createElement("div");
  card.className = "chat-bubble chat-bubble-assistant";
  if (Array.isArray(reply.phrase) && reply.phrase.length > 0) {
    renderPhraseTable(reply.phrase, card);
  } else {
    const p = document.createElement("p");
    p.textContent = reply.text;
    card.appendChild(p);
  }
  conversationEl.appendChild(card);
}

function renderPending() {
  const card = document.createElement("div");
  card.className = "chat-bubble chat-bubble-assistant chat-pending";
  card.id = "chat-pending";
  card.textContent = "Pensando...";
  conversationEl.appendChild(card);
}

function removePending() {
  document.getElementById("chat-pending")?.remove();
}

function scrollToBottom() {
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
}

function hideIntro() {
  if (introEl) introEl.style.display = "none";
}

// --- Replay history on load ---

function replay() {
  if (history.length > 0) {
    hideIntro();
    for (const m of history) {
      if (m.role === "user") {
        renderUserBubble(m.content);
      } else {
        renderAssistantTurn({ text: m.content, phrase: m.phrase });
      }
    }
    scrollToBottom();
  }
}

// --- Send flow ---

async function sendMessage(message) {
  const trimmed = message.trim();
  if (!trimmed) return;
  hideIntro();

  // Optimistic UI: show user bubble immediately
  renderUserBubble(trimmed);
  history.push({ role: "user", content: trimmed });
  saveHistory();
  scrollToBottom();

  inputEl.value = "";
  inputEl.disabled = true;
  sendEl.disabled = true;
  renderPending();
  scrollToBottom();

  try {
    // Only send roles + content to server (no phrase in user-side).
    const cleanHistory = history.slice(0, -1).map((m) => ({
      role: m.role,
      content: m.content,
    }));
    const res = await api("/api/sofi/chat", {
      method: "POST",
      body: { history: cleanHistory, message: trimmed },
    });
    removePending();
    renderAssistantTurn(res);
    history.push({
      role: "assistant",
      content: res.text,
      phrase: res.phrase,
    });
    saveHistory();
    scrollToBottom();
  } catch (err) {
    removePending();
    const errCard = document.createElement("div");
    errCard.className = "chat-bubble chat-bubble-assistant chat-error";
    errCard.textContent = "No pude responder. Probá de nuevo.";
    conversationEl.appendChild(errCard);
    console.error(err);
  } finally {
    inputEl.disabled = false;
    sendEl.disabled = false;
    inputEl.focus();
  }
}

formEl.addEventListener("submit", (e) => {
  e.preventDefault();
  sendMessage(inputEl.value);
});

document.querySelectorAll(".suggestion").forEach((btn) => {
  btn.addEventListener("click", () => {
    sendMessage(btn.dataset.q || btn.textContent || "");
  });
});

replay();
inputEl.focus();
