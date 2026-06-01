// Aventura del Pollito — platformer multi-mundo accesible para Sofi.
//
// Iteración 3:
//  - Catálogo de mundos (data-driven). Cada uno con tema, layout, desafío.
//  - Selector inicial con 4 mundos. Mundos completados quedan marcados.
//  - Persistencia simple en localStorage.
//  - Tipos de desafío:
//      a) Puerta de conteo: juntar N huevos para abrirla (Corral).
//      b) Quiz in-game: pollito toca una "tabla" → pausa con pregunta
//         de Lengua/Mate, contesta correcta = sigue (Campo, Estanque...).
//  - Cada mundo termina con un banderín.
//
// Iteración 4 (audio):
//  - Web Audio API: melodía granjera + SFX (salto, huevo, puerta, win, quiz).
//  - Default muted. Toggle 🔇/🔊 en el HUD. Persiste preferencia.

import { sfx, startMusic, stopMusic, isMuted, toggleMute } from "/js/juego-pollito-audio.js";

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const hudEl = document.getElementById("hud");
const worldPillEl = document.getElementById("world-pill");
const selectOverlay = document.getElementById("select-overlay");
const worldGrid = document.getElementById("world-grid");
const quizOverlay = document.getElementById("quiz-overlay");
const quizQEl = document.getElementById("quiz-question");
const quizOptsEl = document.getElementById("quiz-options");
const quizFbEl = document.getElementById("quiz-feedback");
const winOverlay = document.getElementById("win-overlay");
const winTitleEl = document.getElementById("win-title");
const winMsgEl = document.getElementById("win-msg");
const restartBtn = document.getElementById("restart-btn");
const backToSelectBtn = document.getElementById("back-to-select");
const audioBtn = document.getElementById("audio-btn");

// Botón audio
function refreshAudioBtn() {
  audioBtn.textContent = isMuted() ? "🔇" : "🔊";
  audioBtn.setAttribute("aria-label", isMuted() ? "Encender música" : "Apagar música");
}
audioBtn.addEventListener("click", () => {
  toggleMute();
  refreshAudioBtn();
});
refreshAudioBtn();

// --- Constantes físicas ---
const VIEW_W = canvas.width;
const VIEW_H = canvas.height;
const GRAVITY = 0.55;
const MOVE_SPEED = 3.4;
const JUMP_VY = -11.5;
const MAX_FALL = 12;

