// Aventura del Pollito — platformer en canvas, accesible para Sofi.
//
// Iteración 2:
//  - Mundo con scrolling lateral (world.width > viewport.width).
//  - Cámara que sigue al pollito con clamp en los bordes.
//  - PUERTA con desafío: requiere juntar N huevos antes para pasar.
//  - META (banderín) al final → mundo completado.
//  - Hint banner que explica el desafío.
//
// Diseño para Sofi:
//  - Sin timer, sin Game Over. Caída = respawn al inicio.
//  - Física estable. Salto y velocidad consistentes.
//  - Mensajes literales, sin sarcasmo, voseo.

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const hudEl = document.getElementById("hud");
const winOverlay = document.getElementById("win-overlay");
const restartBtn = document.getElementById("restart-btn");

// --- Constantes ---
const VIEW_W = canvas.width;   // 800
const VIEW_H = canvas.height;  // 500
const WORLD_W = 2200;          // mundo más ancho que la vista → scroll
const GRAVITY = 0.55;
const MOVE_SPEED = 3.4;
const JUMP_VY = -11.5;
const MAX_FALL = 12;

// --- Estado ---
const state = {
  player: { x: 60, y: 0, w: 36, h: 36, vx: 0, vy: 0, onGround: false, facing: 1, flap: 0, spawnX: 60, spawnY: 420 },
  camera: { x: 0 },
  platforms: [],
  eggs: [],
  door: null,        // { x, y, w, h, opened, eggs_required }
  flag: null,        // { x, y, w, h }
  collected: 0,
  total: 0,
  won: false,
  hint: "",
};

function buildLevel() {
  // Plataformas y suelo
  state.platforms = [
    // Suelo en tramos (un hueco-pozo al medio para enseñar a saltar)
    { x: 0,    y: 460, w: 700,  h: 40, kind: "grass" },
    { x: 820,  y: 460, w: 700,  h: 40, kind: "grass" },
    { x: 1640, y: 460, w: 600,  h: 40, kind: "grass" },

    // Tramo 1: plataformas suspendidas (recolección inicial)
    { x: 130, y: 380, w: 120, h: 18, kind: "wood" },
    { x: 320, y: 330, w: 120, h: 18, kind: "wood" },
    { x: 520, y: 280, w: 120, h: 18, kind: "wood" },

    // Cruce del pozo (plataformas para saltar)
    { x: 720, y: 380, w: 80, h: 18, kind: "wood" },
    { x: 830, y: 320, w: 80, h: 18, kind: "wood" },

    // Tramo 2: subida hacia la puerta
    { x: 980,  y: 380, w: 120, h: 18, kind: "wood" },
    { x: 1180, y: 320, w: 120, h: 18, kind: "wood" },
    { x: 1340, y: 260, w: 120, h: 18, kind: "wood" },

    // Tramo 3: post-puerta hacia la meta
    { x: 1720, y: 380, w: 120, h: 18, kind: "wood" },
    { x: 1900, y: 320, w: 100, h: 18, kind: "wood" },
  ];

  // Huevos a juntar (distribuidos)
  state.eggs = [
    { x: 180,  y: 350, taken: false },
    { x: 370,  y: 300, taken: false },
    { x: 580,  y: 250, taken: false },
    { x: 1040, y: 350, taken: false },
    { x: 1240, y: 290, taken: false },
    { x: 1400, y: 230, taken: false },
  ];
  state.total = state.eggs.length;

  // Puerta del desafío: necesita 4 huevos para abrirse
  state.door = {
    x: 1530, y: 360, w: 30, h: 100,
    opened: false,
    eggs_required: 4,
  };

  // Banderín de meta
  state.flag = { x: 2090, y: 360, w: 24, h: 100 };

  // Reset jugador y cámara
  state.player.x = state.player.spawnX;
  state.player.y = state.player.spawnY;
  state.player.vx = 0;
  state.player.vy = 0;
  state.player.onGround = false;
  state.camera.x = 0;
  state.collected = 0;
  state.won = false;
  state.hint = `Juntá ${state.door.eggs_required} huevos para abrir la puerta`;
  winOverlay.classList.remove("shown");
  updateHud();
}

