import { api } from "./api.js";

const params = new URLSearchParams(window.location.search);
const sessionId = params.get("id");
const stepsTotal = Number(params.get("total")) || 0;

const blockEl = document.getElementById("block");
const trailEl = document.getElementById("trail");
const advanceEl = document.getElementById("advance");

let stepIndex = 0;

// -------- Trail / progress --------

function setTrail() {
  if (stepsTotal > 0) {
    trailEl.textContent = `Paso ${stepIndex + 1} de ${stepsTotal}`;
  } else {
    trailEl.textContent = `Paso ${stepIndex + 1}`;
  }
}

// -------- Advance button --------

function renderAdvance(label, handler, opts = {}) {
  advanceEl.innerHTML = "";
  if (opts.secondary) {
    const sec = document.createElement("button");
    sec.className = "subtle";
    sec.textContent = opts.secondary.label;
    sec.addEventListener("click", opts.secondary.handler);
    advanceEl.appendChild(sec);
  }
  const btn = document.createElement("button");
  btn.textContent = label;
  if (opts.disabled) {
    btn.disabled = true;
    btn.classList.add("is-disabled");
  } else if (handler) {
    btn.addEventListener("click", handler);
  }
  advanceEl.appendChild(btn);
}

// -------- Block renderers --------

function renderExplanation(c) {
  if (Array.isArray(c.phrase) && c.phrase.length > 0) {
    renderPhrase(c.phrase);
  } else {
    const p = document.createElement("p");
    p.className = "block-text";
    p.textContent = c.text;
    blockEl.appendChild(p);
  }
}

function renderPhrase(phrase) {
  const wrap = document.createElement("div");
  wrap.className = "phrase";
  phrase.forEach((unit) => {
    if (unit && unit.break) {
      const br = document.createElement("div");
      br.className = "phrase-break";
      wrap.appendChild(br);
      return;
    }
    if (!unit || typeof unit.word !== "string") return;
    const cell = document.createElement("div");
    cell.className = "phrase-cell" + (unit.pic ? "" : " no-pic");
    if (unit.pic) {
      const img = document.createElement("img");
      img.src = `https://static.arasaac.org/pictograms/${unit.pic}/${unit.pic}_300.png`;
      img.alt = unit.word;
      img.loading = "lazy";
      img.className = "phrase-pic";
      cell.appendChild(img);
    }
    const w = document.createElement("span");
    w.className = "phrase-word";
    w.textContent = unit.word;
    cell.appendChild(w);
    wrap.appendChild(cell);
  });
  blockEl.appendChild(wrap);
}

function renderVisual(c) {
  const wrap = document.createElement("div");
  wrap.className = "visual-card";
  const header = document.createElement("div");
  header.className = "visual-header";
  header.textContent = "📖 Mirá tu cuaderno";
  wrap.appendChild(header);
  const caption = document.createElement("p");
  caption.className = "block-text visual-caption";
  caption.textContent = c.caption;
  wrap.appendChild(caption);
  blockEl.appendChild(wrap);
}

function renderFeedback(c) {
  const p = document.createElement("p");
  p.className = "block-text";
  p.textContent = c.text;
  blockEl.appendChild(p);
}

// -------- Question logic --------

function getCorrectSet(c) {
  if (c.kind === "multi_select") return new Set(c.correct_indices);
  if (c.kind === "multiple_choice") return new Set([c.correct_index]);
  if (c.kind === "true_false") return new Set([c.correct ? 0 : 1]);
  return new Set();
}

function buildInlineFeedback(c, selected, labels) {
  if (c.kind === "true_false") {
    const chose = selected.has(0) ? "Verdadero" : "Falso";
    const correctLabel = c.correct ? "Verdadero" : "Falso";
    const right = (c.correct && selected.has(0)) || (!c.correct && selected.has(1));
    if (right) return `Acertaste. La respuesta es ${correctLabel}.`;
    return `Tu respuesta fue ${chose}. La correcta es ${correctLabel}.`;
  }
  if (c.kind === "multiple_choice") {
    const choseIdx = [...selected][0];
    const chose = labels[choseIdx];
    const correct = labels[c.correct_index];
    if (choseIdx === c.correct_index) return `Bien. La respuesta es "${correct}".`;
    return `Marcaste "${chose}". La correcta es "${correct}".`;
  }
  if (c.kind === "multi_select") {
    const correctSet = new Set(c.correct_indices);
    const right = [...selected].filter((i) => correctSet.has(i)).length;
    const wrong = [...selected].filter((i) => !correctSet.has(i)).length;
    const missing = [...correctSet].filter((i) => !selected.has(i)).length;
    if (wrong === 0 && missing === 0) {
      return `Marcaste todas bien. ¡Perfecto!`;
    }
    const parts = [];
    if (right > 0) parts.push(`acertaste ${right}`);
    if (missing > 0) parts.push(`te faltaron ${missing}`);
    if (wrong > 0) parts.push(`marcaste de más ${wrong}`);
    return "Casi: " + parts.join(", ") + ".";
  }
  return "";
}

