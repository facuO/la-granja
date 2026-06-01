// Aventura del Pollito — platformer simple en canvas, accesible para Sofi.
//
// Diseño:
//  - Sin timer. Sin "Game Over": si Pollito cae al pozo, vuelve al inicio.
//  - Controles: flechas / WASD en desktop. Botones grandes en mobile.
//  - Física estable y predecible (gravedad fija, salto consistente).
//  - Visual suave (cielo gradiente, pasto, plataformas de madera, huevos).
//  - Objetivo Iteración 1: juntar los 5 huevos.

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const hudEl = document.getElementById("hud");
const winOverlay = document.getElementById("win-overlay");
const restartBtn = document.getElementById("restart-btn");

// --- Constantes del mundo ---
const W = canvas.width;   // 800
const H = canvas.height;  // 500
const GRAVITY = 0.55;
const MOVE_SPEED = 3.4;
const JUMP_VY = -11.5;
const MAX_FALL = 12;

// --- Estado del juego ---
const state = {
  player: { x: 60, y: 0, w: 36, h: 36, vx: 0, vy: 0, onGround: false, facing: 1, flap: 0 },
  platforms: [],
  eggs: [],
  collected: 0,
  total: 5,
  won: false,
};

function buildLevel() {
  // Plataformas (x, y, w, h). El piso de pasto va de extremo a extremo.
  state.platforms = [
    // Suelo principal
    { x: 0, y: 460, w: W, h: 40, kind: "grass" },
    // Plataformas suspendidas
    { x: 130, y: 380, w: 120, h: 18, kind: "wood" },
    { x: 320, y: 330, w: 120, h: 18, kind: "wood" },
    { x: 520, y: 280, w: 120, h: 18, kind: "wood" },
    { x: 680, y: 200, w: 100, h: 18, kind: "wood" },
    { x: 380, y: 200, w: 80,  h: 18, kind: "wood" },
    { x: 180, y: 230, w: 80,  h: 18, kind: "wood" },
  ];

  // Huevos a juntar (sentados sobre plataformas)
  state.eggs = [
    { x: 180, y: 350, taken: false },
    { x: 370, y: 300, taken: false },
    { x: 580, y: 250, taken: false },
    { x: 220, y: 200, taken: false },
    { x: 720, y: 170, taken: false },
  ];

  // Reset jugador
  state.player.x = 60;
  state.player.y = 420;
  state.player.vx = 0;
  state.player.vy = 0;
  state.player.onGround = false;
  state.collected = 0;
  state.won = false;
  winOverlay.classList.remove("shown");
  updateHud();
}

function updateHud() {
  hudEl.textContent = `🥚 ${state.collected} / ${state.total}`;
}

// --- Input ---
const keys = { left: false, right: false, jump: false };

function setKey(name, val) { keys[name] = val; }

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" || e.key === "a") setKey("left", true);
  if (e.key === "ArrowRight" || e.key === "d") setKey("right", true);
  if (e.key === "ArrowUp" || e.key === "w" || e.key === " ") {
    setKey("jump", true);
    e.preventDefault();
  }
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

restartBtn.addEventListener("click", buildLevel);

// --- Física + colisión ---
function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function step() {
  const p = state.player;

  // Horizontal
  if (keys.left)  { p.vx = -MOVE_SPEED; p.facing = -1; }
  else if (keys.right) { p.vx = MOVE_SPEED; p.facing = 1; }
  else p.vx = 0;

  // Salto (solo si está pisando algo)
  if (keys.jump && p.onGround) {
    p.vy = JUMP_VY;
    p.onGround = false;
  }

  // Gravedad
  p.vy += GRAVITY;
  if (p.vy > MAX_FALL) p.vy = MAX_FALL;

  // Mover X y resolver colisión horizontal
  p.x += p.vx;
  for (const plat of state.platforms) {
    if (aabb(p, plat)) {
      if (p.vx > 0)      p.x = plat.x - p.w;
      else if (p.vx < 0) p.x = plat.x + plat.w;
    }
  }
  if (p.x < 0) p.x = 0;
  if (p.x + p.w > W) p.x = W - p.w;

  // Mover Y y resolver colisión vertical
  p.y += p.vy;
  p.onGround = false;
  for (const plat of state.platforms) {
    if (aabb(p, plat)) {
      if (p.vy > 0) { p.y = plat.y - p.h; p.vy = 0; p.onGround = true; }
      else if (p.vy < 0) { p.y = plat.y + plat.h; p.vy = 0; }
    }
  }

  // Si cae fuera de pantalla, respawn (sin Game Over)
  if (p.y > H + 100) {
    p.x = 60; p.y = 420; p.vx = 0; p.vy = 0;
  }

  // Animación de alas (parpadeo)
  p.flap = (p.flap + 1) % 30;

  // Recoger huevos
  for (const egg of state.eggs) {
    if (egg.taken) continue;
    const eggBox = { x: egg.x - 12, y: egg.y - 14, w: 24, h: 28 };
    if (aabb(p, eggBox)) {
      egg.taken = true;
      state.collected++;
      updateHud();
      if (state.collected >= state.total && !state.won) {
        state.won = true;
        setTimeout(() => winOverlay.classList.add("shown"), 300);
      }
    }
  }
}