// --- Catálogo de mundos ---
const WORLDS = [
  {
    id: "corral",
    name: "El Corral",
    emoji: "🐔",
    hint: "Juntá 4 huevos para abrir la puerta y llegar al banderín.",
    width: 2200,
    theme: {
      groundGrass: "#6cb35e", groundDirt: "#8b5a2b",
      cloud: "rgba(255,255,255,0.85)",
    },
    platforms: [
      { x: 0,    y: 460, w: 700,  h: 40, kind: "grass" },
      { x: 820,  y: 460, w: 700,  h: 40, kind: "grass" },
      { x: 1640, y: 460, w: 600,  h: 40, kind: "grass" },
      { x: 130,  y: 380, w: 120, h: 18, kind: "wood" },
      { x: 320,  y: 330, w: 120, h: 18, kind: "wood" },
      { x: 520,  y: 280, w: 120, h: 18, kind: "wood" },
      { x: 720,  y: 380, w: 80,  h: 18, kind: "wood" },
      { x: 830,  y: 320, w: 80,  h: 18, kind: "wood" },
      { x: 980,  y: 380, w: 120, h: 18, kind: "wood" },
      { x: 1180, y: 320, w: 120, h: 18, kind: "wood" },
      { x: 1340, y: 260, w: 120, h: 18, kind: "wood" },
      { x: 1720, y: 380, w: 120, h: 18, kind: "wood" },
      { x: 1900, y: 320, w: 100, h: 18, kind: "wood" },
    ],
    eggs: [
      { x: 180,  y: 350 }, { x: 370,  y: 300 }, { x: 580,  y: 250 },
      { x: 1040, y: 350 }, { x: 1240, y: 290 }, { x: 1400, y: 230 },
    ],
    door: { x: 1530, y: 360, w: 30, h: 100, eggs_required: 4 },
    quiz: null,
    flag: { x: 2090, y: 360, w: 24, h: 100 },
  },

  {
    id: "campo",
    name: "El Campo",
    emoji: "🌾",
    hint: "Tocá la tabla con la pregunta y respondela para seguir.",
    width: 2200,
    theme: {
      groundGrass: "#a3c46a", groundDirt: "#7a5a2b",
      cloud: "rgba(255,255,255,0.85)",
    },
    platforms: [
      { x: 0,    y: 460, w: 900,  h: 40, kind: "grass" },
      { x: 1020, y: 460, w: 700,  h: 40, kind: "grass" },
      { x: 1820, y: 460, w: 400,  h: 40, kind: "grass" },
      { x: 200, y: 370, w: 120, h: 18, kind: "wood" },
      { x: 400, y: 310, w: 120, h: 18, kind: "wood" },
      { x: 600, y: 250, w: 120, h: 18, kind: "wood" },
      { x: 920, y: 380, w: 80,  h: 18, kind: "wood" },
      { x: 1100, y: 330, w: 120, h: 18, kind: "wood" },
      { x: 1300, y: 270, w: 120, h: 18, kind: "wood" },
      { x: 1500, y: 220, w: 120, h: 18, kind: "wood" },
      { x: 1730, y: 380, w: 80,  h: 18, kind: "wood" },
      { x: 1900, y: 320, w: 100, h: 18, kind: "wood" },
    ],
    eggs: [
      { x: 250, y: 340 }, { x: 450, y: 280 }, { x: 1140, y: 300 }, { x: 1340, y: 240 },
    ],
    door: null,
    quiz: {
      x: 1650, y: 380, w: 40, h: 80,
      question: "¿Cuál es un SUSTANTIVO?",
      options: ["come", "perro", "rápido"],
      correct: 1,
      feedback_ok: "¡Sí! 'Perro' es un sustantivo: nombra a un animal.",
      feedback_no: "Esa palabra no es un sustantivo. Probá otra.",
    },
    flag: { x: 2090, y: 360, w: 24, h: 100 },
  },

  {
    id: "estanque",
    name: "El Estanque",
    emoji: "🦆",
    hint: "Resolvé la suma para construir el puente y llegar al banderín.",
    width: 2200,
    theme: {
      groundGrass: "#6cb35e", groundDirt: "#5d7e3f",
      cloud: "rgba(230,245,255,0.95)",
    },
    platforms: [
      { x: 0,    y: 460, w: 1000, h: 40, kind: "grass" },
      // El "puente" se construye al resolver el quiz (placeholder fijo por ahora)
      { x: 1200, y: 460, w: 1000, h: 40, kind: "grass" },
      { x: 200, y: 370, w: 120, h: 18, kind: "wood" },
      { x: 420, y: 310, w: 120, h: 18, kind: "wood" },
      { x: 640, y: 250, w: 120, h: 18, kind: "wood" },
      { x: 1300, y: 380, w: 120, h: 18, kind: "wood" },
      { x: 1520, y: 320, w: 120, h: 18, kind: "wood" },
      { x: 1740, y: 260, w: 120, h: 18, kind: "wood" },
    ],
    eggs: [
      { x: 250, y: 340 }, { x: 470, y: 280 }, { x: 1360, y: 350 },
    ],
    door: null,
    quiz: {
      x: 950, y: 380, w: 40, h: 80,
      question: "¿Cuánto es 12 + 8?",
      options: ["18", "20", "22"],
      correct: 1,
      feedback_ok: "¡Sí! 12 + 8 son 20. El puente está armado.",
      feedback_no: "Ese no es el resultado. Probá otra vez.",
    },
    flag: { x: 2080, y: 360, w: 24, h: 100 },
  },

  {
    id: "granero",
    name: "El Granero",
    emoji: "🏚️",
    hint: "Identificá el animal correcto y abrí el granero.",
    width: 2200,
    theme: {
      groundGrass: "#8da34c", groundDirt: "#6b4226",
      cloud: "rgba(255,250,230,0.9)",
    },
    platforms: [
      { x: 0,    y: 460, w: 1100, h: 40, kind: "grass" },
      { x: 1240, y: 460, w: 600,  h: 40, kind: "grass" },
      { x: 1960, y: 460, w: 260,  h: 40, kind: "grass" },
      { x: 220, y: 380, w: 120, h: 18, kind: "wood" },
      { x: 420, y: 320, w: 120, h: 18, kind: "wood" },
      { x: 620, y: 260, w: 120, h: 18, kind: "wood" },
      { x: 820, y: 320, w: 120, h: 18, kind: "wood" },
      { x: 1340, y: 380, w: 120, h: 18, kind: "wood" },
      { x: 1540, y: 320, w: 120, h: 18, kind: "wood" },
      { x: 1740, y: 260, w: 120, h: 18, kind: "wood" },
    ],
    eggs: [
      { x: 270, y: 350 }, { x: 470, y: 290 }, { x: 670, y: 230 }, { x: 1390, y: 350 },
    ],
    door: null,
    quiz: {
      x: 1170, y: 380, w: 40, h: 80,
      question: "¿Qué animal pone huevos?",
      options: ["vaca", "gallina", "caballo"],
      correct: 1,
      feedback_ok: "¡Sí! Las gallinas son las que ponen huevos.",
      feedback_no: "Ese animal no pone huevos. Probá otra vez.",
    },
    flag: { x: 2100, y: 360, w: 24, h: 100 },
  },
];

