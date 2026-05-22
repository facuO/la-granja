import { api } from "./api.js";

const params = new URLSearchParams(window.location.search);
const sessionId = params.get("id");

const blockEl = document.getElementById("block");
const trailEl = document.getElementById("trail");
const advanceEl = document.getElementById("advance");

let stepIndex = 0;
const stepsTotal = 4;

function setTrail() {
  trailEl.textContent = `Paso ${stepIndex + 1} de ${stepsTotal}`;
}

function renderBlock(block) {
  blockEl.innerHTML = "";
  if (block.block_kind === "explanation") {
    const p = document.createElement("p");
    p.className = "block-text";
    p.textContent = block.content.text;
    blockEl.appendChild(p);
  } else if (block.block_kind === "visual") {
    const placeholder = document.createElement("div");
    placeholder.className = "block-visual-placeholder";
    placeholder.textContent = `[ ${block.content.visual_kind} ]`;
    blockEl.appendChild(placeholder);
    const caption = document.createElement("p");
    caption.className = "block-text";
    caption.textContent = block.content.caption;
    blockEl.appendChild(caption);
  } else if (block.block_kind === "question") {
    const p = document.createElement("p");
    p.className = "block-text";
    p.textContent = block.content.text;
    blockEl.appendChild(p);
    const options = document.createElement("div");
    options.className = "options";
    block.content.options.forEach((label) => {
      const btn = document.createElement("button");
      btn.className = "option";
      btn.textContent = label;
      btn.addEventListener("click", () => {
        document.querySelectorAll(".option").forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
      });
      options.appendChild(btn);
    });
    blockEl.appendChild(options);
  } else if (block.block_kind === "feedback") {
    const p = document.createElement("p");
    p.className = "block-text";
    p.textContent = block.content.text;
    blockEl.appendChild(p);
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