// --- Render ---
function drawSky() {
  // El fondo ya viene del CSS gradient. Sumamos un par de nubes y un sol.
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  drawCloud(120, 70, 1);
  drawCloud(560, 100, 0.9);
  drawCloud(380, 50, 0.7);
  // Sol
  ctx.fillStyle = "#ffd76b";
  ctx.beginPath(); ctx.arc(720, 80, 32, 0, Math.PI * 2); ctx.fill();
}

function drawCloud(cx, cy, scale) {
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.arc(20, -4, 22, 0, Math.PI * 2);
  ctx.arc(44, 0, 18, 0, Math.PI * 2);
  ctx.arc(22, 10, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlatform(p) {
  if (p.kind === "grass") {
    // Tierra
    ctx.fillStyle = "#8b5a2b";
    ctx.fillRect(p.x, p.y + 12, p.w, p.h - 12);
    // Pasto
    ctx.fillStyle = "#6cb35e";
    ctx.fillRect(p.x, p.y, p.w, 14);
    // Briznas
    ctx.fillStyle = "#4f9c45";
    for (let x = p.x + 5; x < p.x + p.w; x += 18) {
      ctx.fillRect(x, p.y - 3, 3, 6);
    }
  } else if (p.kind === "wood") {
    // Tabla de madera
    ctx.fillStyle = "#a87447";
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = "#6b4226";
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x + 1, p.y + 1, p.w - 2, p.h - 2);
    // Líneas de veta
    ctx.strokeStyle = "rgba(107, 66, 38, 0.5)";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + p.h / 2); ctx.lineTo(p.x + p.w, p.y + p.h / 2);
    ctx.stroke();
  }
}

function drawEgg(egg) {
  if (egg.taken) return;
  ctx.save();
  ctx.translate(egg.x, egg.y);
  // huevo
  ctx.fillStyle = "#fff7d1";
  ctx.beginPath();
  ctx.ellipse(0, 0, 11, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#d6c084";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // brillito
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.ellipse(-4, -5, 3, 4, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPollito(p) {
  ctx.save();
  // El pollito es un grupo de formas amarillas
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  ctx.translate(cx, cy);
  if (p.facing === -1) ctx.scale(-1, 1);

  // Cuerpo
  ctx.fillStyle = "#ffd34a";
  ctx.beginPath();
  ctx.ellipse(0, 3, 16, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cabeza
  ctx.beginPath();
  ctx.arc(8, -8, 10, 0, Math.PI * 2);
  ctx.fill();

  // Ala
  ctx.fillStyle = "#f3b620";
  ctx.beginPath();
  const flapY = (p.flap < 15) ? 4 : 6;
  ctx.ellipse(-2, flapY, 7, 5, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Pico
  ctx.fillStyle = "#f08a1a";
  ctx.beginPath();
  ctx.moveTo(17, -8);
  ctx.lineTo(22, -6);
  ctx.lineTo(17, -4);
  ctx.closePath();
  ctx.fill();

  // Ojo
  ctx.fillStyle = "#222";
  ctx.beginPath(); ctx.arc(11, -10, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "white";
  ctx.beginPath(); ctx.arc(11.5, -10.5, 0.7, 0, Math.PI * 2); ctx.fill();

  // Patitas
  ctx.strokeStyle = "#f08a1a";
  ctx.lineWidth = 2.5; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-5, 16); ctx.lineTo(-5, 20);
  ctx.moveTo(5, 16);  ctx.lineTo(5, 20);
  ctx.stroke();
  ctx.restore();
}

function render() {
  // Fondo
  ctx.clearRect(0, 0, W, H);
  drawSky();
  // Plataformas
  for (const p of state.platforms) drawPlatform(p);
  // Huevos
  for (const e of state.eggs) drawEgg(e);
  // Pollito
  drawPollito(state.player);
}

// --- Loop ---
function loop() {
  if (!state.won) step();
  render();
  requestAnimationFrame(loop);
}

buildLevel();
loop();