// --- Estado ---
const state = {
  scene: "select",      // "select" | "playing" | "quiz" | "won"
  worldIdx: -1,
  world: null,
  player: { x: 60, y: 420, w: 36, h: 36, vx: 0, vy: 0, onGround: false, facing: 1, flap: 0 },
  camera: { x: 0 },
  eggs: [], door: null, quiz: null, flag: null, platforms: [], theme: null,
  collected: 0,
  quizSolved: false,
  hint: "",
};

// --- Persistencia simple ---
function loadCompleted() {
  try { return new Set(JSON.parse(localStorage.getItem("pollito_done") || "[]")); }
  catch { return new Set(); }
}
function saveCompleted(set) {
  try { localStorage.setItem("pollito_done", JSON.stringify([...set])); } catch {}
}

// --- Selector de mundos ---
function renderSelector() {
  const done = loadCompleted();
  worldGrid.innerHTML = "";
  WORLDS.forEach((w, idx) => {
    const card = document.createElement("button");
    card.className = "world-pick" + (done.has(w.id) ? " done" : "");
    card.innerHTML = `
      <span class="world-pick-emoji">${w.emoji}</span>
      <span class="world-pick-name">${w.name}</span>
      <span class="world-pick-status">${done.has(w.id) ? "✓ Completado" : "Disponible"}</span>
    `;
    card.addEventListener("click", () => startWorld(idx));
    worldGrid.appendChild(card);
  });
  selectOverlay.classList.add("shown");
  hudEl.textContent = "";
  worldPillEl.textContent = "";
}

function showSelector() {
  state.scene = "select";
  winOverlay.classList.remove("shown");
  quizOverlay.classList.remove("shown");
  stopMusic();
  renderSelector();
}

// --- Iniciar mundo ---
function startWorld(idx) {
  const w = WORLDS[idx];
  state.scene = "playing";
  state.worldIdx = idx;
  state.world = w;
  state.platforms = w.platforms;
  state.eggs = w.eggs.map((e) => ({ ...e, taken: false }));
  state.door = w.door ? { ...w.door, opened: false } : null;
  state.quiz = w.quiz ? { ...w.quiz, solved: false } : null;
  state.flag = w.flag;
  state.theme = w.theme;
  state.player.x = 60; state.player.y = 420;
  state.player.vx = 0; state.player.vy = 0; state.player.onGround = false;
  state.camera.x = 0;
  state.collected = 0;
  state.quizSolved = false;
  state.hint = w.hint;
  selectOverlay.classList.remove("shown");
  winOverlay.classList.remove("shown");
  quizOverlay.classList.remove("shown");
  worldPillEl.textContent = `${w.emoji} ${w.name}`;
  updateHud();
  startMusic();
}

function updateHud() {
  if (state.scene !== "playing") { hudEl.textContent = ""; return; }
  let txt = `🥚 ${state.collected}`;
  if (state.eggs.length) txt += ` / ${state.eggs.length}`;
  if (state.door && !state.door.opened) txt += `  ·  🚪 faltan ${Math.max(0, state.door.eggs_required - state.collected)}`;
  hudEl.textContent = txt;
}

