import { api, NoAccessError } from "./api.js";

const params = new URLSearchParams(window.location.search);
const topicId = params.get("topic");

const statusEl = document.getElementById("status");
const worksheetEl = document.getElementById("worksheet");
const printBtn = document.getElementById("print-btn");
const toggleKey = document.getElementById("toggle-key");

let loaded = null; // { title, subject_name, blocks }

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function optionLabel(opt) {
  // opciones pueden ser string o { label, image }
  return typeof opt === "string" ? opt : (opt?.label ?? "");
}

function render() {
  if (!loaded) return;
  const { title, blocks } = loaded;
  const showKey = toggleKey.checked;

  const explanations = blocks.filter((b) => b.block_kind === "explanation");
  const questions = blocks.filter((b) => b.block_kind === "question");

  // Recordatorio: primeras 3 explanations como repaso
  const recordar = explanations.slice(0, 3).map((b) => `<li>${esc(b.content.text)}</li>`).join("");

  let html = `
    <div class="ws-header">
      <h1>${esc(title)}</h1>
      <div class="ws-meta">Nombre: ____________________  ·  Fecha: ____ / ____ / ______</div>
    </div>`;

  if (recordar) {
    html += `<div class="ws-recordar"><h3>📖 Recordá</h3><ul>${recordar}</ul></div>`;
  }

  const answerKey = [];
  questions.forEach((q, i) => {
    const c = q.content;
    const n = i + 1;
    html += `<div class="ws-item"><span class="ws-num">${n})</span> ${esc(c.text)}`;

    if (c.kind === "multiple_choice") {
      html += `<div class="ws-opts">`;
      c.options.forEach((opt) => {
        html += `<div class="ws-opt"><span class="ws-mark circle"></span> ${esc(optionLabel(opt))}</div>`;
      });
      html += `</div>`;
      answerKey.push(`${n}) ${esc(optionLabel(c.options[c.correct_index]))}`);
    } else if (c.kind === "multi_select") {
      html += `<div class="ws-opts">`;
      c.options.forEach((opt) => {
        html += `<div class="ws-opt"><span class="ws-mark"></span> ${esc(optionLabel(opt))}</div>`;
      });
      html += `</div>`;
      const correct = c.correct_indices.map((idx) => esc(optionLabel(c.options[idx]))).join(", ");
      answerKey.push(`${n}) ${correct}`);
    } else if (c.kind === "true_false") {
      html += `<div class="ws-vf"><span>Verdadero</span><span>Falso</span></div>`;
      answerKey.push(`${n}) ${c.correct ? "Verdadero" : "Falso"}`);
    } else {
      html += `<div class="ws-line"></div>`;
    }
    html += `</div>`;
  });

  html += `<p class="ws-footer">Tomate tu tiempo. No hay apuro. Podés contar con los dedos o hacer dibujos.</p>`;

  if (showKey && answerKey.length) {
    html += `<div class="answer-key"><h2>🔑 Clave (para la docente)</h2><p>${answerKey.join("<br>")}</p></div>`;
  }

  worksheetEl.innerHTML = html;
}

async function init() {
  if (!topicId) {
    statusEl.textContent = "Falta el parámetro ?topic=<id>";
    return;
  }
  try {
    const res = await api(`/api/admin/topics/${topicId}/blocks`);
    loaded = res;
    statusEl.textContent = `${res.subject_name} · ${res.title}`;
    printBtn.disabled = false;
    render();
  } catch (err) {
    if (err instanceof NoAccessError) {
      statusEl.textContent = "Necesitás iniciar sesión como Papá (entrá a /admin.html con la contraseña primero).";
    } else {
      statusEl.textContent = "No se pudo cargar. " + err.message;
    }
  }
}

printBtn.addEventListener("click", () => window.print());
toggleKey.addEventListener("change", render);

init();