function updateHud() {
  let hud = `🥚 ${state.collected} / ${state.total}`;
  if (state.door && !state.door.opened) {
    hud += `  ·  🚪 ${Math.max(0, state.door.eggs_required - state.collected)} para abrir`;
  } else if (state.door && state.door.opened) {
    hud += `  ·  🚪 ¡Abierta!`;
  }
  hudEl.textContent = hud;
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

restartBtn.addEventListener("click", buildLevel);

// --- Física + colisión ---
function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function step() {
  const p = state.player;

  // Horizontal
  if (keys.left) { p.vx = -MOVE_SPEED; p.facing = -1; }
  else if (keys.right) { p.vx = MOVE_SPEED; p.facing = 1; }
  else p.vx = 0;

  if (keys.jump && p.onGround) { p.vy = JUMP_VY; p.onGround = false; }

  p.vy += GRAVITY;
  if (p.vy > MAX_FALL) p.vy = MAX_FALL;

  // Colisión X con plataformas
  p.x += p.vx;
  for (const plat of state.platforms) {
    if (aabb(p, plat)) {
      if (p.vx > 0) p.x = plat.x - p.w;
      else if (p.vx < 0) p.x = plat.x + plat.w;
    }
  }
  // Colisión X con puerta cerrada (bloquea pase)
  if (state.door && !state.door.opened && aabb(p, state.door)) {
    if (p.vx > 0) p.x = state.door.x - p.w;
    else if (p.vx < 0) p.x = state.door.x + state.door.w;
  }
  if (p.x < 0) p.x = 0;
  if (p.x + p.w > WORLD_W) p.x = WORLD_W - p.w;

  // Colisión Y
  p.y += p.vy;
  p.onGround = false;
  for (const plat of state.platforms) {
    if (aabb(p, plat)) {
      if (p.vy > 0) { p.y = plat.y - p.h; p.vy = 0; p.onGround = true; }
      else if (p.vy < 0) { p.y = plat.y + plat.h; p.vy = 0; }
    }
  }

  // Pozo: respawn sin Game Over
  if (p.y > VIEW_H + 100) {
    p.x = p.spawnX; p.y = p.spawnY; p.vx = 0; p.vy = 0;
  }

  // Recoger huevos
  for (const egg of state.eggs) {
    if (egg.taken) continue;
    const eggBox = { x: egg.x - 12, y: egg.y - 14, w: 24, h: 28 };
    if (aabb(p, eggBox)) {
      egg.taken = true;
      state.collected++;
      updateHud();
    }
  }

  // Abrir puerta si juntó los necesarios
  if (state.door && !state.door.opened && state.collected >= state.door.eggs_required) {
    state.door.opened = true;
    state.hint = "¡Puerta abierta! Andá hasta el banderín.";
    updateHud();
  }

  // Tocar banderín → victoria
  if (state.flag && !state.won && aabb(p, state.flag)) {
    state.won = true;
    state.hint = "";
    setTimeout(() => winOverlay.classList.add("shown"), 400);
  }

  // Animación alas
  p.flap = (p.flap + 1) % 30;

  // Cámara: sigue al pollito con clamp
  const targetX = p.x + p.w / 2 - VIEW_W / 2;
  state.camera.x = Math.max(0, Math.min(WORLD_W - VIEW_W, targetX));
}

// --- Render ---
function drawSky() {
  // Parallax suave: nubes se mueven a 0.3x de la cámara
  const camX = state.camera.x;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  drawCloud(120 - camX * 0.3, 70, 1);
  drawCloud(560 - camX * 0.3, 100, 0.9);
  drawCloud(380 - camX * 0.3, 50, 0.7);
  drawCloud(1100 - camX * 0.3, 80, 1);
  drawCloud(1700 - camX * 0.3, 100, 0.85);
  // Sol fijo en pantalla
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

function worldToScreen(x) { return x - state.camera.x; }

function drawPlatform(p) {
  const sx = worldToScreen(p.x);
  if (sx + p.w < 0 || sx > VIEW_W) return; // cull off-screen
  if (p.kind === "grass") {
    ctx.fillStyle = "#8b5a2b";
    ctx.fillRect(sx, p.y + 12, p.w, p.h - 12);
    ctx.fillStyle = "#6cb35e";
    ctx.fillRect(sx, p.y, p.w, 14);
    ctx.fillStyle = "#4f9c45";
    for (let x = sx + 5; x < sx + p.w; x += 18) {
      ctx.fillRect(x, p.y - 3, 3, 6);
    }
  } else if (p.kind === "wood") {
    ctx.fillStyle = "#a87447";
    ctx.fillRect(sx, p.y, p.w, p.h);
    ctx.strokeStyle = "#6b4226";
    ctx.lineWidth = 2;
    ctx.strokeRect(sx + 1, p.y + 1, p.w - 2, p.h - 2);
    ctx.strokeStyle = "rgba(107, 66, 38, 0.5)";
    ctx.beginPath();
    ctx.moveTo(sx, p.y + p.h / 2); ctx.lineTo(sx + p.w, p.y + p.h / 2);
    ctx.stroke();
  }
}

function drawEgg(egg) {
  if (egg.taken) return;
  const sx = worldToScreen(egg.x);
  if (sx < -30 || sx > VIEW_W + 30) return;
  ctx.save();
  ctx.translate(sx, egg.y);
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
  // marco
  ctx.fillStyle = "#5b3a1a";
  ctx.fillRect(sx - 4, d.y - 4, d.w + 8, d.h + 4);
  // puerta
  if (!d.opened) {
    ctx.fillStyle = "#a87447";
    ctx.fillRect(sx, d.y, d.w, d.h);
    // manija
    ctx.fillStyle = "#ffd76b";
    ctx.beginPath(); ctx.arc(sx + d.w - 6, d.y + d.h / 2, 2.5, 0, Math.PI * 2); ctx.fill();
    // candado con nº requerido
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillRect(sx + d.w / 2 - 14, d.y + d.h / 2 - 14, 28, 28);
    ctx.fillStyle = "#5b3a1a";
    ctx.font = "bold 18px system-ui";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(d.eggs_required), sx + d.w / 2, d.y + d.h / 2);
  } else {
    // puerta abierta: marco oscuro vacío
    ctx.fillStyle = "#2a1d10";
    ctx.fillRect(sx, d.y, d.w, d.h);
  }
}

function drawFlag(f) {
  const sx = worldToScreen(f.x);
  if (sx + f.w < 0 || sx > VIEW_W) return;
  // asta
  ctx.fillStyle = "#7a4f2b";
  ctx.fillRect(sx, f.y, 4, f.h);
  // bandera
  ctx.fillStyle = "#e85d5d";
  ctx.beginPath();
  ctx.moveTo(sx + 4, f.y + 4);
  ctx.lineTo(sx + 4, f.y + 36);
  ctx.lineTo(sx + 34, f.y + 20);
  ctx.closePath(); ctx.fill();
  // pollito decorativo en la bandera
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
  ctx.beginPath();
  ctx.moveTo(17, -8); ctx.lineTo(22, -6); ctx.lineTo(17, -4);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = "#222";
  ctx.beginPath(); ctx.arc(11, -10, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "white";
  ctx.beginPath(); ctx.arc(11.5, -10.5, 0.7, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = "#f08a1a"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-5, 16); ctx.lineTo(-5, 20);
  ctx.moveTo(5, 16);  ctx.lineTo(5, 20);
  ctx.stroke();
  ctx.restore();
}

function drawHintBanner() {
  if (!state.hint) return;
  const text = state.hint;
  ctx.font = "16px system-ui";
  const w = Math.min(VIEW_W - 40, ctx.measureText(text).width + 30);
  const x = (VIEW_W - w) / 2;
  const y = VIEW_H - 60;
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(x, y, w, 36);
  ctx.fillStyle = "white";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, VIEW_W / 2, y + 18);
}

function render() {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  drawSky();
  for (const p of state.platforms) drawPlatform(p);
  for (const e of state.eggs) drawEgg(e);
  if (state.door) drawDoor(state.door);
  if (state.flag) drawFlag(state.flag);
  drawPollito(state.player);
  drawHintBanner();
}

function loop() {
  if (!state.won) step();
  render();
  requestAnimationFrame(loop);
}

buildLevel();
loop();
