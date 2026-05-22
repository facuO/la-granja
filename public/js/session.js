import { api } from "./api.js";

const params = new URLSearchParams(window.location.search);
const sessionId = params.get("id");
const stepsTotal = Number(params.get("total")) || 0;

const blockEl = document.getElementById("block");
const trailEl = document.getElementById("trail");
const advanceEl = document.getElementById("advance");

let stepIndex = 0;

function setTrail() {
  if (stepsTotal > 0) {
    trailEl.textContent = `Paso ${stepIndex + 1} de ${stepsTotal}`;
  } else {
    trailEl.textContent = `Paso ${stepIndex + 1}`;
  }
}

function renderExplanation(c) {
  const p = document.createElement("p");
  p.className = "block-text";
  p.textContent = c.text;
  blockEl.appendChild(p);
}

function renderVisual(c) {
  const wrap = document.createElement("div");
  wrap.className = "visual-card";
  const icon = document.createElement("div");
  icon.className = "visual-icon";
  icon.textContent = visualIcon(c.visual_kind);
  wrap.appendChild(icon);
  const caption = document.createElement("p");
  caption.className = "block-text";
  caption.textContent = c.caption;
  wrap.appendChild(caption);
  blockEl.appendChild(wrap);
}

function visualIcon(kind) {
  switch (kind) {
    case "map_argentina":
      return "🗺️";
    case "timeline":
      return "🕰️";
    case "region_grouping":
      return "🧩";
    case "comparison_table":
      return "📊";
    case "arrow_diagram":
      return "↗️";
    default:
      return "📷";
  }
}

function renderFeedback(c) {
  const p = document.createElement("p");
  p.className = "block-text";
  p.textContent = c.text;
  blockEl.appendChild(p);
}

function renderMultipleChoice(c) {
  const options = document.createElement("div");
  options.className = "options";
  c.options.forEach((label) => {
    const btn = document.createElement("button");
    btn.className = "option";
    btn.textContent = label;
    btn.addEventListener("click", () => {
      options.querySelectorAll(".option").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
    });
    options.appendChild(btn);
  });
  blockEl.appendChild(options);
}

function renderMultiSelect(c) {
  const options = document.createElement("div");
  options.className = "options";
  const selected = new Set();
  let validated = false;

  c.options.forEach((label, idx) => {
    const btn = document.createElement("button");
    btn.className = "option";
    btn.textContent = label;
    btn.dataset.idx = String(idx);
    btn.addEventListener("click", () => {
      if (validated) return;
      if (selected.has(idx)) {
        selected.delete(idx);
        btn.classList.remove("selected");
      } else {
        selected.add(idx);
        btn.classList.add("selected");
      }
    });
    options.appendChild(btn);
  });
  blockEl.appendChild(options);

  const verifyBtn = document.createElement("button");
  verifyBtn.className = "subtle";
  verifyBtn.textContent = "Verificar mis respuestas";
  verifyBtn.style.marginTop = "1rem";
  verifyBtn.addEventListener("click", () => {
    if (validated) return;
    validated = true;
    const correctSet = new Set(c.correct_indices);
    options.querySelectorAll(".option").forEach((btn) => {
      const idx = Number(btn.dataset.idx);
      btn.classList.remove("selected");
      if (correctSet.has(idx) && selected.has(idx)) {
        btn.classList.add("correct");
        btn.textContent = btn.textContent + "  ✓";
      } else if (correctSet.has(idx) && !selected.has(idx)) {
        btn.classList.add("missed");
        btn.textContent = btn.textContent + "  ← faltaba esta";
      } else if (!correctSet.has(idx) && selected.has(idx)) {
        btn.classList.add("wrong");
        btn.textContent = btn.textContent + "  (no es esta)";
      }
    });
    verifyBtn.style.display = "none";
  });
  blockEl.appendChild(verifyBtn);
}

function renderTrueFalse(c) {
  const options = document.createElement("div");
  options.className = "options";
  let validated = false;

  ["Verdadero", "Falso"].forEach((label, idx) => {
    const btn = document.createElement("button");
    btn.className = "option";
    btn.textContent = label;
    btn.addEventListener("click", () => {
      if (validated) return;
      validated = true;
      const isTrue = idx === 0;
      const correct = isTrue === c.correct;
      options.querySelectorAll(".option").forEach((b) => b.classList.remove("selected"));
      if (correct) {
        btn.classList.add("correct");
      } else {
        btn.classList.add("wrong");
        const correctBtn = options.children[c.correct ? 0 : 1];
        correctBtn.classList.add("correct");
      }
    });
    options.appendChild(btn);
  });
  blockEl.appendChild(options);
}

function renderQuestion(c) {
  const p = document.createElement("p");
  p.className = "block-text";
  p.textContent = c.text;
  blockEl.appendChild(p);

  if (c.kind === "multi_select") {
    renderMultiSelect(c);
  } else if (c.kind === "true_false") {
    renderTrueFalse(c);
  } else {
    renderMultipleChoice(c);
  }
}

function renderBlock(block) {
  blockEl.innerHTML = "";
  if (block.block_kind === "explanation") {
    renderExplanation(block.content);
  } else if (block.block_kind === "visual") {
    renderVisual(block.content);
  } else if (block.block_kind === "question") {
    renderQuestion(block.content);
  } else if (block.block_kind === "feedback") {
    renderFeedback(block.content);
  }
}

function renderAdvance(label, handler) {
  advanceEl.innerHTML = "";
  const btn = document.createElement("button");
  btn.textContent = label;
  btn.addEventListener("click", handler);
  advanceEl.appendChild(btn);
}

async function nextBlock() {
  const res = await api(`/api/sofi/sessions/${sessionId}/next-block`, { method: "POST" });
  if (res.done) {
    await finishSession();
    return;
  }
  renderBlock(res.block);
  stepIndex = res.stepIndex + 1;
  setTrail();
  renderAdvance("Listo", nextBlock);
}

async function finishSession() {
  const { summary } = await api(`/api/sofi/sessions/${sessionId}/finish`, { method: "POST" });
  blockEl.innerHTML = `
    <h2>¡Terminaste!</h2>
    <ul class="summary-list"><li>${escapeHtml(summary)}</li></ul>
  `;
  trailEl.textContent = "";
  renderAdvance("Cerrar", () => { window.location.href = "/sofi.html"; });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

if (!sessionId) {
  blockEl.textContent = "Falta el id de la sesión.";
} else {
  nextBlock();
}