// --- Quiz overlay ---
function openQuiz() {
  state.scene = "quiz";
  quizQEl.textContent = state.quiz.question;
  quizFbEl.textContent = "";
  quizOptsEl.innerHTML = "";
  state.quiz.options.forEach((opt, idx) => {
    const b = document.createElement("button");
    b.className = "quiz-opt";
    b.textContent = opt;
    b.addEventListener("click", () => answerQuiz(idx));
    quizOptsEl.appendChild(b);
  });
  quizOverlay.classList.add("shown");
}

function answerQuiz(idx) {
  if (idx === state.quiz.correct) {
    state.quiz.solved = true;
    state.quizSolved = true;
    quizFbEl.textContent = state.quiz.feedback_ok;
    sfx.quizOk();
    setTimeout(() => {
      quizOverlay.classList.remove("shown");
      state.scene = "playing";
      // Empujar al pollito a la derecha del quiz para que pase
      state.player.x = state.quiz.x + state.quiz.w + 5;
      state.hint = "¡Bien! Andá hasta el banderín.";
    }, 1200);
  } else {
    quizFbEl.textContent = state.quiz.feedback_no;
    sfx.quizNo();
  }
}

// --- Input ---
const keys = { left: false, right: false, jump: false };
function setKey(name, val) { keys[name] = val; }
window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" || e.key === "a") setKey("left", true);
  if (e.key === "ArrowRight" || e.key === "d") setKey("right", true);
  if (e.key === "ArrowUp" || e.key === "w" || e.key === " ") { setKey("jump", true); e.preventDefault(); }
});
window.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft" || e.key === "a") setKey("left", false);
  if (e.key === "ArrowRight" || e.key === "d") setKey("right", false);
  if (e.key === "ArrowUp" || e.key === "w" || e.key === " ") setKey("jump", false);
});
function bindButton(id, name) {
  const btn = document.getElementById(id);
  if (!btn) return;
  const on = (e) => { e.preventDefault(); setKey(name, true); };
  const off = (e) => { e.preventDefault(); setKey(name, false); };
  btn.addEventListener("pointerdown", on);
  btn.addEventListener("pointerup", off);
  btn.addEventListener("pointercancel", off);
  btn.addEventListener("pointerleave", off);
}
bindButton("btn-left", "left");
bindButton("btn-right", "right");
bindButton("btn-jump", "jump");

restartBtn.addEventListener("click", () => startWorld(state.worldIdx));
backToSelectBtn.addEventListener("click", showSelector);

// --- Física + colisión ---
function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function step() {
  if (state.scene !== "playing") return;
  const p = state.player;
  const W = state.world.width;

  if (keys.left) { p.vx = -MOVE_SPEED; p.facing = -1; }
  else if (keys.right) { p.vx = MOVE_SPEED; p.facing = 1; }
  else p.vx = 0;
  if (keys.jump && p.onGround) { p.vy = JUMP_VY; p.onGround = false; sfx.jump(); }

  p.vy += GRAVITY;
  if (p.vy > MAX_FALL) p.vy = MAX_FALL;

  p.x += p.vx;
  for (const plat of state.platforms) {
    if (aabb(p, plat)) {
      if (p.vx > 0) p.x = plat.x - p.w;
      else if (p.vx < 0) p.x = plat.x + plat.w;
    }
  }
  if (state.door && !state.door.opened && aabb(p, state.door)) {
    if (p.vx > 0) p.x = state.door.x - p.w;
    else if (p.vx < 0) p.x = state.door.x + state.door.w;
  }
  // Quiz: si no está resuelto, bloquea como una puerta
  if (state.quiz && !state.quiz.solved && aabb(p, state.quiz)) {
    if (p.vx > 0) p.x = state.quiz.x - p.w;
    else if (p.vx < 0) p.x = state.quiz.x + state.quiz.w;
    // Si tocó el quiz, abrir overlay
    openQuiz();
    p.vx = 0;
  }
  if (p.x < 0) p.x = 0;
  if (p.x + p.w > W) p.x = W - p.w;

  p.y += p.vy;
  p.onGround = false;
  for (const plat of state.platforms) {
    if (aabb(p, plat)) {
      if (p.vy > 0) { p.y = plat.y - p.h; p.vy = 0; p.onGround = true; }
      else if (p.vy < 0) { p.y = plat.y + plat.h; p.vy = 0; }
    }
  }
  if (p.y > VIEW_H + 100) { p.x = 60; p.y = 420; p.vx = 0; p.vy = 0; }

  for (const egg of state.eggs) {
    if (egg.taken) continue;
    const box = { x: egg.x - 12, y: egg.y - 14, w: 24, h: 28 };
    if (aabb(p, box)) {
      egg.taken = true;
      state.collected++;
      sfx.egg();
      updateHud();
    }
  }

  if (state.door && !state.door.opened && state.collected >= state.door.eggs_required) {
    state.door.opened = true;
    state.hint = "¡Puerta abierta! Andá hasta el banderín.";
    sfx.door();
    updateHud();
  }

  if (state.flag && state.scene === "playing" && aabb(p, state.flag)) {
    // Win condition: si hay desafío, debe estar resuelto
    const challengeOk = (!state.door || state.door.opened) && (!state.quiz || state.quiz.solved);
    if (challengeOk) {
      state.scene = "won";
      sfx.win();
      stopMusic();
      const done = loadCompleted();
      done.add(state.world.id);
      saveCompleted(done);
      const next = WORLDS.find((w) => !done.has(w.id));
      winTitleEl.textContent = `🎉 ¡Completaste ${state.world.name}!`;
      winMsgEl.textContent = next ? `Probá el próximo: ${next.emoji} ${next.name}.` : "Completaste todos los mundos. ¡Increíble!";
      setTimeout(() => winOverlay.classList.add("shown"), 400);
    }
  }

  p.flap = (p.flap + 1) % 30;
  const targetX = p.x + p.w / 2 - VIEW_W / 2;
  state.camera.x = Math.max(0, Math.min(W - VIEW_W, targetX));
}