function renderQuestion(c) {
  const p = document.createElement("p");
  p.className = "block-text question-text";
  p.textContent = c.text;
  blockEl.appendChild(p);

  const optionsEl = document.createElement("div");
  optionsEl.className = "options";
  blockEl.appendChild(optionsEl);

  const feedbackEl = document.createElement("div");
  feedbackEl.className = "inline-feedback";
  blockEl.appendChild(feedbackEl);

  const labels = c.kind === "true_false" ? ["Verdadero", "Falso"] : c.options;
  const isMulti = c.kind === "multi_select";
  let selected = new Set();
  let validated = false;

  function paintOptions() {
    optionsEl.querySelectorAll(".option").forEach((btn, idx) => {
      btn.classList.remove("selected", "correct", "missed", "wrong");
      if (!validated) {
        if (selected.has(idx)) btn.classList.add("selected");
      } else {
        const correctSet = getCorrectSet(c);
        const wasSelected = selected.has(idx);
        const isCorrect = correctSet.has(idx);
        if (isCorrect && wasSelected) btn.classList.add("correct");
        else if (isCorrect && !wasSelected) btn.classList.add("missed");
        else if (!isCorrect && wasSelected) btn.classList.add("wrong");
      }
    });
  }

  labels.forEach((label, idx) => {
    const btn = document.createElement("button");
    btn.className = "option";
    btn.textContent = label;
    btn.addEventListener("click", () => {
      if (validated) return;
      if (isMulti) {
        if (selected.has(idx)) selected.delete(idx);
        else selected.add(idx);
      } else {
        selected.clear();
        selected.add(idx);
      }
      paintOptions();
      refreshAdvance();
    });
    optionsEl.appendChild(btn);
  });

  function refreshAdvance() {
    if (validated) {
      renderAdvance("Continuar", nextBlock, {
        secondary: { label: "Cambiar mi respuesta", handler: reset },
      });
    } else if (selected.size > 0) {
      renderAdvance("Listo", validateAndShow);
    } else {
      renderAdvance("Listo", null, { disabled: true });
    }
  }

  function validateAndShow() {
    validated = true;
    paintOptions();
    feedbackEl.textContent = buildInlineFeedback(c, selected, labels);
    refreshAdvance();
  }

  function reset() {
    validated = false;
    selected.clear();
    feedbackEl.textContent = "";
    paintOptions();
    refreshAdvance();
  }

  refreshAdvance();
}

// -------- Block dispatch --------

function renderBlock(block) {
  blockEl.innerHTML = "";
  if (block.block_kind === "explanation") {
    renderExplanation(block.content);
    renderAdvance("Listo", nextBlock);
  } else if (block.block_kind === "visual") {
    renderVisual(block.content);
    renderAdvance("Listo", nextBlock);
  } else if (block.block_kind === "question") {
    renderQuestion(block.content);
    // renderQuestion controls its own advance state
  } else if (block.block_kind === "feedback") {
    renderFeedback(block.content);
    renderAdvance("Listo", nextBlock);
  }
}

// -------- Session flow --------

async function nextBlock() {
  const res = await api(`/api/sofi/sessions/${sessionId}/next-block`, { method: "POST" });
  if (res.done) {
    await finishSession();
    return;
  }
  renderBlock(res.block);
  stepIndex = res.stepIndex + 1;
  setTrail();
}

async function finishSession() {
  const { summary } = await api(`/api/sofi/sessions/${sessionId}/finish`, { method: "POST" });
  blockEl.innerHTML = `
    <h2>¡Terminaste!</h2>
    <ul class="summary-list"><li>${escapeHtml(summary)}</li></ul>
  `;
  trailEl.textContent = "";
  renderAdvance("Cerrar", () => {
    window.location.href = "/sofi.html";
  });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

if (!sessionId) {
  blockEl.textContent = "Falta el id de la sesión.";
} else {
  nextBlock();
}