// --- Render ---
function drawSky() {
  if (!state.theme) return;
  const camX = state.camera.x;
  ctx.fillStyle = state.theme.cloud;
  drawCloud(120 - camX * 0.3, 70, 1);
  drawCloud(560 - camX * 0.3, 100, 0.9);
  drawCloud(380 - camX * 0.3, 50, 0.7);
  drawCloud(1100 - camX * 0.3, 80, 1);
  drawCloud(1700 - camX * 0.3, 100, 0.85);
  ctx.fillStyle = "#ffd76b";
  ctx.beginPath(); ctx.arc(720, 80, 32, 0, Math.PI * 2); ctx.fill();
}

function drawCloud(cx, cy, scale) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.arc(20, -4, 22, 0, Math.PI * 2);
  ctx.arc(44, 0, 18, 0, Math.PI * 2);
  ctx.arc(22, 10, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function worldToScreen(x) { return x - state.camera.x; }

function drawPlatform(p) {
  const sx = worldToScreen(p.x);
  if (sx + p.w < 0 || sx > VIEW_W) return;
  if (p.kind === "grass") {
    ctx.fillStyle = state.theme.groundDirt;
    ctx.fillRect(sx, p.y + 12, p.w, p.h - 12);
    ctx.fillStyle = state.theme.groundGrass;
    ctx.fillRect(sx, p.y, p.w, 14);
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    for (let x = sx + 5; x < sx + p.w; x += 18) ctx.fillRect(x, p.y - 3, 3, 6);
  } else if (p.kind === "wood") {
    ctx.fillStyle = "#a87447";
    ctx.fillRect(sx, p.y, p.w, p.h);
    ctx.strokeStyle = "#6b4226"; ctx.lineWidth = 2;
    ctx.strokeRect(sx + 1, p.y + 1, p.w - 2, p.h - 2);
    ctx.strokeStyle = "rgba(107, 66, 38, 0.5)";
    ctx.beginPath(); ctx.moveTo(sx, p.y + p.h / 2); ctx.lineTo(sx + p.w, p.y + p.h / 2); ctx.stroke();
  }
}

function drawEgg(egg) {
  if (egg.taken) return;
  const sx = worldToScreen(egg.x);
  if (sx < -30 || sx > VIEW_W + 30) return;
  ctx.save(); ctx.translate(sx, egg.y);
  ctx.fillStyle = "#fff7d1";
  ctx.beginPath(); ctx.ellipse(0, 0, 11, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#d6c084"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath(); ctx.ellipse(-4, -5, 3, 4, 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawDoor(d) {
  const sx = worldToScreen(d.x);
  if (sx + d.w < 0 || sx > VIEW_W) return;
  ctx.fillStyle = "#5b3a1a";
  ctx.fillRect(sx - 4, d.y - 4, d.w + 8, d.h + 4);
  if (!d.opened) {
    ctx.fillStyle = "#a87447";
    ctx.fillRect(sx, d.y, d.w, d.h);
    ctx.fillStyle = "#ffd76b";
    ctx.beginPath(); ctx.arc(sx + d.w - 6, d.y + d.h / 2, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillRect(sx + d.w / 2 - 14, d.y + d.h / 2 - 14, 28, 28);
    ctx.fillStyle = "#5b3a1a";
    ctx.font = "bold 18px system-ui";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(d.eggs_required), sx + d.w / 2, d.y + d.h / 2);
  } else {
    ctx.fillStyle = "#2a1d10";
    ctx.fillRect(sx, d.y, d.w, d.h);
  }
}

function drawQuizMarker(q) {
  const sx = worldToScreen(q.x);
  if (sx + q.w < 0 || sx > VIEW_W) return;
  if (q.solved) {
    // marca completada (tilde)
    ctx.fillStyle = "rgba(108, 179, 94, 0.5)";
    ctx.fillRect(sx, q.y, q.w, q.h);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 22px system-ui";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("✓", sx + q.w / 2, q.y + q.h / 2);
    return;
  }
  // Tabla con signo de pregunta
  ctx.fillStyle = "#5b3a1a";
  ctx.fillRect(sx - 2, q.y - 2, q.w + 4, q.h + 4);
  ctx.fillStyle = "#e8c87d";
  ctx.fillRect(sx, q.y, q.w, q.h);
  ctx.fillStyle = "#5b3a1a";
  ctx.font = "bold 28px system-ui";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("?", sx + q.w / 2, q.y + q.h / 2);
}

function drawFlag(f) {
  const sx = worldToScreen(f.x);
  if (sx + f.w < 0 || sx > VIEW_W) return;
  ctx.fillStyle = "#7a4f2b";
  ctx.fillRect(sx, f.y, 4, f.h);
  ctx.fillStyle = "#e85d5d";
  ctx.beginPath();
  ctx.moveTo(sx + 4, f.y + 4);
  ctx.lineTo(sx + 4, f.y + 36);
  ctx.lineTo(sx + 34, f.y + 20);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#ffd34a";
  ctx.beginPath(); ctx.arc(sx + 14, f.y + 20, 5, 0, Math.PI * 2); ctx.fill();
}

function drawPollito(p) {
  ctx.save();
  const cx = worldToScreen(p.x) + p.w / 2;
  const cy = p.y + p.h / 2;
  ctx.translate(cx, cy);
  if (p.facing === -1) ctx.scale(-1, 1);
  ctx.fillStyle = "#ffd34a";
  ctx.beginPath(); ctx.ellipse(0, 3, 16, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(8, -8, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f3b620";
  const flapY = (p.flap < 15) ? 4 : 6;
  ctx.beginPath(); ctx.ellipse(-2, flapY, 7, 5, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f08a1a";
  ctx.beginPath(); ctx.moveTo(17, -8); ctx.lineTo(22, -6); ctx.lineTo(17, -4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(11, -10, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "white"; ctx.beginPath(); ctx.arc(11.5, -10.5, 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#f08a1a"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-5, 16); ctx.lineTo(-5, 20);
  ctx.moveTo(5, 16);  ctx.lineTo(5, 20);
  ctx.stroke();
  ctx.restore();
}

function drawHintBanner() {
  if (!state.hint || state.scene !== "playing") return;
  const text = state.hint;
  ctx.font = "16px system-ui";
  const w = Math.min(VIEW_W - 40, ctx.measureText(text).width + 30);
  const x = (VIEW_W - w) / 2;
  const y = VIEW_H - 56;
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(x, y, w, 32);
  ctx.fillStyle = "white";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, VIEW_W / 2, y + 16);
}

function render() {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (state.scene === "select") return; // overlay HTML cubre todo
  drawSky();
  for (const p of state.platforms) drawPlatform(p);
  for (const e of state.eggs) drawEgg(e);
  if (state.door) drawDoor(state.door);
  if (state.quiz) drawQuizMarker(state.quiz);
  if (state.flag) drawFlag(state.flag);
  drawPollito(state.player);
  drawHintBanner();
}

function loop() {
  step();
  render();
  requestAnimationFrame(loop);
}

showSelector();
loop();
