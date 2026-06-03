// Aventura del Pollito — platformer multi-mundo para Sofi.
//
// Iter 6 — "Nintendo polish":
//  - High-DPI canvas (devicePixelRatio).
//  - Parallax de 3 capas (lejos, medio, cerca).
//  - Ambient animals: vaca con bobbing, oveja pastando, mariposas
//    volando en sinusoide, pájaros cruzando, pato en estanque.
//  - Decoración por mundo: cerca de madera, gallinero, trigo,
//    girasoles, juncos, fardos de heno, silo.
//  - Pollito polish: squash/stretch en salto/aterrizaje, idle breath,
//    sombra. Particles de polvo + sparkles al juntar huevo.
//  - Camera lerp + screen shake en eventos.
//  - Coyote time + jump buffer.
//  - Música procedural cambia de patrón según el mundo.

import { sfx, startMusic, stopMusic, isMuted, toggleMute, unlock, setMusicPattern } from "/js/juego-pollito-audio.js";
import { getTodayFlavor } from "/js/juego-pollito-flavor.js";

// ============================================================
// DOM
// ============================================================
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const hudEl = document.getElementById("hud");
const worldPillEl = document.getElementById("world-pill");
const selectOverlay = document.getElementById("select-overlay");
const worldGrid = document.getElementById("world-grid");
const quizOverlay = document.getElementById("quiz-overlay");
const quizQEl = document.getElementById("quiz-question");
const quizOptsEl = document.getElementById("quiz-options");
const quizVisualEl = document.getElementById("quiz-visual");
const quizHintEl = document.getElementById("quiz-hint");
const quizFbEl = document.getElementById("quiz-feedback");
const winOverlay = document.getElementById("win-overlay");
const winTitleEl = document.getElementById("win-title");
const winMsgEl = document.getElementById("win-msg");
const restartBtn = document.getElementById("restart-btn");
const backToSelectBtn = document.getElementById("back-to-select");
const audioBtn = document.getElementById("audio-btn");
const pauseBtn = document.getElementById("pause-btn");
const pauseOverlay = document.getElementById("pause-overlay");
const resumeBtn = document.getElementById("resume-btn");
const pauseToSelectBtn = document.getElementById("pause-to-select");
const splashOverlay = document.getElementById("splash-overlay");
const splashStartBtn = document.getElementById("splash-start-btn");
const splashStatsEl = document.getElementById("splash-stats");
const splashPollitoCanvas = document.getElementById("splash-pollito-canvas");
const statWorldsEl = document.getElementById("stat-worlds");
const statEggsEl = document.getElementById("stat-eggs");
const statRunsEl = document.getElementById("stat-runs");
const flavorBannerEl = document.getElementById("flavor-banner");

// ============================================================
// High-DPI canvas setup
// ============================================================
const LOGICAL_W = 800;
const LOGICAL_H = 500;
function setupHiDPI() {
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  canvas.width = LOGICAL_W * dpr;
  canvas.height = LOGICAL_H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
}
setupHiDPI();
window.addEventListener("resize", setupHiDPI);

const VIEW_W = LOGICAL_W;
const VIEW_H = LOGICAL_H;
const GRAVITY = 0.55;
const MOVE_SPEED = 3.4;
const JUMP_VY = -11.5;
const MAX_FALL = 12;
const COYOTE_FRAMES = 6;
const JUMP_BUFFER_FRAMES = 6;

// ============================================================
// Catálogo de mundos
// ============================================================
const WORLDS = [
  {
    id: "corral",
    name: "El Corral",
    emoji: "🐔",
    hint: "Juntá 4 huevos para abrir la puerta y llegar al banderín.",
    width: 2400,
    theme: {
      sky: ["#b9e4ff", "#d8f0ff", "#ffeaa6"],
      grass: "#6cb35e", grassDark: "#4f9c45", dirt: "#8b5a2b",
      mountain: "#7c9c7e", mountainDark: "#5d7d63",
      treeTrunk: "#6b4226", treeLeaves: "#5d9c50",
      cloud: "rgba(255,255,255,0.92)",
    },
    parallaxFar: [
      { kind: "mountain", x: 200, scale: 1.2 },
      { kind: "mountain", x: 800, scale: 0.9 },
      { kind: "mountain", x: 1400, scale: 1.1 },
      { kind: "mountain", x: 2000, scale: 0.8 },
    ],
    parallaxMid: [
      { kind: "tree", x: 100, scale: 1 },
      { kind: "tree", x: 350, scale: 0.85 },
      { kind: "barn", x: 700, scale: 1 },
      { kind: "tree", x: 1100, scale: 1.1 },
      { kind: "tree", x: 1500, scale: 0.9 },
      { kind: "silo", x: 1900, scale: 1 },
      { kind: "tree", x: 2200, scale: 0.95 },
    ],
    parallaxNear: [
      { kind: "bush", x: 80 }, { kind: "bush", x: 480 },
      { kind: "rock", x: 880 }, { kind: "bush", x: 1280 },
      { kind: "bush", x: 1700 }, { kind: "rock", x: 2100 },
    ],
    decor: [
      { kind: "fence", x: 0, y: 444, len: 8 },
      { kind: "gallinero", x: 380, y: 396 },
      { kind: "flower", x: 60, y: 452, color: "#e85d5d" },
      { kind: "flower", x: 250, y: 452, color: "#ffd34a" },
      { kind: "flower", x: 1100, y: 452, color: "#d989ff" },
      { kind: "flower", x: 1450, y: 452, color: "#e85d5d" },
      { kind: "fence", x: 1640, y: 444, len: 6 },
      { kind: "flower", x: 1900, y: 452, color: "#ffd34a" },
      { kind: "flower", x: 2150, y: 452, color: "#d989ff" },
    ],
    ambients: [
      { kind: "cow", x: 200, y: 422 },
      { kind: "sheep", x: 1750, y: 426 },
      { kind: "chick", x: 480, y: 442 },
      { kind: "chick", x: 540, y: 442 },
      { kind: "butterfly", x: 600, y: 280, hue: "#e85d5d" },
      { kind: "butterfly", x: 1200, y: 260, hue: "#d989ff" },
      { kind: "bird", x: 0, y: 100, vx: 1.4 },
      { kind: "bird", x: -300, y: 140, vx: 1.0 },
    ],
    platforms: [
      // Zona 1: introducción (suelo amplio, plataformas escalonadas hacia arriba)
      { x: 0,    y: 460, w: 700,  h: 40, kind: "grass" },
      { x: 130,  y: 400, w: 100, h: 18, kind: "wood" },
      { x: 290,  y: 350, w: 100, h: 18, kind: "wood" },
      { x: 450,  y: 300, w: 100, h: 18, kind: "wood" },
      // PLATAFORMA SECRETA muy alta para el huevo dorado
      { x: 600,  y: 200, w: 80,  h: 18, kind: "wood" },
      // Zona 2: tramo medio con zorro + puerta apoyada sobre suelo (sin hueco bajo la puerta)
      { x: 820,  y: 460, w: 820,  h: 40, kind: "grass" },   // extendida a 820w → cubre hasta 1640
      { x: 740,  y: 320, w: 80,  h: 18, kind: "wood", moving: { axis: "x", range: [740, 880], speed: 1.2, dir: 1 } },
      { x: 980,  y: 380, w: 120, h: 18, kind: "wood" },
      { x: 1180, y: 340, w: 120, h: 18, kind: "wood" },
      { x: 1340, y: 280, w: 120, h: 18, kind: "wood" },
      // Zona 3: tramo final post-puerta (suelo continúa)
      { x: 1640, y: 460, w: 760,  h: 40, kind: "grass" },
      { x: 1720, y: 380, w: 120, h: 18, kind: "wood" },
      { x: 1900, y: 320, w: 100, h: 18, kind: "wood" },
      { x: 2080, y: 380, w: 120, h: 18, kind: "wood" },
    ],
    eggs: [
      // Zona 1 - subida (3 huevos visibles)
      { x: 180, y: 370 }, { x: 340, y: 320 }, { x: 500, y: 270 },
      // Plataforma alta secreta - HUEVO DORADO (vale +5 en stats)
      { x: 640, y: 170, golden: true },
      // Zona 2 (3 huevos cerca del zorro)
      { x: 1040, y: 350 }, { x: 1240, y: 310 }, { x: 1400, y: 250 },
    ],
    enemies: [
      // Zorro patrullando en zona 2 (el huevo dorado es "premio" por subir muy alto en zona 1)
      { kind: "fox", x: 1050, y: 432, range: [970, 1500], speed: 0.9, dir: 1 },
    ],
    door: { x: 1500, y: 360, w: 30, h: 100, eggs_required: 4 },
    quiz: null,
    flag: { x: 2280, y: 360, w: 24, h: 100 },
  },

  {
    id: "campo",
    name: "El Campo",
    emoji: "🌾",
    hint: "Tocá la tabla con la pregunta y respondela para seguir.",
    width: 2400,
    theme: {
      sky: ["#fdebc0", "#fff5d8", "#ffcb80"],
      grass: "#a3c46a", grassDark: "#7d9c4b", dirt: "#7a5a2b",
      mountain: "#a8a058", mountainDark: "#7d784a",
      treeTrunk: "#6b4226", treeLeaves: "#8aa64d",
      cloud: "rgba(255,250,235,0.92)",
    },
    parallaxFar: [
      { kind: "mountain", x: 300, scale: 1.1 },
      { kind: "mountain", x: 1000, scale: 0.85 },
      { kind: "mountain", x: 1700, scale: 1 },
    ],
    parallaxMid: [
      { kind: "tree", x: 200, scale: 0.9 },
      { kind: "tree", x: 800, scale: 1.1 },
      { kind: "windmill", x: 1300, scale: 1 },
      { kind: "tree", x: 1800, scale: 0.95 },
      { kind: "tree", x: 2200, scale: 1 },
    ],
    parallaxNear: [
      { kind: "bush", x: 150 }, { kind: "bush", x: 580 },
      { kind: "rock", x: 980 }, { kind: "bush", x: 1380 },
      { kind: "bush", x: 1800 },
    ],
    decor: [
      { kind: "wheat", x: 60, y: 450 }, { kind: "wheat", x: 90, y: 450 },
      { kind: "wheat", x: 120, y: 450 }, { kind: "sunflower", x: 280, y: 442 },
      { kind: "sunflower", x: 700, y: 442 }, { kind: "wheat", x: 1100, y: 450 },
      { kind: "wheat", x: 1130, y: 450 }, { kind: "wheat", x: 1160, y: 450 },
      { kind: "scarecrow", x: 1450, y: 410 },
      { kind: "sunflower", x: 1880, y: 442 }, { kind: "wheat", x: 2100, y: 450 },
      { kind: "wheat", x: 2130, y: 450 },
    ],
    ambients: [
      { kind: "sheep", x: 300, y: 422 },
      { kind: "sheep", x: 1100, y: 422 },
      { kind: "butterfly", x: 500, y: 280, hue: "#ffd34a" },
      { kind: "butterfly", x: 1300, y: 250, hue: "#e85d5d" },
      { kind: "butterfly", x: 1900, y: 260, hue: "#d989ff" },
      { kind: "bird", x: -100, y: 110, vx: 1.1 },
      { kind: "bird", x: -400, y: 80, vx: 1.4 },
    ],
    platforms: [
      { x: 0,    y: 460, w: 900,  h: 40, kind: "grass" },
      { x: 1020, y: 460, w: 700,  h: 40, kind: "grass" },
      { x: 1820, y: 460, w: 580,  h: 40, kind: "grass" },
      { x: 200, y: 370, w: 120, h: 18, kind: "wood" },
      { x: 400, y: 310, w: 120, h: 18, kind: "wood" },
      // Plataforma móvil vertical entre 250 y 330
      { x: 600, y: 250, w: 120, h: 18, kind: "wood", moving: { axis: "y", range: [220, 320], speed: 1.0, dir: 1 } },
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
      question: "¿Cuál palabra nombra a algo o alguien?",
      hintLine: "Esa palabra es un SUSTANTIVO.",
      options: [
        { text: "come",   pic: 6456 },   // verbo
        { text: "perro",  pic: 7202 },   // ← sustantivo (correcto)
        { text: "rápido", pic: 5306 },   // adverbio
      ],
      correct: 1,
      feedback_ok: "¡Sí! 'Perro' nombra a un animal. Es un sustantivo.",
      feedback_no: "Esa palabra no nombra a algo. Probá otra.",
    },
    flag: { x: 2280, y: 360, w: 24, h: 100 },
  },

  {
    id: "estanque",
    name: "El Estanque",
    emoji: "🦆",
    hint: "Resolvé la suma para construir el puente y llegar al banderín.",
    width: 2400,
    theme: {
      sky: ["#a8d8f0", "#cfeaf5", "#e8d5b0"],
      grass: "#6cb35e", grassDark: "#4f8c46", dirt: "#5d7e3f",
      mountain: "#7d9aa6", mountainDark: "#5d7783",
      treeTrunk: "#5b4226", treeLeaves: "#4f9c50",
      cloud: "rgba(230,245,255,0.95)",
      water: "#5fb4e0", waterDark: "#3d8db0",
    },
    parallaxFar: [
      { kind: "mountain", x: 200, scale: 1.3 },
      { kind: "mountain", x: 900, scale: 1.0 },
      { kind: "mountain", x: 1600, scale: 1.2 },
    ],
    parallaxMid: [
      { kind: "tree", x: 150, scale: 1 },
      { kind: "tree", x: 600, scale: 1.1 },
      { kind: "tree", x: 1500, scale: 0.95 },
      { kind: "tree", x: 2000, scale: 1 },
    ],
    parallaxNear: [
      { kind: "bush", x: 100 }, { kind: "rock", x: 1200 },
      { kind: "bush", x: 1700 }, { kind: "rock", x: 2200 },
    ],
    decor: [
      { kind: "reeds", x: 300, y: 450 },
      { kind: "reeds", x: 1280, y: 450 },
      { kind: "lilypad", x: 1050, y: 470 },
      { kind: "lilypad", x: 1130, y: 472 },
      { kind: "flower", x: 100, y: 452, color: "#ffd34a" },
      { kind: "flower", x: 2200, y: 452, color: "#e85d5d" },
    ],
    ambients: [
      { kind: "duck", x: 1080, y: 462 },
      { kind: "cow", x: 250, y: 422 },
      { kind: "butterfly", x: 700, y: 270, hue: "#d989ff" },
      { kind: "dragonfly", x: 1100, y: 380, hue: "#5fb4e0" },
      { kind: "bird", x: -100, y: 90, vx: 1.0 },
    ],
    platforms: [
      { x: 0,    y: 460, w: 1000, h: 40, kind: "grass" },
      // "pozo de agua" entre 1000-1200 (visual water)
      { x: 1200, y: 460, w: 1200, h: 40, kind: "grass" },
      { x: 200, y: 370, w: 120, h: 18, kind: "wood" },
      { x: 420, y: 310, w: 120, h: 18, kind: "wood" },
      { x: 640, y: 250, w: 120, h: 18, kind: "wood" },
      // Lirio gigante flotante (móvil horizontal) sobre el agua
      { x: 1000, y: 440, w: 80, h: 14, kind: "lily", moving: { axis: "x", range: [1000, 1120], speed: 0.9, dir: 1 } },
      { x: 1300, y: 380, w: 120, h: 18, kind: "wood" },
      { x: 1520, y: 320, w: 120, h: 18, kind: "wood" },
      { x: 1740, y: 260, w: 120, h: 18, kind: "wood" },
    ],
    waterPits: [{ x: 1000, y: 460, w: 200, h: 40 }],
    eggs: [
      { x: 250, y: 340 }, { x: 470, y: 280 }, { x: 1360, y: 350 },
    ],
    door: null,
    quiz: {
      x: 950, y: 380, w: 40, h: 80,
      question: "Contá los huevos. ¿Cuánto es 12 + 8?",
      visual: { kind: "addition", a: 12, b: 8 },
      options: [
        { text: "18" }, { text: "20" }, { text: "22" },
      ],
      correct: 1,
      feedback_ok: "¡Sí! 12 + 8 son 20. El puente está armado.",
      feedback_no: "Contá otra vez los huevos. Probá de nuevo.",
    },
    flag: { x: 2280, y: 360, w: 24, h: 100 },
  },

  {
    id: "granero",
    name: "El Granero",
    emoji: "🏚️",
    hint: "Identificá el animal correcto y abrí el granero.",
    width: 2400,
    theme: {
      sky: ["#f5d59c", "#fbe5b8", "#cb8f4f"],
      grass: "#8da34c", grassDark: "#6b8232", dirt: "#6b4226",
      mountain: "#8d7a4c", mountainDark: "#6b5a32",
      treeTrunk: "#503018", treeLeaves: "#7a8a3a",
      cloud: "rgba(255,250,230,0.9)",
    },
    parallaxFar: [
      { kind: "mountain", x: 250, scale: 1 },
      { kind: "mountain", x: 900, scale: 0.85 },
      { kind: "mountain", x: 1500, scale: 1.1 },
    ],
    parallaxMid: [
      { kind: "barn", x: 250, scale: 1.1 },
      { kind: "silo", x: 700, scale: 1 },
      { kind: "tree", x: 1100, scale: 0.95 },
      { kind: "barn", x: 1700, scale: 1 },
      { kind: "tree", x: 2200, scale: 1 },
    ],
    parallaxNear: [
      { kind: "bush", x: 200 }, { kind: "rock", x: 800 },
      { kind: "bush", x: 1400 }, { kind: "rock", x: 2100 },
    ],
    decor: [
      { kind: "hay", x: 150, y: 432 },
      { kind: "hay", x: 220, y: 432 },
      { kind: "hay", x: 900, y: 432 },
      { kind: "hay", x: 1380, y: 432 },
      { kind: "hay", x: 1900, y: 432 },
      { kind: "fence", x: 0, y: 444, len: 6 },
      { kind: "fence", x: 1240, y: 444, len: 5 },
    ],
    ambients: [
      { kind: "cow", x: 400, y: 422 },
      { kind: "horse", x: 1500, y: 416 },
      { kind: "chick", x: 700, y: 442 },
      { kind: "chick", x: 740, y: 442 },
      { kind: "chick", x: 720, y: 444 },
      { kind: "bird", x: -200, y: 110, vx: 1.2 },
    ],
    platforms: [
      { x: 0,    y: 460, w: 1100, h: 40, kind: "grass" },
      { x: 1240, y: 460, w: 700,  h: 40, kind: "grass" },
      { x: 1960, y: 460, w: 440,  h: 40, kind: "grass" },
      { x: 220, y: 380, w: 120, h: 18, kind: "wood" },
      { x: 420, y: 320, w: 120, h: 18, kind: "wood" },
      { x: 620, y: 260, w: 120, h: 18, kind: "wood" },
      // Carro de heno móvil (horizontal lento)
      { x: 820, y: 320, w: 120, h: 18, kind: "wood", moving: { axis: "x", range: [820, 1000], speed: 0.8, dir: 1 } },
      { x: 1340, y: 380, w: 120, h: 18, kind: "wood" },
      { x: 1540, y: 320, w: 120, h: 18, kind: "wood" },
      { x: 1740, y: 260, w: 120, h: 18, kind: "wood" },
    ],
    eggs: [
      { x: 270, y: 350 }, { x: 470, y: 290 }, { x: 670, y: 230 }, { x: 1390, y: 350 },
    ],
    door: null,
    quiz: {
      // Movido de 1170 → 1000 (estaba sobre el hueco 1100-1240, ahora bien dentro del suelo)
      x: 1000, y: 380, w: 40, h: 80,
      question: "¿Qué animal pone huevos?",
      options: [
        { text: "vaca",    pic: 2609 },
        { text: "gallina", pic: 2403 },
        { text: "caballo", pic: 2294 },
      ],
      correct: 1,
      feedback_ok: "¡Sí! Las gallinas son las que ponen huevos.",
      feedback_no: "Ese animal no pone huevos. Probá otra vez.",
    },
    flag: { x: 2300, y: 360, w: 24, h: 100 },
  },
];

// ============================================================
// Estado
// ============================================================
const state = {
  scene: "splash",
  worldIdx: -1,
  world: null,
  player: {
    x: 60, y: 420, w: 32, h: 32, vx: 0, vy: 0,
    onGround: false, facing: 1, flap: 0,
    scaleX: 1, scaleY: 1, targetSX: 1, targetSY: 1,
    coyote: 0, jumpBuffer: 0, walkAnim: 0,
  },
  camera: { x: 0, targetX: 0, shake: 0 },
  platforms: [], eggs: [], door: null, quiz: null, flag: null, theme: null,
  parallaxFar: [], parallaxMid: [], parallaxNear: [],
  decor: [], ambients: [], waterPits: [], enemies: [],
  knockback: 0,
  collected: 0,
  quizSolved: false,
  hint: "",
  hintTimer: 0,   // frames restantes para que el hint quede visible (0 = oculto)
  particles: [],
  globalT: 0,
};

let DAILY_FLAVOR = null;
let _bannerShown = false;

function applyFlavorToWorld(worldId) {
  if (!DAILY_FLAVOR || !DAILY_FLAVOR.palette[worldId]) return;
  if (!state.theme) return;
  state.theme.sky = DAILY_FLAVOR.palette[worldId].sky;
}

function showFlavorBanner(text) {
  flavorBannerEl.textContent = text;
  flavorBannerEl.classList.add("shown");
  setTimeout(() => flavorBannerEl.classList.remove("shown"), 6000);
}

// Setea un hint con timer auto-dismiss (~4s) y fade out en los últimos 30 frames.
function setHint(text, frames = 240) {
  state.hint = text;
  state.hintTimer = frames;
}

let paused = false;

// ============================================================
// Audio button
// ============================================================
function refreshAudioBtn() {
  audioBtn.textContent = isMuted() ? "🔇" : "🔊";
  audioBtn.setAttribute("aria-label", isMuted() ? "Encender música" : "Apagar música");
}
audioBtn.addEventListener("click", () => {
  // SINCRONICO — no await. iOS necesita que el unlock corra en el gesture stack.
  toggleMute();
  refreshAudioBtn();
});
refreshAudioBtn();

// ============================================================
// Stats persistencia
// ============================================================
const STATS_KEY = "pollito_stats";
function loadStats() {
  try { return JSON.parse(localStorage.getItem(STATS_KEY)) || { totalEggs: 0, runs: 0 }; }
  catch { return { totalEggs: 0, runs: 0 }; }
}
function saveStats(s) { try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch {} }
function bumpRuns() { const s = loadStats(); s.runs = (s.runs || 0) + 1; saveStats(s); }
function bumpEggs(n) { const s = loadStats(); s.totalEggs = (s.totalEggs || 0) + n; saveStats(s); }
function loadCompleted() {
  try { return new Set(JSON.parse(localStorage.getItem("pollito_done") || "[]")); }
  catch { return new Set(); }
}
function saveCompleted(set) {
  try { localStorage.setItem("pollito_done", JSON.stringify([...set])); } catch {}
}

// ============================================================
// Splash pollito (vector flat grande)
// ============================================================
function drawSplashPollito() {
  const c = splashPollitoCanvas;
  const dpr = window.devicePixelRatio || 1;
  c.width = 120 * dpr; c.height = 120 * dpr;
  c.style.width = "120px"; c.style.height = "120px";
  const x = c.getContext("2d");
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, 120, 120);
  x.save(); x.translate(60, 64); x.scale(2.6, 2.6);
  // Sombra plana
  x.fillStyle = "rgba(0,0,0,0.15)";
  x.beginPath(); x.ellipse(0, 22, 16, 4, 0, 0, Math.PI * 2); x.fill();
  // Cuerpo
  x.beginPath(); x.ellipse(0, 3, 16, 14, 0, 0, Math.PI * 2);
  x.fillStyle = "#ffd34a"; x.fill();
  x.strokeStyle = "#2a1d10"; x.lineWidth = 1.4; x.stroke();
  // Cabeza
  x.beginPath(); x.arc(8, -8, 10, 0, Math.PI * 2);
  x.fillStyle = "#ffd34a"; x.fill(); x.stroke();
  // Pancita
  x.beginPath(); x.ellipse(-2, 6, 10, 7, 0.1, 0, Math.PI * 2);
  x.fillStyle = "#fff4c0"; x.fill();
  // Ala
  x.beginPath(); x.ellipse(-2, 6, 7, 5, 0.2, 0, Math.PI * 2);
  x.fillStyle = "#e8a820"; x.fill();
  x.lineWidth = 1.2; x.stroke();
  // Pico
  x.beginPath(); x.moveTo(17, -8); x.lineTo(23, -6); x.lineTo(17, -3); x.closePath();
  x.fillStyle = "#f08a1a"; x.fill(); x.stroke();
  // Cresta (3 picos)
  x.beginPath();
  x.moveTo(2, -16); x.lineTo(4, -20); x.lineTo(6, -16);
  x.lineTo(8, -19); x.lineTo(10, -16); x.lineTo(12, -19); x.lineTo(14, -16);
  x.closePath();
  x.fillStyle = "#e85d5d"; x.fill(); x.stroke();
  // Ojo
  x.beginPath(); x.arc(11, -10, 2.8, 0, Math.PI * 2);
  x.fillStyle = "#fff"; x.fill(); x.stroke();
  x.beginPath(); x.arc(12, -10, 1.5, 0, Math.PI * 2);
  x.fillStyle = "#222"; x.fill();
  // Patas
  x.strokeStyle = "#f08a1a"; x.lineWidth = 2.6; x.lineCap = "round";
  x.beginPath();
  x.moveTo(-5, 16); x.lineTo(-5, 21);
  x.moveTo(5, 16);  x.lineTo(5, 21);
  x.stroke();
  x.lineWidth = 1.8;
  x.beginPath();
  x.moveTo(-7, 21); x.lineTo(-3, 21);
  x.moveTo(3, 21);  x.lineTo(7, 21);
  x.stroke();
  x.restore();
}
drawSplashPollito();

function refreshSplashStats() {
  const stats = loadStats();
  const completed = loadCompleted().size;
  if (stats.runs > 0 || completed > 0) {
    splashStatsEl.style.display = "grid";
    statWorldsEl.textContent = `${completed}/4`;
    statEggsEl.textContent = String(stats.totalEggs || 0);
    statRunsEl.textContent = String(stats.runs || 0);
  }
}
refreshSplashStats();

splashStartBtn.addEventListener("click", () => {
  // SINCRONICO — primera línea: unlock dentro del gesture stack.
  // iOS Safari pierde el gesture context si esperamos con await.
  unlock();
  splashOverlay.classList.remove("shown");
  bumpRuns();
  showSelector();
});

// ============================================================
// Selector / Pausa / Quiz / Win
// ============================================================
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
  pauseBtn.classList.remove("visible");
  worldPillEl.textContent = "";
  stopMusic();
  renderSelector();
}

function startWorld(idx) {
  const w = WORLDS[idx];
  state.scene = "playing";
  state.worldIdx = idx;
  state.world = w;
  state.platforms = w.platforms;
  state.eggs = w.eggs.map((e) => ({ ...e, taken: false, t: 0 }));
  state.enemies = (w.enemies || []).map((e) => ({ ...e, state: "patrol", sleepTimer: 0, stunBounce: 0, t: 0 }));
  state.knockback = 0;  // frames de invulnerabilidad después del knockback
  state.door = w.door ? { ...w.door, opened: false } : null;
  state.quiz = w.quiz ? { ...w.quiz, solved: false } : null;
  state.flag = { ...w.flag, descend: 0 };
  state.theme = { ...w.theme };
  applyFlavorToWorld(w.id);
  if (DAILY_FLAVOR && DAILY_FLAVOR.specialEvent && !_bannerShown) {
    showFlavorBanner(DAILY_FLAVOR.specialEvent.banner);
    _bannerShown = true;
  }
  state.parallaxFar = w.parallaxFar || [];
  state.parallaxMid = w.parallaxMid || [];
  state.parallaxNear = w.parallaxNear || [];
  state.decor = w.decor || [];
  state.ambients = (w.ambients || []).map((a) => ({ ...a, t: Math.random() * Math.PI * 2 }));
  state.waterPits = w.waterPits || [];
  state.player.x = 60; state.player.y = 420;
  state.player.vx = 0; state.player.vy = 0; state.player.onGround = false;
  state.player.scaleX = 1; state.player.scaleY = 1;
  state.player.targetSX = 1; state.player.targetSY = 1;
  state.player.coyote = 0; state.player.jumpBuffer = 0;
  state.camera.x = 0; state.camera.targetX = 0; state.camera.shake = 0;
  state.collected = 0;
  state.quizSolved = false;
  setHint(w.hint);
  state.particles = [];
  state.winTimer = 0;
  // Reset moving platforms a su posición inicial (range[0])
  for (const plat of state.platforms) {
    if (plat.moving) {
      if (plat.moving.axis === "x") plat.x = plat.moving.range[0];
      else plat.y = plat.moving.range[0];
      plat.moving.dir = 1;
    }
  }
  selectOverlay.classList.remove("shown");
  winOverlay.classList.remove("shown");
  quizOverlay.classList.remove("shown");
  worldPillEl.textContent = `${w.emoji} ${w.name}`;
  pauseBtn.classList.add("visible");
  updateHud();
  setMusicPattern(w.id);
  startMusic();
}

function updateHud(bump = false) {
  if (state.scene !== "playing" && state.scene !== "won") { hudEl.textContent = ""; return; }
  let txt = `🥚 ${state.collected}`;
  if (state.eggs.length) txt += ` / ${state.eggs.length}`;
  if (state.door && !state.door.opened) txt += `  ·  🚪 faltan ${Math.max(0, state.door.eggs_required - state.collected)}`;
  hudEl.textContent = txt;
  if (bump) {
    hudEl.classList.remove("bump");
    void hudEl.offsetWidth;  // forzar reflow para reiniciar animation
    hudEl.classList.add("bump");
  }
}

function renderQuizVisual(visual) {
  if (!visual) { quizVisualEl.style.display = "none"; quizVisualEl.innerHTML = ""; return; }
  quizVisualEl.style.display = "flex";
  quizVisualEl.innerHTML = "";
  if (visual.kind === "addition") {
    // Grupo A + Grupo B = ?
    const groupA = document.createElement("div");
    groupA.className = "quiz-visual-group";
    for (let i = 0; i < visual.a; i++) {
      const e = document.createElement("div"); e.className = "quiz-visual-egg"; groupA.appendChild(e);
    }
    const opPlus = document.createElement("div");
    opPlus.className = "quiz-visual-op"; opPlus.textContent = "+";
    const groupB = document.createElement("div");
    groupB.className = "quiz-visual-group";
    for (let i = 0; i < visual.b; i++) {
      const e = document.createElement("div"); e.className = "quiz-visual-egg"; groupB.appendChild(e);
    }
    const opEq = document.createElement("div");
    opEq.className = "quiz-visual-op"; opEq.textContent = "=";
    const q = document.createElement("div");
    q.className = "quiz-visual-op"; q.textContent = "?";
    quizVisualEl.append(groupA, opPlus, groupB, opEq, q);
  }
}

// Normaliza opciones que pueden ser string (legacy) o { text, pic }
function normalizeOptions(options) {
  return options.map((o) => typeof o === "string" ? { text: o } : o);
}

function openQuiz() {
  state.scene = "quiz";
  stopMusic();
  quizQEl.textContent = state.quiz.question;
  quizFbEl.textContent = "";
  quizOptsEl.innerHTML = "";
  // Hint educativo (ej. "Esa palabra es un SUSTANTIVO.")
  if (state.quiz.hintLine) {
    quizHintEl.textContent = state.quiz.hintLine;
    quizHintEl.style.display = "block";
  } else {
    quizHintEl.style.display = "none";
  }
  renderQuizVisual(state.quiz.visual);
  const opts = normalizeOptions(state.quiz.options);
  opts.forEach((opt, idx) => {
    const b = document.createElement("button");
    b.className = "quiz-opt" + (opt.pic ? "" : " no-pic");
    if (opt.pic) {
      const img = document.createElement("img");
      img.className = "quiz-opt-pic";
      img.src = `https://static.arasaac.org/pictograms/${opt.pic}/${opt.pic}_300.png`;
      img.alt = opt.text;
      // Si la imagen no carga, no mostrar broken icon
      img.onerror = () => { img.style.display = "none"; };
      b.appendChild(img);
    }
    const t = document.createElement("div");
    t.className = "quiz-opt-text";
    t.textContent = opt.text;
    b.appendChild(t);
    b.addEventListener("click", () => answerQuiz(idx, b));
    quizOptsEl.appendChild(b);
  });
  quizOverlay.classList.add("shown");
}

function answerQuiz(idx, btnEl) {
  if (idx === state.quiz.correct) {
    state.quiz.solved = true;
    state.quizSolved = true;
    if (btnEl) btnEl.classList.add("correct");
    quizFbEl.textContent = state.quiz.feedback_ok;
    sfx.quizOk();
    setTimeout(() => {
      quizOverlay.classList.remove("shown");
      state.scene = "playing";
      state.player.x = state.quiz.x + state.quiz.w + 5;
      setHint("¡Bien! Andá hasta el banderín.");
      startMusic();
      // Sparkles celebratorios
      for (let i = 0; i < 18; i++) spawnSparkle(state.quiz.x + 20, state.quiz.y + 30);
    }, 1400);
  } else {
    if (btnEl) {
      btnEl.classList.add("wrong");
      // Quitar el wrong después de la animación para permitir reintentos visuales claros
      setTimeout(() => btnEl.classList.remove("wrong"), 500);
    }
    quizFbEl.textContent = state.quiz.feedback_no;
    sfx.quizNo();
  }
}

// ============================================================
// Pausa
// ============================================================
function showPause() {
  if (state.scene !== "playing") return;
  paused = true;
  stopMusic();
  pauseOverlay.classList.add("shown");
}
function hidePause() {
  paused = false;
  pauseOverlay.classList.remove("shown");
  startMusic();
}
pauseBtn.addEventListener("click", showPause);
resumeBtn.addEventListener("click", hidePause);
pauseToSelectBtn.addEventListener("click", () => { hidePause(); showSelector(); });

window.addEventListener("keydown", (e) => {
  if (e.key === "p" || e.key === "P" || e.key === "Escape") {
    if (state.scene === "playing" && !paused) showPause();
    else if (paused) hidePause();
  }
});

// ============================================================
// Input
// ============================================================
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

// ============================================================
// Particles
// ============================================================
function spawnDust(x, y, n = 6) {
  for (let i = 0; i < n; i++) {
    state.particles.push({
      kind: "dust",
      x: x + (Math.random() - 0.5) * 16,
      y: y - Math.random() * 4,
      vx: (Math.random() - 0.5) * 1.4,
      vy: -Math.random() * 1.2,
      life: 24 + Math.random() * 8,
      maxLife: 32,
      r: 3 + Math.random() * 2,
    });
  }
}
function spawnSparkle(x, y, n = 1) {
  const colors = ["#ffd34a", "#fff", "#ffe69b", "#f3b620"];
  for (let i = 0; i < n; i++) {
    state.particles.push({
      kind: "sparkle",
      x: x + (Math.random() - 0.5) * 8,
      y: y + (Math.random() - 0.5) * 8,
      vx: (Math.random() - 0.5) * 3,
      vy: -1 - Math.random() * 2.5,
      life: 30 + Math.random() * 10,
      maxLife: 40,
      color: colors[Math.floor(Math.random() * colors.length)],
      r: 2 + Math.random() * 2,
    });
  }
}
function spawnFloatingText(x, y, text, color = "#ffd34a") {
  state.particles.push({
    kind: "text",
    x, y,
    vx: (Math.random() - 0.5) * 0.6,
    vy: -1.6,
    life: 50, maxLife: 50,
    text, color,
  });
}
function spawnFeather(x, y, facing = 1) {
  state.particles.push({
    kind: "feather",
    x, y,
    vx: -facing * (1 + Math.random()),
    vy: -1 - Math.random() * 0.8,
    life: 70, maxLife: 70,
    rot: Math.random() * Math.PI * 2,
    vrot: (Math.random() - 0.5) * 0.15,
    flutter: Math.random() * Math.PI * 2,
  });
}

function spawnConfetti(x, y, n = 60) {
  const colors = ["#ffd34a", "#e85d5d", "#5fb4e0", "#7ed957", "#d989ff", "#ff8c42"];
  for (let i = 0; i < n; i++) {
    state.particles.push({
      kind: "confetti",
      x, y,
      vx: (Math.random() - 0.5) * 8,
      vy: -3 - Math.random() * 5,
      life: 80 + Math.random() * 40,
      maxLife: 120,
      color: colors[Math.floor(Math.random() * colors.length)],
      r: 3 + Math.random() * 2,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.4,
    });
  }
}

function updateParticles() {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    if (p.kind === "text") {
      p.x += p.vx; p.y += p.vy;
      p.vy *= 0.96;
    } else if (p.kind === "feather") {
      p.flutter += 0.15;
      p.x += p.vx + Math.sin(p.flutter) * 0.5;
      p.y += p.vy;
      p.vy = Math.min(p.vy + 0.02, 0.4);
      p.vx *= 0.99;
      if (p.rot !== undefined) p.rot += p.vrot;
    } else {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += (p.kind === "confetti" ? 0.18 : 0.08);
      p.vx *= 0.98;
      if (p.rot !== undefined) p.rot += p.vrot;
    }
    p.life--;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
}

function drawParticles() {
  for (const p of state.particles) {
    const sx = worldToScreen(p.x);
    if (sx < -20 || sx > VIEW_W + 20) continue;
    const alpha = Math.max(0, p.life / p.maxLife);
    if (p.kind === "dust") {
      ctx.fillStyle = `rgba(190, 165, 130, ${alpha * 0.6})`;
      ctx.beginPath(); ctx.arc(sx, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    } else if (p.kind === "sparkle") {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.translate(sx, p.y);
      const s = p.r * (0.7 + alpha * 0.5);
      ctx.beginPath();
      // estrella de 4 puntas
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const rr = (i % 2 === 0) ? s : s * 0.4;
        const px = Math.cos(a) * rr;
        const py = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
      ctx.restore();
    } else if (p.kind === "confetti") {
      ctx.save();
      ctx.translate(sx, p.y);
      ctx.rotate(p.rot || 0);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.fillRect(-p.r, -p.r * 0.4, p.r * 2, p.r * 0.8);
      ctx.restore();
      ctx.globalAlpha = 1;
    } else if (p.kind === "text") {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = "bold 22px system-ui";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "#5b3a1a";
      ctx.fillText(p.text, sx + 1, p.y + 1);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, sx, p.y);
      ctx.restore();
    } else if (p.kind === "feather") {
      ctx.save();
      ctx.translate(sx, p.y);
      ctx.rotate(p.rot || 0);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#ffd34a";
      ctx.beginPath();
      ctx.ellipse(0, 0, 6, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#f3b620"; ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-6, 0); ctx.lineTo(6, 0);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// ============================================================
// Física
// ============================================================
function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function step() {
  state.globalT++;
  // Decrementar timer del hint (no necesita estar en gameplay frame)
  if (state.hintTimer > 0) state.hintTimer--;
  // Animar ambients y particles siempre (también después de ganar, para que el confetti caiga)
  for (const a of state.ambients) a.t += 0.05;
  // Pájaros avanzan en el cielo aún en pausa/ganado (es ambiente, no gameplay)
  for (const a of state.ambients) {
    if (a.kind === "bird") {
      a.x += a.vx;
      if (a.x > (state.world ? state.world.width : 2400) + 100) a.x = -100;
    }
  }
  updateParticles();
  state.camera.shake *= 0.85;

  // Mover plataformas móviles incluso durante cinemáticas
  if (state.world) {
    for (const plat of state.platforms) {
      if (!plat.moving) continue;
      const m = plat.moving;
      if (m.axis === "x") {
        plat.x += m.speed * m.dir;
        if (plat.x <= m.range[0]) { plat.x = m.range[0]; m.dir = 1; }
        if (plat.x >= m.range[1]) { plat.x = m.range[1]; m.dir = -1; }
      } else {
        plat.y += m.speed * m.dir;
        if (plat.y <= m.range[0]) { plat.y = m.range[0]; m.dir = 1; }
        if (plat.y >= m.range[1]) { plat.y = m.range[1]; m.dir = -1; }
      }
    }
  }

  // Cinemática de victoria
  if (state.scene === "winning") {
    const p = state.player;
    // Banderín baja gradualmente
    state.flag.descend = (state.flag.descend || 0) + 1.2;
    state.flag.descend = Math.min(state.flag.descend, 60);
    // Pollito pega un saltito de victoria periódicamente
    if (p.onGround && state.globalT % 30 === 0) {
      p.vy = JUMP_VY * 0.55;
      sfx.jump();
    }
    p.vy += GRAVITY; if (p.vy > MAX_FALL) p.vy = MAX_FALL;
    p.y += p.vy;
    p.onGround = false;
    for (const plat of state.platforms) {
      if (aabb(p, plat)) {
        if (p.vy > 0) { p.y = plat.y - p.h; p.vy = 0; p.onGround = true; }
      }
    }
    // Cuenta regresiva para mostrar overlay
    state.winTimer = (state.winTimer || 0) + 1;
    if (state.winTimer === 1) {
      // Confetti más cada cierto frame
      const done = loadCompleted();
      done.add(state.world.id);
      saveCompleted(done);
    }
    if (state.winTimer % 16 === 0 && state.winTimer < 80) {
      spawnConfetti(state.flag.x + 10, state.flag.y + 30, 25);
    }
    if (state.winTimer === 80) {
      const done = loadCompleted();
      const next = WORLDS.find((w) => !done.has(w.id));
      winTitleEl.textContent = `🎉 ¡Completaste ${state.world.name}!`;
      winMsgEl.textContent = next ? `Probá el próximo: ${next.emoji} ${next.name}.` : "Completaste todos los mundos. ¡Increíble!";
      state.scene = "won";
      winOverlay.classList.add("shown");
    }
    return;
  }

  if (state.scene !== "playing" || paused) return;
  const p = state.player;
  const W = state.world.width;

  // Movimiento horizontal — durante knockback no leemos input (la fuerza prima)
  if (state.knockback > 15) {
    p.vx *= 0.95; // friction natural, no input
  } else {
    if (keys.left) { p.vx = -MOVE_SPEED; p.facing = -1; }
    else if (keys.right) { p.vx = MOVE_SPEED; p.facing = 1; }
    else p.vx = 0;
  }

  // Jump buffer: si tocó saltar, lo registramos por unos frames
  if (keys.jump) p.jumpBuffer = JUMP_BUFFER_FRAMES;
  else p.jumpBuffer = Math.max(0, p.jumpBuffer - 1);

  // Coyote time: descontar
  if (p.onGround) p.coyote = COYOTE_FRAMES;
  else p.coyote = Math.max(0, p.coyote - 1);

  // Saltar si hay buffer Y coyote disponible
  if (p.jumpBuffer > 0 && p.coyote > 0) {
    p.vy = JUMP_VY;
    p.onGround = false;
    p.jumpBuffer = 0; p.coyote = 0;
    p.targetSX = 0.8; p.targetSY = 1.25;
    sfx.jump();
    spawnDust(p.x + p.w / 2, p.y + p.h, 4);
    spawnFeather(p.x + p.w / 2, p.y + p.h / 2, p.facing);
  }

  p.vy += GRAVITY;
  if (p.vy > MAX_FALL) p.vy = MAX_FALL;

  // Colisión X
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
  if (state.quiz && !state.quiz.solved && aabb(p, state.quiz)) {
    if (p.vx > 0) p.x = state.quiz.x - p.w;
    else if (p.vx < 0) p.x = state.quiz.x + state.quiz.w;
    openQuiz();
    p.vx = 0;
  }
  if (p.x < 0) p.x = 0;
  if (p.x + p.w > W) p.x = W - p.w;

  // Colisión Y
  p.y += p.vy;
  const wasOnGround = p.onGround;
  p.onGround = false;
  p.carrier = null;
  for (const plat of state.platforms) {
    if (aabb(p, plat)) {
      if (p.vy > 0) {
        const justLanded = !wasOnGround;
        p.y = plat.y - p.h;
        if (justLanded && p.vy > 4) {
          p.targetSX = 1.25; p.targetSY = 0.75;
          sfx.land();
          spawnDust(p.x + p.w / 2, p.y + p.h, 6);
        }
        p.vy = 0; p.onGround = true;
        if (plat.moving) p.carrier = plat;
      } else if (p.vy < 0) { p.y = plat.y + plat.h; p.vy = 0; }
    }
  }
  // Si está sobre una plataforma móvil, lo arrastra con ella
  if (p.carrier && p.carrier.moving) {
    const m = p.carrier.moving;
    if (m.axis === "x") p.x += m.speed * m.dir;
  }
  // Caer al pozo o al agua: respawn
  if (p.y > VIEW_H + 100) { p.x = 60; p.y = 420; p.vx = 0; p.vy = 0; }

  // Tween squash/stretch back to neutral
  p.scaleX += (p.targetSX - p.scaleX) * 0.18;
  p.scaleY += (p.targetSY - p.scaleY) * 0.18;
  p.targetSX += (1 - p.targetSX) * 0.12;
  p.targetSY += (1 - p.targetSY) * 0.12;

  // Walk anim (sin sonido — habría que diseñar uno suave; lo dejamos para iter futura)
  if (Math.abs(p.vx) > 0.1 && p.onGround) p.walkAnim += 0.3;
  p.flap = (p.flap + 1) % 30;

  // Idle breath
  if (Math.abs(p.vx) < 0.1 && p.onGround) {
    p.scaleY = 1 + Math.sin(state.globalT * 0.06) * 0.02;
    p.scaleX = 1 + Math.sin(state.globalT * 0.06) * -0.015;
  }

  // Física de huevos loose (dropeados por knockback del zorro)
  for (const egg of state.eggs) {
    if (egg.taken || !egg.loose || egg.settled) continue;
    egg.vy += 0.4;
    egg.x += egg.vx;
    egg.y += egg.vy;
    egg.vx *= 0.95;
    // Settle al tocar techo de una plataforma
    for (const plat of state.platforms) {
      if (egg.vy > 0 && egg.y >= plat.y - 8 && egg.y <= plat.y + 4 &&
          egg.x > plat.x && egg.x < plat.x + plat.w) {
        egg.y = plat.y - 8; egg.vy = -egg.vy * 0.3; egg.vx *= 0.5;
        if (Math.abs(egg.vy) < 1.5) { egg.vy = 0; egg.settled = true; }
      }
    }
    if (egg.y > 470) { egg.y = 470; egg.vy = 0; egg.settled = true; }
  }

  // Recoger huevos
  for (const egg of state.eggs) {
    if (egg.taken) continue;
    egg.t += 0.06;
    const box = { x: egg.x - 14, y: egg.y - 16, w: 28, h: 32 };
    if (aabb(p, box)) {
      egg.taken = true;
      state.collected++;
      if (egg.golden) {
        bumpEggs(5);
        sfx.win();
        for (let i = 0; i < 24; i++) spawnSparkle(egg.x, egg.y, 1);
        spawnFloatingText(egg.x, egg.y - 12, "+5", "#ffd34a");
        state.camera.shake = 6;
      } else {
        bumpEggs(1);
        sfx.egg();
        for (let i = 0; i < 10; i++) spawnSparkle(egg.x, egg.y, 1);
        spawnFloatingText(egg.x, egg.y - 8, "+1");
      }
      updateHud(true);
    }
  }

  // Abrir puerta
  if (state.door && !state.door.opened && state.collected >= state.door.eggs_required) {
    state.door.opened = true;
    setHint("¡Puerta abierta! Andá hasta el banderín.");
    sfx.door();
    state.camera.shake = 8;
    for (let i = 0; i < 14; i++) spawnSparkle(state.door.x + 15, state.door.y + 50);
    updateHud();
  }

  // Knockback timer (invulnerabilidad breve)
  if (state.knockback > 0) state.knockback--;

  // Update enemies (zorros)
  for (const e of state.enemies) {
    e.t++;
    if (e.state === "sleeping") {
      e.sleepTimer--;
      if (e.sleepTimer <= 0) {
        e.state = "patrol";
      }
      continue; // dormido = no patrulla
    }
    if (e.kind === "fox") {
      e.x += e.speed * e.dir;
      if (e.x <= e.range[0]) { e.x = e.range[0]; e.dir = 1; }
      if (e.x >= e.range[1]) { e.x = e.range[1]; e.dir = -1; }
      // Colisión con pollito
      const foxBox = { x: e.x - 24, y: e.y - 8, w: 48, h: 28 };
      if (aabb(p, foxBox) && state.knockback === 0) {
        // ¿Pollito viene desde arriba? (vy > 0 = cayendo, y player y < fox y - some margin)
        const fromAbove = p.vy > 1.5 && p.y + p.h < e.y + 4;
        if (fromAbove) {
          // STOMP: zorro se duerme, pollito rebota
          e.state = "sleeping";
          e.sleepTimer = 180; // 3s a 60fps
          p.vy = -8;
          p.targetSX = 0.85; p.targetSY = 1.2;
          sfx.quizOk();  // soft happy sound
          for (let i = 0; i < 12; i++) spawnSparkle(e.x, e.y, 1);
        } else {
          // SIDE HIT: knockback + drop 1 huevo (si tiene)
          p.vx = -e.dir * 5;
          p.vy = -6;
          p.x += -e.dir * 8;
          state.knockback = 45;
          sfx.quizNo();
          state.camera.shake = 6;
          // Dropear 1 huevo si tiene
          if (state.collected > 0) {
            state.collected--;
            updateHud(true);
            // Crear un "huevo loose" — agregar al array de eggs como recogible
            state.eggs.push({
              x: p.x + 20, y: p.y - 10, taken: false, t: 0,
              loose: true, vx: e.dir * 2, vy: -3, settled: false,
            });
            spawnFloatingText(p.x, p.y - 20, "-1", "#e85d5d");
          }
        }
      }
    }
  }

  // Llegar al banderín → arranca cinemática de victoria
  if (state.flag && state.scene === "playing" && aabb(p, state.flag)) {
    const ok = (!state.door || state.door.opened) && (!state.quiz || state.quiz.solved);
    if (ok) {
      state.scene = "winning";
      state.hint = "";
      state.flag.descend = 0;           // banderín comenzará a bajar
      state.flag.startY = state.flag.y;
      sfx.win();
      state.camera.shake = 12;
      spawnConfetti(state.flag.x + 10, state.flag.y + 30, 50);
      stopMusic();
    }
  }

  // Cámara con lerp + lookahead
  const lookahead = p.facing * 80;
  state.camera.targetX = Math.max(0, Math.min(W - VIEW_W, p.x + p.w / 2 - VIEW_W / 2 + lookahead));
  state.camera.x += (state.camera.targetX - state.camera.x) * 0.12;

  // Ambient sound triggers (raros, suaves)
  if (state.globalT % 600 === 100 && !isMuted()) {
    const hasCow = state.ambients.some((a) => a.kind === "cow");
    const hasSheep = state.ambients.some((a) => a.kind === "sheep");
    if (hasCow && Math.random() < 0.3) sfx.moo();
    else if (hasSheep && Math.random() < 0.3) sfx.baa();
  }

}

// ============================================================
// Render
// ============================================================
function worldToScreen(x) {
  const shake = state.camera.shake > 0.2 ? (Math.random() - 0.5) * state.camera.shake : 0;
  return x - state.camera.x + shake;
}

function drawSky() {
  if (!state.theme) return;
  const [c1, c2, c3] = state.theme.sky;
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, c1);
  grad.addColorStop(0.65, c2);
  grad.addColorStop(1, c3);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // Sol con glow + rayos sutiles
  const sunX = 700, sunY = 90;
  // rayos
  ctx.save();
  ctx.translate(sunX, sunY);
  ctx.fillStyle = "rgba(255, 245, 184, 0.18)";
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + state.globalT * 0.003;
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, -20); ctx.lineTo(8, -80); ctx.lineTo(-8, -80);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  const sunGrad = ctx.createRadialGradient(sunX, sunY, 5, sunX, sunY, 60);
  sunGrad.addColorStop(0, "#fff5b8");
  sunGrad.addColorStop(0.4, "#ffd76b");
  sunGrad.addColorStop(1, "rgba(255, 215, 107, 0)");
  ctx.fillStyle = sunGrad;
  ctx.beginPath(); ctx.arc(sunX, sunY, 60, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffd76b";
  ctx.beginPath(); ctx.arc(sunX, sunY, 26, 0, Math.PI * 2); ctx.fill();
  // Nubes con parallax muy lento
  ctx.fillStyle = state.theme.cloud;
  const camX = state.camera.x;
  drawCloud(120 - camX * 0.15, 70, 1);
  drawCloud(560 - camX * 0.15, 100, 0.9);
  drawCloud(380 - camX * 0.15, 50, 0.7);
  drawCloud(1100 - camX * 0.15, 80, 1);
  drawCloud(1700 - camX * 0.15, 100, 0.85);
  drawCloud(2300 - camX * 0.15, 75, 0.95);
}

function drawVignette() {
  const grad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.85);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}
function drawCloud(cx, cy, scale) {
  const OUT = "#2a1d10";
  // state.theme es null en el splash/select — fallback a blanco para no crashear
  const cloudColor = (state.theme && state.theme.cloud) || "rgba(255,255,255,0.92)";
  ctx.save(); ctx.translate(cx, cy); ctx.scale(scale, scale);
  // 4 arcos en path único para contorno integrado
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.arc(20, -4, 22, 0, Math.PI * 2);
  ctx.arc(44, 0, 18, 0, Math.PI * 2);
  ctx.arc(22, 10, 18, 0, Math.PI * 2);
  ctx.fillStyle = cloudColor; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4 / scale;
  ctx.stroke();
  ctx.restore();
}

// Parallax: itera capa y dibuja cada elemento con offset modulado
function drawParallaxLayer(items, factor, drawFn) {
  for (const it of items) {
    const sx = it.x - state.camera.x * factor;
    if (sx < -200 || sx > VIEW_W + 200) continue;
    drawFn(sx, it);
  }
}

function drawMountain(sx, it) {
  const scale = it.scale || 1;
  const w = 260 * scale, h = 180 * scale;
  const baseY = 460;
  const OUT = "#2a1d10";
  // Cuerpo principal con contorno
  ctx.beginPath();
  ctx.moveTo(sx, baseY);
  ctx.lineTo(sx + w * 0.45, baseY - h);
  ctx.lineTo(sx + w * 0.7, baseY - h * 0.6);
  ctx.lineTo(sx + w, baseY);
  ctx.closePath();
  ctx.fillStyle = state.theme.mountainDark; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Cara iluminada (sin re-stroke para no duplicar contorno interno)
  ctx.beginPath();
  ctx.moveTo(sx + w * 0.45, baseY - h);
  ctx.lineTo(sx + w * 0.5, baseY - h * 0.95);
  ctx.lineTo(sx + w * 0.95, baseY);
  ctx.lineTo(sx + w, baseY);
  ctx.closePath();
  ctx.fillStyle = state.theme.mountain; ctx.fill();
  // Pico nevado (triángulo blanco con contorno)
  ctx.beginPath();
  ctx.moveTo(sx + w * 0.45, baseY - h);
  ctx.lineTo(sx + w * 0.4, baseY - h * 0.86);
  ctx.lineTo(sx + w * 0.5, baseY - h * 0.92);
  ctx.closePath();
  ctx.fillStyle = "#ffffff"; ctx.fill();
  ctx.lineWidth = 1.2; ctx.stroke();
}

function drawTree(sx, it) {
  const scale = it.scale || 1;
  const baseY = 460;
  const trunkW = 16 * scale, trunkH = 50 * scale;
  const OUT = "#2a1d10";
  // Tronco
  ctx.beginPath();
  ctx.rect(sx - trunkW / 2, baseY - trunkH, trunkW, trunkH);
  ctx.fillStyle = state.theme.treeTrunk; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Línea vertical en el tronco (textura)
  ctx.strokeStyle = "rgba(60,30,15,0.4)"; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx, baseY - trunkH); ctx.lineTo(sx, baseY);
  ctx.stroke();
  // Copa (3 círculos en path único para contorno limpio)
  const cr = 30 * scale;
  ctx.beginPath();
  ctx.arc(sx - 14 * scale, baseY - trunkH - 5, cr * 0.9, 0, Math.PI * 2);
  ctx.arc(sx + 14 * scale, baseY - trunkH - 5, cr * 0.9, 0, Math.PI * 2);
  ctx.arc(sx, baseY - trunkH - 20 * scale, cr, 0, Math.PI * 2);
  ctx.fillStyle = state.theme.treeLeaves; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Highlight plano (sin contorno)
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath(); ctx.arc(sx - 4 * scale, baseY - trunkH - 24 * scale, cr * 0.4, 0, Math.PI * 2); ctx.fill();
}

function drawBarn(sx, it) {
  const scale = it.scale || 1;
  const baseY = 460;
  const w = 110 * scale, h = 80 * scale;
  const OUT = "#2a1d10";
  // Techo triangular oscuro
  ctx.beginPath();
  ctx.moveTo(sx, baseY - h);
  ctx.lineTo(sx + w / 2, baseY - h - 40 * scale);
  ctx.lineTo(sx + w, baseY - h);
  ctx.closePath();
  ctx.fillStyle = "#5b2a1a"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Cuerpo rojo
  ctx.beginPath(); ctx.rect(sx, baseY - h, w, h);
  ctx.fillStyle = "#c44e3b"; ctx.fill(); ctx.stroke();
  // Bandas blancas decorativas (líneas — no son fill)
  ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(sx, baseY - h * 0.6); ctx.lineTo(sx + w, baseY - h * 0.6);
  ctx.moveTo(sx, baseY - h * 0.3); ctx.lineTo(sx + w, baseY - h * 0.3);
  ctx.stroke();
  // Ventana superior
  ctx.beginPath();
  ctx.rect(sx + w / 2 - 12 * scale, baseY - h + 12 * scale, 24 * scale, 24 * scale);
  ctx.fillStyle = "#fff8d0"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Cruz de la ventana
  ctx.strokeStyle = "#5b3a1a"; ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(sx + w / 2, baseY - h + 12 * scale); ctx.lineTo(sx + w / 2, baseY - h + 36 * scale);
  ctx.moveTo(sx + w / 2 - 12 * scale, baseY - h + 24 * scale); ctx.lineTo(sx + w / 2 + 12 * scale, baseY - h + 24 * scale);
  ctx.stroke();
  // Puerta grande
  ctx.beginPath();
  ctx.rect(sx + w / 2 - 18 * scale, baseY - 40 * scale, 36 * scale, 40 * scale);
  ctx.fillStyle = "#5b2a1a"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Línea media puerta (apertura)
  ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(sx + w / 2, baseY - 40 * scale); ctx.lineTo(sx + w / 2, baseY); ctx.stroke();
}

function drawSilo(sx, it) {
  const scale = it.scale || 1;
  const baseY = 460;
  const w = 50 * scale, h = 110 * scale;
  const OUT = "#2a1d10";
  // Cuerpo cilíndrico (rectángulo)
  ctx.beginPath(); ctx.rect(sx, baseY - h, w, h);
  ctx.fillStyle = "#bfb8a8"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Cúpula superior (medio círculo aplanado)
  ctx.beginPath(); ctx.ellipse(sx + w / 2, baseY - h, w / 2, 14 * scale, 0, Math.PI, 0);
  ctx.fillStyle = "#5b5040"; ctx.fill();
  ctx.stroke();
  // Anillos horizontales
  ctx.strokeStyle = "rgba(60,40,30,0.5)"; ctx.lineWidth = 1.2;
  for (let i = 1; i <= 4; i++) {
    const yy = baseY - h + (h / 5) * i;
    ctx.beginPath(); ctx.moveTo(sx, yy); ctx.lineTo(sx + w, yy); ctx.stroke();
  }
  // Punta tipo escotilla arriba (rect chiquito)
  ctx.beginPath();
  ctx.rect(sx + w / 2 - 3, baseY - h - 18 * scale, 6, 6 * scale);
  ctx.fillStyle = "#5b5040"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.stroke();
}

function drawWindmill(sx, it) {
  const scale = it.scale || 1;
  const baseY = 460;
  const OUT = "#2a1d10";
  // Mástil (triángulo angosto)
  ctx.beginPath();
  ctx.moveTo(sx + 5 * scale, baseY);
  ctx.lineTo(sx + 22 * scale, baseY - 100 * scale);
  ctx.lineTo(sx + 38 * scale, baseY);
  ctx.closePath();
  ctx.fillStyle = "#8a7a5a"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Travesaños horizontales (textura)
  ctx.strokeStyle = "rgba(60,40,30,0.5)"; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx + 9 * scale, baseY - 70 * scale); ctx.lineTo(sx + 34 * scale, baseY - 70 * scale);
  ctx.moveTo(sx + 12 * scale, baseY - 40 * scale); ctx.lineTo(sx + 32 * scale, baseY - 40 * scale);
  ctx.stroke();
  // Aspas (4 elipses rotando)
  const cx = sx + 22 * scale, cy = baseY - 100 * scale;
  const rot = state.globalT * 0.012;
  ctx.fillStyle = "#fffcf0"; ctx.strokeStyle = OUT; ctx.lineWidth = 1.4;
  for (let i = 0; i < 4; i++) {
    const a = rot + i * Math.PI / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(36 * scale, -8 * scale);
    ctx.lineTo(40 * scale, 0);
    ctx.lineTo(36 * scale, 8 * scale);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  // Centro
  ctx.beginPath(); ctx.arc(cx, cy, 5 * scale, 0, Math.PI * 2);
  ctx.fillStyle = "#5b4226"; ctx.fill();
  ctx.lineWidth = 1.2; ctx.stroke();
}

function drawBush(sx) {
  const baseY = 460;
  const OUT = "#2a1d10";
  // 3 círculos en path único para contorno integrado
  ctx.beginPath();
  ctx.arc(sx, baseY - 4, 16, 0, Math.PI * 2);
  ctx.arc(sx - 12, baseY, 12, 0, Math.PI * 2);
  ctx.arc(sx + 12, baseY, 12, 0, Math.PI * 2);
  ctx.fillStyle = state.theme.grassDark; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Highlight más claro (sin contorno)
  ctx.beginPath(); ctx.arc(sx + 4, baseY - 8, 8, 0, Math.PI * 2);
  ctx.fillStyle = state.theme.grass; ctx.fill();
}

function drawRock(sx) {
  const baseY = 460;
  const OUT = "#2a1d10";
  // Piedra (elipse grande)
  ctx.beginPath(); ctx.ellipse(sx, baseY - 4, 18, 12, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#9c9088"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Highlight plano arriba
  ctx.beginPath(); ctx.ellipse(sx - 4, baseY - 8, 8, 5, 0.3, 0, Math.PI * 2);
  ctx.fillStyle = "#bdb1a5"; ctx.fill();
}

// Decoración foreground (mismo plano que el juego)
function drawDecor(d) {
  const sx = worldToScreen(d.x);
  if (sx < -150 || sx > VIEW_W + 150) return;
  if (d.kind === "fence") drawFence(sx, d);
  else if (d.kind === "gallinero") drawGallinero(sx, d);
  else if (d.kind === "flower") drawFlower(sx, d);
  else if (d.kind === "wheat") drawWheat(sx, d);
  else if (d.kind === "sunflower") drawSunflower(sx, d);
  else if (d.kind === "scarecrow") drawScarecrow(sx, d);
  else if (d.kind === "reeds") drawReeds(sx, d);
  else if (d.kind === "lilypad") drawLilypad(sx, d);
  else if (d.kind === "hay") drawHay(sx, d);
}

function drawFence(sx, d) {
  const len = d.len || 4;
  const segW = 36;
  const OUT = "#2a1d10";
  // Travesaños horizontales con contorno
  ctx.fillStyle = "#a87447"; ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.rect(sx, d.y - 2, segW * len, 4);
  ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.rect(sx, d.y + 10, segW * len, 4);
  ctx.fill(); ctx.stroke();
  // Estacas verticales (forma pentagonal)
  for (let i = 0; i < len; i++) {
    ctx.beginPath();
    const baseX = sx + i * segW;
    ctx.moveTo(baseX + 6, d.y - 10);
    ctx.lineTo(baseX + 12, d.y - 14);
    ctx.lineTo(baseX + 18, d.y - 10);
    ctx.lineTo(baseX + 18, d.y + 16);
    ctx.lineTo(baseX + 6, d.y + 16);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
}

function drawGallinero(sx, d) {
  const x = sx, y = d.y;
  const OUT = "#2a1d10";
  // Techo triangular rojo
  ctx.beginPath();
  ctx.moveTo(x - 4, y); ctx.lineTo(x + 30, y - 26); ctx.lineTo(x + 64, y);
  ctx.closePath();
  ctx.fillStyle = "#c44e3b"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Body amarillo
  ctx.beginPath(); ctx.rect(x, y, 60, 48);
  ctx.fillStyle = "#e8c87d"; ctx.fill(); ctx.stroke();
  // Tablones verticales (líneas)
  ctx.strokeStyle = "rgba(60,30,15,0.5)"; ctx.lineWidth = 1.2;
  for (let i = 12; i < 60; i += 12) {
    ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i, y + 48); ctx.stroke();
  }
  // Entrada redondeada
  ctx.beginPath();
  ctx.arc(x + 30, y + 38, 12, Math.PI, 0);
  ctx.lineTo(x + 18, y + 48);
  ctx.lineTo(x + 42, y + 48);
  ctx.closePath();
  ctx.fillStyle = "#3a2a1a"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Percha
  ctx.strokeStyle = "#6b4226"; ctx.lineWidth = 2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x + 22, y + 50); ctx.lineTo(x + 38, y + 50); ctx.stroke();
}

function drawFlower(sx, d) {
  const baseY = d.y;
  const OUT = "#2a1d10";
  // Tallo
  ctx.strokeStyle = "#4f8c46"; ctx.lineWidth = 2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(sx, baseY); ctx.lineTo(sx, baseY - 14); ctx.stroke();
  // Hoja
  ctx.beginPath(); ctx.ellipse(sx - 4, baseY - 6, 4, 2, 0.4, 0, Math.PI * 2);
  ctx.fillStyle = "#4f8c46"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.stroke();
  // 5 pétalos (path único)
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.ellipse(sx + Math.cos(a) * 4, baseY - 16 + Math.sin(a) * 4, 4, 5, a, 0, Math.PI * 2);
  }
  ctx.fillStyle = d.color || "#e85d5d"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.stroke();
  // Centro
  ctx.beginPath(); ctx.arc(sx, baseY - 16, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = "#ffd34a"; ctx.fill(); ctx.stroke();
}

function drawWheat(sx, d) {
  const baseY = d.y;
  const OUT = "#2a1d10";
  // Tallo curvo
  ctx.strokeStyle = "#a87420"; ctx.lineWidth = 1.6; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(sx, baseY);
  ctx.quadraticCurveTo(sx + 1, baseY - 14, sx, baseY - 28);
  ctx.stroke();
  // Espiga
  ctx.beginPath(); ctx.ellipse(sx, baseY - 30, 4, 9, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#e8b850"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.stroke();
  // Granos individuales (puntitos sin contorno)
  ctx.fillStyle = "#a87420";
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath(); ctx.ellipse(sx + i * 1.5, baseY - 30 + i * 3, 1, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Aristas (líneas finas hacia arriba)
  ctx.strokeStyle = "#a87420"; ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(sx - 1, baseY - 36); ctx.lineTo(sx - 3, baseY - 40);
  ctx.moveTo(sx + 1, baseY - 36); ctx.lineTo(sx + 3, baseY - 40);
  ctx.stroke();
}

function drawSunflower(sx, d) {
  const baseY = d.y;
  const OUT = "#2a1d10";
  // Tallo grueso
  ctx.strokeStyle = "#4f8c46"; ctx.lineWidth = 3.5; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(sx, baseY); ctx.lineTo(sx, baseY - 36); ctx.stroke();
  // Hoja grande
  ctx.beginPath(); ctx.ellipse(sx - 7, baseY - 14, 7, 3, 0.5, 0, Math.PI * 2);
  ctx.fillStyle = "#5da650"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.stroke();
  // 12 pétalos (path único)
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.ellipse(sx + Math.cos(a) * 6, baseY - 40 + Math.sin(a) * 6, 4.5, 7, a, 0, Math.PI * 2);
  }
  ctx.fillStyle = "#ffd34a"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.stroke();
  // Centro marrón
  ctx.beginPath(); ctx.arc(sx, baseY - 40, 6, 0, Math.PI * 2);
  ctx.fillStyle = "#5b3a1a"; ctx.fill(); ctx.stroke();
  // Texturita centro (puntitos)
  ctx.fillStyle = "#3a2a1a";
  for (const [dx, dy] of [[-2, -1], [2, -1], [0, 1], [-2, 2], [2, 2]]) {
    ctx.beginPath(); ctx.arc(sx + dx, baseY - 40 + dy, 0.8, 0, Math.PI * 2); ctx.fill();
  }
}

function drawScarecrow(sx, d) {
  const x = sx, y = d.y;
  const OUT = "#2a1d10";
  // Cruz de madera (poste vertical + travesaño)
  ctx.fillStyle = "#6b4226"; ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.rect(x + 8, y, 4, 50); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.rect(x, y + 18, 20, 4); ctx.fill(); ctx.stroke();
  // Ropa (camisa azul)
  ctx.beginPath(); ctx.rect(x + 2, y + 8, 16, 18);
  ctx.fillStyle = "#4a5db7"; ctx.fill(); ctx.stroke();
  // Cabeza (saco de arpillera)
  ctx.beginPath(); ctx.arc(x + 10, y + 4, 8, 0, Math.PI * 2);
  ctx.fillStyle = "#e8c87d"; ctx.fill(); ctx.stroke();
  // Sombrero
  ctx.beginPath();
  ctx.moveTo(x + 2, y - 2); ctx.lineTo(x + 10, y - 12); ctx.lineTo(x + 18, y - 2);
  ctx.closePath();
  ctx.fillStyle = "#8a6f3a"; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.rect(x - 1, y - 2, 22, 3);
  ctx.fill(); ctx.stroke();
  // Cara (ojos cruzados X y boca línea)
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x + 6, y + 2); ctx.lineTo(x + 9, y + 5);
  ctx.moveTo(x + 9, y + 2); ctx.lineTo(x + 6, y + 5);
  ctx.moveTo(x + 11, y + 2); ctx.lineTo(x + 14, y + 5);
  ctx.moveTo(x + 14, y + 2); ctx.lineTo(x + 11, y + 5);
  ctx.moveTo(x + 7, y + 8); ctx.lineTo(x + 13, y + 8);
  ctx.stroke();
}

function drawReeds(sx, d) {
  const baseY = d.y;
  const OUT = "#2a1d10";
  // Tallos con sway animation
  ctx.strokeStyle = "#5d7e3f"; ctx.lineWidth = 2; ctx.lineCap = "round";
  for (let i = 0; i < 5; i++) {
    const x = sx + i * 6;
    const sway = Math.sin(state.globalT * 0.03 + i) * 2;
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.quadraticCurveTo(x + sway, baseY - 14, x + sway * 1.5, baseY - 32);
    ctx.stroke();
  }
  // Espigas marrones en las puntas
  ctx.fillStyle = "#3a2a1a"; ctx.strokeStyle = OUT; ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const x = sx + i * 6;
    const sway = Math.sin(state.globalT * 0.03 + i) * 2;
    ctx.beginPath();
    ctx.ellipse(x + sway * 1.5, baseY - 34, 1.5, 5, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  }
}

function drawLilypad(sx, d) {
  const baseY = d.y;
  const OUT = "#2a1d10";
  // Elipse con muesca (lirio típico tiene corte)
  ctx.beginPath(); ctx.ellipse(sx, baseY, 22, 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#3d8c46"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.stroke();
  // Brillito plano
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.beginPath(); ctx.ellipse(sx - 4, baseY - 1, 8, 1.5, 0, 0, Math.PI * 2); ctx.fill();
  // Muesca radial (línea más oscura)
  ctx.strokeStyle = "#2a5a30"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(sx + 18, baseY); ctx.lineTo(sx + 8, baseY); ctx.stroke();
}

function drawHay(sx, d) {
  const baseY = d.y;
  const OUT = "#2a1d10";
  // Fardo (elipse achatada)
  ctx.beginPath(); ctx.ellipse(sx, baseY + 12, 26, 14, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#d6a04a"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Líneas verticales (briznas)
  ctx.strokeStyle = "#8a6f3a"; ctx.lineWidth = 1.2;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(sx + i * 7, baseY);
    ctx.lineTo(sx + i * 7, baseY + 24);
    ctx.stroke();
  }
  // Cinta horizontal medio
  ctx.strokeStyle = "rgba(107,66,38,0.7)"; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(sx - 26, baseY + 12); ctx.lineTo(sx + 26, baseY + 12); ctx.stroke();
}

// ===== Plataformas =====
function drawPlatform(p) {
  const sx = worldToScreen(p.x);
  if (sx + p.w < 0 || sx > VIEW_W) return;
  const OUT = "#2a1d10";
  if (p.kind === "grass") {
    // Tierra (parte de abajo)
    ctx.beginPath(); ctx.rect(sx, p.y + 12, p.w, p.h - 12);
    ctx.fillStyle = state.theme.dirt; ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
    // Pasto encima (verde claro)
    ctx.beginPath(); ctx.rect(sx, p.y, p.w, 14);
    ctx.fillStyle = state.theme.grass; ctx.fill();
    ctx.stroke();
    // Briznas verdes oscuras (líneas cortas)
    ctx.strokeStyle = state.theme.grassDark; ctx.lineWidth = 1.6; ctx.lineCap = "round";
    for (let x = sx + 6; x < sx + p.w; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, p.y - 1); ctx.lineTo(x + 1, p.y - 5);
      ctx.moveTo(x + 7, p.y - 1); ctx.lineTo(x + 8, p.y - 6);
      ctx.stroke();
    }
  } else if (p.kind === "wood") {
    // Madera
    ctx.beginPath(); ctx.rect(sx, p.y, p.w, p.h);
    ctx.fillStyle = p.moving ? "#c08855" : "#a87447"; ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
    // Línea horizontal media
    ctx.strokeStyle = "rgba(60,30,15,0.6)"; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(sx, p.y + p.h / 2); ctx.lineTo(sx + p.w, p.y + p.h / 2);
    ctx.stroke();
    // Clavos
    ctx.fillStyle = "#3a2a1a";
    ctx.beginPath(); ctx.arc(sx + 4, p.y + 4, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(sx + p.w - 4, p.y + 4, 1.5, 0, Math.PI * 2); ctx.fill();
    // Indicador de movimiento si móvil
    if (p.moving) {
      ctx.fillStyle = "#fff8d0";
      const m = p.moving;
      if (m.axis === "x") {
        ctx.beginPath();
        ctx.moveTo(sx + 4, p.y + p.h / 2 - 4); ctx.lineTo(sx + 9, p.y + p.h / 2);
        ctx.lineTo(sx + 4, p.y + p.h / 2 + 4); ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(sx + p.w - 4, p.y + p.h / 2 - 4); ctx.lineTo(sx + p.w - 9, p.y + p.h / 2);
        ctx.lineTo(sx + p.w - 4, p.y + p.h / 2 + 4); ctx.closePath(); ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(sx + p.w / 2 - 4, p.y + 4); ctx.lineTo(sx + p.w / 2, p.y + 9);
        ctx.lineTo(sx + p.w / 2 + 4, p.y + 4); ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(sx + p.w / 2 - 4, p.y + p.h - 4); ctx.lineTo(sx + p.w / 2, p.y + p.h - 9);
        ctx.lineTo(sx + p.w / 2 + 4, p.y + p.h - 4); ctx.closePath(); ctx.fill();
      }
    }
  } else if (p.kind === "lily") {
    // Lirio gigante (flotante)
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath(); ctx.ellipse(sx + p.w / 2, p.y + p.h + 4, p.w / 2 + 4, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(sx + p.w / 2, p.y + p.h / 2, p.w / 2, p.h, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#3d8c46"; ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
    // Veteado claro encima
    ctx.beginPath(); ctx.ellipse(sx + p.w / 2 - 6, p.y + 4, p.w / 3, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#52a55a"; ctx.fill();
    // Flor blanca encima
    ctx.fillStyle = "#fff"; ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(sx + p.w / 2 + Math.cos(a) * 4, p.y + 4 + Math.sin(a) * 2, 3, 2, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath(); ctx.arc(sx + p.w / 2, p.y + 4, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffd34a"; ctx.fill(); ctx.stroke();
  }
}

// Agua en pozos (estanque) — ondas animadas planas
function drawWaterPit(pit) {
  const sx = worldToScreen(pit.x);
  if (sx + pit.w < 0 || sx > VIEW_W) return;
  const OUT = "#2a1d10";
  // Sin gradient — dos rectángulos planos (oscuro abajo, medio arriba)
  ctx.fillStyle = state.theme.waterDark || "#3d8db0";
  ctx.fillRect(sx, pit.y + 12, pit.w, pit.h - 12);
  ctx.fillStyle = state.theme.water || "#5fb4e0";
  ctx.fillRect(sx, pit.y + 4, pit.w, 8);
  // Onda superficie (path único con contorno)
  ctx.beginPath();
  const t = state.globalT;
  ctx.moveTo(sx, pit.y + 4);
  for (let i = 0; i <= pit.w; i += 8) {
    const yy = pit.y + 4 + Math.sin(t * 0.06 + i * 0.15) * 2.5;
    ctx.lineTo(sx + i, yy);
  }
  ctx.lineTo(sx + pit.w, pit.y + 4);
  ctx.lineTo(sx, pit.y + 4);
  ctx.closePath();
  ctx.fillStyle = state.theme.water || "#5fb4e0";
  ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4;
  // Re-stroke solo la superficie superior, no el rectángulo entero
  ctx.beginPath();
  ctx.moveTo(sx, pit.y + 4);
  for (let i = 0; i <= pit.w; i += 8) {
    const yy = pit.y + 4 + Math.sin(t * 0.06 + i * 0.15) * 2.5;
    ctx.lineTo(sx + i, yy);
  }
  ctx.stroke();
  // Brillitos planos
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  for (let i = 0; i < pit.w; i += 18) {
    const yy = pit.y + 10 + Math.sin(t * 0.05 + i * 0.2) * 1.2;
    ctx.fillRect(sx + i + 4, yy, 6, 1.4);
  }
}

// ===== Ambient animals =====
function drawAmbient(a) {
  const sx = worldToScreen(a.x);
  if (sx < -120 || sx > VIEW_W + 120) {
    if (a.kind !== "bird") return;
  }
  if (a.kind === "cow") drawCow(sx, a);
  else if (a.kind === "sheep") drawSheep(sx, a);
  else if (a.kind === "horse") drawHorse(sx, a);
  else if (a.kind === "duck") drawDuck(sx, a);
  else if (a.kind === "chick") drawChick(sx, a);
  else if (a.kind === "pig") drawPig(sx, a);
  else if (a.kind === "goat") drawGoat(sx, a);
  else if (a.kind === "cat") drawCat(sx, a);
  else if (a.kind === "butterfly") drawButterfly(sx, a);
  else if (a.kind === "dragonfly") drawDragonfly(sx, a);
  else if (a.kind === "bird") drawBird(sx, a);
}

function drawCow(sx, a) {
  const y = a.y;
  const bob = Math.sin(a.t * 0.6) * 0.8;
  const OUT = "#2a1d10";
  // Sombra plana
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath(); ctx.ellipse(sx, y + 22, 24, 3, 0, 0, Math.PI * 2); ctx.fill();
  // Cuerpo
  ctx.beginPath(); ctx.ellipse(sx, y + bob, 28, 16, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Manchas (sin contorno — detalle)
  ctx.fillStyle = "#222";
  ctx.beginPath(); ctx.ellipse(sx - 10, y - 2 + bob, 8, 5, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(sx + 8, y + 4 + bob, 6, 4, -0.4, 0, Math.PI * 2); ctx.fill();
  // Cabeza
  ctx.beginPath(); ctx.ellipse(sx - 28, y - 4 + bob, 12, 10, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff"; ctx.fill();
  ctx.lineWidth = 1.4; ctx.stroke();
  // Hocico
  ctx.beginPath(); ctx.ellipse(sx - 36, y - 1 + bob, 5, 4, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#f8c2c8"; ctx.fill();
  ctx.lineWidth = 1.2; ctx.stroke();
  // Fosas nasales
  ctx.fillStyle = OUT;
  ctx.beginPath(); ctx.arc(sx - 37, y - 1 + bob, 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(sx - 35, y - 1 + bob, 0.7, 0, Math.PI * 2); ctx.fill();
  // Cuernos
  ctx.strokeStyle = "#a87447"; ctx.lineWidth = 2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(sx - 32, y - 12 + bob); ctx.lineTo(sx - 30, y - 16 + bob); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(sx - 26, y - 12 + bob); ctx.lineTo(sx - 24, y - 16 + bob); ctx.stroke();
  // Ojo
  ctx.fillStyle = OUT;
  ctx.beginPath(); ctx.arc(sx - 30, y - 6 + bob, 1.4, 0, Math.PI * 2); ctx.fill();
  // Patas (4 rectángulos con contorno)
  ctx.fillStyle = "#222"; ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
  for (const lx of [-18, -6, 8, 18]) {
    ctx.beginPath(); ctx.rect(sx + lx, y + 12, 4, 12);
    ctx.fill(); ctx.stroke();
  }
  // Cola
  ctx.strokeStyle = "#222"; ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(sx + 28, y - 2 + bob);
  ctx.quadraticCurveTo(sx + 36, y + 6, sx + 32, y + 12);
  ctx.stroke();
  // Borla de cola
  ctx.fillStyle = "#222";
  ctx.beginPath(); ctx.ellipse(sx + 32, y + 13, 2.5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
}

function drawSheep(sx, a) {
  const y = a.y;
  const nibble = Math.sin(a.t * 1.2) * 1.5;
  const OUT = "#2a1d10";
  // Sombra
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath(); ctx.ellipse(sx, y + 22, 20, 3, 0, 0, Math.PI * 2); ctx.fill();
  // Lana (cluster de círculos blancos con contorno como una nube)
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4;
  // Path único uniendo los puffs para un contorno limpio
  ctx.beginPath();
  ctx.arc(sx - 16, y - 2, 9, 0, Math.PI * 2);
  ctx.arc(sx - 8,  y - 6, 9, 0, Math.PI * 2);
  ctx.arc(sx,      y - 8, 9, 0, Math.PI * 2);
  ctx.arc(sx + 8,  y - 6, 9, 0, Math.PI * 2);
  ctx.arc(sx + 16, y - 2, 9, 0, Math.PI * 2);
  ctx.arc(sx, y + 2, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Cabeza oscura
  ctx.beginPath(); ctx.ellipse(sx - 22, y + 2 + nibble, 7, 6, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#3a3026"; ctx.fill(); ctx.stroke();
  // Oreja
  ctx.beginPath(); ctx.ellipse(sx - 22, y - 5 + nibble, 2, 4, -0.3, 0, Math.PI * 2);
  ctx.fillStyle = "#3a3026"; ctx.fill();
  // Ojo
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(sx - 24, y + 1 + nibble, 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = OUT;
  ctx.beginPath(); ctx.arc(sx - 24, y + 1 + nibble, 0.7, 0, Math.PI * 2); ctx.fill();
  // Patas
  ctx.fillStyle = "#3a3026"; ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
  for (const lx of [-14, -4, 6, 14]) {
    ctx.beginPath(); ctx.rect(sx + lx, y + 10, 3, 10);
    ctx.fill(); ctx.stroke();
  }
}

function drawHorse(sx, a) {
  const y = a.y;
  const bob = Math.sin(a.t * 0.4) * 0.6;
  const OUT = "#2a1d10";
  // Sombra
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath(); ctx.ellipse(sx, y + 24, 26, 3, 0, 0, Math.PI * 2); ctx.fill();
  // Cuerpo
  ctx.beginPath(); ctx.ellipse(sx, y + bob, 30, 14, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#8a5a30"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Cuello + cabeza juntos como un path
  ctx.beginPath();
  ctx.moveTo(sx - 22, y - 6 + bob);
  ctx.quadraticCurveTo(sx - 36, y - 26 + bob, sx - 32, y - 22 + bob);
  ctx.lineTo(sx - 28, y - 14 + bob);
  ctx.quadraticCurveTo(sx - 24, y - 6 + bob, sx - 16, y - 4 + bob);
  ctx.closePath();
  ctx.fillStyle = "#8a5a30"; ctx.fill(); ctx.stroke();
  // Hocico
  ctx.beginPath(); ctx.ellipse(sx - 38, y - 22 + bob, 6, 5, 0.3, 0, Math.PI * 2);
  ctx.fillStyle = "#a87447"; ctx.fill(); ctx.stroke();
  // Crin
  ctx.fillStyle = "#3a2010";
  ctx.beginPath();
  ctx.moveTo(sx - 30, y - 24 + bob);
  ctx.lineTo(sx - 24, y - 32 + bob);
  ctx.lineTo(sx - 20, y - 22 + bob);
  ctx.lineTo(sx - 14, y - 22 + bob);
  ctx.lineTo(sx - 18, y - 14 + bob);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // Ojo
  ctx.fillStyle = OUT;
  ctx.beginPath(); ctx.arc(sx - 36, y - 22 + bob, 1.2, 0, Math.PI * 2); ctx.fill();
  // Patas con cascos negros
  ctx.fillStyle = "#8a5a30"; ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
  for (const lx of [-22, -10, 8, 22]) {
    ctx.beginPath(); ctx.rect(sx + lx, y + 12, 4, 14);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#3a2010";
    ctx.beginPath(); ctx.rect(sx + lx, y + 24, 4, 2); ctx.fill();
    ctx.fillStyle = "#8a5a30";
  }
  // Cola
  ctx.fillStyle = "#3a2010"; ctx.strokeStyle = OUT;
  ctx.beginPath();
  ctx.moveTo(sx + 28, y - 4 + bob);
  ctx.quadraticCurveTo(sx + 42, y + 8, sx + 36, y + 18);
  ctx.lineTo(sx + 28, y + 6);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
}

function drawDuck(sx, a) {
  const y = a.y;
  const bob = Math.sin(a.t * 1.5) * 1.2;
  const OUT = "#2a1d10";
  // Reflejo de agua bajo el pato (líneas onduladas)
  ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx - 20, y + 12 + bob);
  ctx.quadraticCurveTo(sx - 10, y + 10 + bob, sx, y + 12 + bob);
  ctx.quadraticCurveTo(sx + 10, y + 14 + bob, sx + 20, y + 12 + bob);
  ctx.stroke();
  // Cuerpo flotando
  ctx.beginPath(); ctx.ellipse(sx, y + bob, 16, 10, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Cola levantada
  ctx.beginPath();
  ctx.moveTo(sx - 12, y - 4 + bob);
  ctx.lineTo(sx - 20, y - 8 + bob);
  ctx.lineTo(sx - 14, y - 2 + bob);
  ctx.closePath();
  ctx.fillStyle = "#ffffff"; ctx.fill(); ctx.stroke();
  // Cabeza
  ctx.beginPath(); ctx.arc(sx + 12, y - 6 + bob, 7, 0, Math.PI * 2);
  ctx.fillStyle = "#3a7a3a"; ctx.fill(); ctx.stroke();
  // Pico
  ctx.beginPath();
  ctx.moveTo(sx + 17, y - 6 + bob);
  ctx.lineTo(sx + 25, y - 5 + bob);
  ctx.lineTo(sx + 17, y - 3 + bob);
  ctx.closePath();
  ctx.fillStyle = "#ffb030"; ctx.fill();
  ctx.lineWidth = 1.2; ctx.stroke();
  // Ojo
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(sx + 13, y - 7 + bob, 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = OUT;
  ctx.beginPath(); ctx.arc(sx + 13, y - 7 + bob, 0.7, 0, Math.PI * 2); ctx.fill();
}

function drawChick(sx, a) {
  const y = a.y;
  const hop = Math.abs(Math.sin(a.t * 3)) * 2;
  const OUT = "#2a1d10";
  // Sombra
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath(); ctx.ellipse(sx, y + 8, 7, 1.5, 0, 0, Math.PI * 2); ctx.fill();
  // Cuerpo
  ctx.beginPath(); ctx.ellipse(sx, y - hop, 7, 6, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#ffe080"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.stroke();
  // Cabeza
  ctx.beginPath(); ctx.arc(sx + 3, y - 4 - hop, 5, 0, Math.PI * 2);
  ctx.fillStyle = "#ffe080"; ctx.fill(); ctx.stroke();
  // Pico
  ctx.beginPath();
  ctx.moveTo(sx + 7, y - 4 - hop);
  ctx.lineTo(sx + 11, y - 3 - hop);
  ctx.lineTo(sx + 7, y - 2 - hop);
  ctx.closePath();
  ctx.fillStyle = "#f08a1a"; ctx.fill(); ctx.stroke();
  // Ojo
  ctx.fillStyle = OUT;
  ctx.beginPath(); ctx.arc(sx + 5, y - 5 - hop, 0.9, 0, Math.PI * 2); ctx.fill();
  // Patas
  ctx.strokeStyle = "#f08a1a"; ctx.lineWidth = 1.6; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(sx - 2, y + 4 - hop); ctx.lineTo(sx - 2, y + 7 - hop);
  ctx.moveTo(sx + 2, y + 4 - hop); ctx.lineTo(sx + 2, y + 7 - hop);
  ctx.stroke();
}

function drawPig(sx, a) {
  const y = a.y;
  const bob = Math.sin(a.t * 0.5) * 0.6;
  const OUT = "#2a1d10";
  // Sombra
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath(); ctx.ellipse(sx, y + 20, 22, 3, 0, 0, Math.PI * 2); ctx.fill();
  // Cuerpo redondito
  ctx.beginPath(); ctx.ellipse(sx, y + bob, 24, 14, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#f5b8b0"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Cabeza redonda
  ctx.beginPath(); ctx.arc(sx - 22, y - 2 + bob, 10, 0, Math.PI * 2);
  ctx.fillStyle = "#f5b8b0"; ctx.fill(); ctx.stroke();
  // Hocico (círculo más oscuro con 2 puntos)
  ctx.beginPath(); ctx.ellipse(sx - 30, y - 1 + bob, 5, 4, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#d68a82"; ctx.fill();
  ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = OUT;
  ctx.beginPath(); ctx.arc(sx - 31, y - 1 + bob, 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(sx - 29, y - 1 + bob, 0.7, 0, Math.PI * 2); ctx.fill();
  // Orejas (triángulos)
  ctx.fillStyle = "#f5b8b0";
  ctx.beginPath();
  ctx.moveTo(sx - 26, y - 11 + bob); ctx.lineTo(sx - 22, y - 16 + bob); ctx.lineTo(sx - 19, y - 9 + bob);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sx - 16, y - 9 + bob); ctx.lineTo(sx - 14, y - 14 + bob); ctx.lineTo(sx - 12, y - 8 + bob);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // Ojo
  ctx.fillStyle = OUT;
  ctx.beginPath(); ctx.arc(sx - 24, y - 4 + bob, 1.2, 0, Math.PI * 2); ctx.fill();
  // Patas
  ctx.fillStyle = "#f5b8b0";
  for (const lx of [-14, -2, 10, 20]) {
    ctx.beginPath(); ctx.rect(sx + lx, y + 10, 4, 10);
    ctx.fill(); ctx.stroke();
  }
  // Colita rizada
  ctx.strokeStyle = "#d68a82"; ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(sx + 26, y - 2 + bob, 3, 0, Math.PI * 1.5);
  ctx.stroke();
}

function drawGoat(sx, a) {
  const y = a.y;
  const bob = Math.sin(a.t * 0.7) * 0.6;
  const OUT = "#2a1d10";
  // Sombra
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath(); ctx.ellipse(sx, y + 22, 20, 3, 0, 0, Math.PI * 2); ctx.fill();
  // Cuerpo
  ctx.beginPath(); ctx.ellipse(sx, y + bob, 22, 13, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#cfc7b4"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Cabeza alargada
  ctx.beginPath(); ctx.ellipse(sx - 22, y - 4 + bob, 10, 7, -0.2, 0, Math.PI * 2);
  ctx.fillStyle = "#cfc7b4"; ctx.fill(); ctx.stroke();
  // Hocico
  ctx.beginPath(); ctx.ellipse(sx - 30, y - 2 + bob, 4, 3, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#7a705a"; ctx.fill();
  // Cuernos curvos
  ctx.strokeStyle = "#7a705a"; ctx.lineWidth = 2; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(sx - 22, y - 11 + bob);
  ctx.quadraticCurveTo(sx - 18, y - 18 + bob, sx - 14, y - 14 + bob);
  ctx.stroke();
  // Barba (pequeño triángulo bajo el hocico)
  ctx.fillStyle = "#cfc7b4";
  ctx.beginPath();
  ctx.moveTo(sx - 30, y + 1 + bob);
  ctx.lineTo(sx - 30, y + 5 + bob);
  ctx.lineTo(sx - 28, y + 2 + bob);
  ctx.closePath();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
  ctx.fill(); ctx.stroke();
  // Ojo
  ctx.fillStyle = OUT;
  ctx.beginPath(); ctx.arc(sx - 24, y - 5 + bob, 1.2, 0, Math.PI * 2); ctx.fill();
  // Patas
  ctx.fillStyle = "#cfc7b4"; ctx.lineWidth = 1.2;
  for (const lx of [-14, -4, 6, 14]) {
    ctx.beginPath(); ctx.rect(sx + lx, y + 10, 3, 12);
    ctx.fill(); ctx.stroke();
  }
  // Cola corta
  ctx.fillStyle = "#cfc7b4";
  ctx.beginPath(); ctx.ellipse(sx + 22, y - 4 + bob, 3, 4, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
}

function drawCat(sx, a) {
  const y = a.y;
  const bob = Math.sin(a.t * 0.5) * 0.5;
  const OUT = "#2a1d10";
  // Sombra
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath(); ctx.ellipse(sx, y + 16, 14, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  // Cuerpo (gato sentado)
  ctx.beginPath(); ctx.ellipse(sx, y + 4 + bob, 12, 12, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#e89048"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Rayas en el cuerpo
  ctx.strokeStyle = "#a85a20"; ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(sx - 8, y + bob); ctx.lineTo(sx + 8, y + bob);
  ctx.moveTo(sx - 7, y + 5 + bob); ctx.lineTo(sx + 7, y + 5 + bob);
  ctx.stroke();
  // Cabeza
  ctx.beginPath(); ctx.arc(sx, y - 6 + bob, 8, 0, Math.PI * 2);
  ctx.fillStyle = "#e89048"; ctx.strokeStyle = OUT; ctx.lineWidth = 1.4;
  ctx.fill(); ctx.stroke();
  // Orejas triangulares
  ctx.fillStyle = "#e89048";
  ctx.beginPath();
  ctx.moveTo(sx - 7, y - 12 + bob); ctx.lineTo(sx - 5, y - 18 + bob); ctx.lineTo(sx - 2, y - 11 + bob);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sx + 2, y - 11 + bob); ctx.lineTo(sx + 5, y - 18 + bob); ctx.lineTo(sx + 7, y - 12 + bob);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // Ojos
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(sx - 3, y - 7 + bob, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(sx + 3, y - 7 + bob, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = OUT;
  ctx.beginPath(); ctx.arc(sx - 3, y - 7 + bob, 0.8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(sx + 3, y - 7 + bob, 0.8, 0, Math.PI * 2); ctx.fill();
  // Nariz triangular pequeña
  ctx.fillStyle = "#f8c2c8";
  ctx.beginPath();
  ctx.moveTo(sx - 1, y - 4 + bob); ctx.lineTo(sx + 1, y - 4 + bob); ctx.lineTo(sx, y - 2 + bob);
  ctx.closePath(); ctx.fill();
  // Bigotes
  ctx.strokeStyle = OUT; ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(sx - 8, y - 3 + bob); ctx.lineTo(sx - 3, y - 3 + bob);
  ctx.moveTo(sx + 3, y - 3 + bob); ctx.lineTo(sx + 8, y - 3 + bob);
  ctx.stroke();
  // Cola enrollada al frente
  ctx.strokeStyle = "#e89048"; ctx.lineWidth = 4; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(sx + 10, y + 10 + bob);
  ctx.quadraticCurveTo(sx + 18, y + 6 + bob, sx + 16, y + bob);
  ctx.stroke();
  ctx.strokeStyle = "#a85a20"; ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(sx + 12, y + 9 + bob); ctx.lineTo(sx + 17, y + 5 + bob);
  ctx.stroke();
}

function drawButterfly(sx, a) {
  const y = a.y + Math.sin(a.t * 1.2) * 10;
  const flap = Math.sin(a.t * 4) * 0.6 + 0.5;
  const OUT = "#2a1d10";
  const hue = a.hue || "#e85d5d";
  ctx.save();
  ctx.translate(sx, y);
  ctx.scale(flap, 1);
  // 4 alas en path único para contorno limpio
  ctx.beginPath();
  ctx.ellipse(-6, -4, 7, 9, 0.3, 0, Math.PI * 2);
  ctx.ellipse(6, -4, 7, 9, -0.3, 0, Math.PI * 2);
  ctx.ellipse(-5, 5, 5, 6, -0.3, 0, Math.PI * 2);
  ctx.ellipse(5, 5, 5, 6, 0.3, 0, Math.PI * 2);
  ctx.fillStyle = hue; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.restore();
  // Cuerpo (negro, sin escala de flap)
  ctx.beginPath();
  ctx.ellipse(sx, y, 1.5, 7, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#2a1d10"; ctx.fill();
  // Antenas
  ctx.strokeStyle = OUT; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx - 0.8, y - 6); ctx.lineTo(sx - 2, y - 9);
  ctx.moveTo(sx + 0.8, y - 6); ctx.lineTo(sx + 2, y - 9);
  ctx.stroke();
}

function drawDragonfly(sx, a) {
  const y = a.y + Math.sin(a.t * 2) * 6;
  const OUT = "#2a1d10";
  const hue = a.hue || "#5fb4e0";
  // Alas (4 elipses translúcidas con contorno)
  ctx.fillStyle = "rgba(180,220,255,0.55)";
  ctx.strokeStyle = OUT; ctx.lineWidth = 1;
  for (const sgn of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sx + sgn * 8, y - 2, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(sx + sgn * 8, y + 2, 7, 2.5, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  }
  // Cuerpo alargado
  ctx.beginPath();
  ctx.ellipse(sx, y, 2.5, 8, 0, 0, Math.PI * 2);
  ctx.fillStyle = hue; ctx.fill();
  ctx.lineWidth = 1.2; ctx.stroke();
  // Cabeza
  ctx.beginPath();
  ctx.arc(sx, y - 6, 2.2, 0, Math.PI * 2);
  ctx.fillStyle = "#222"; ctx.fill(); ctx.stroke();
}

function drawBird(sx, a) {
  const y = a.y + Math.sin(a.t * 2) * 3;
  const flap = Math.sin(a.t * 6) * 4;
  // Solo silueta — un "V" suave con contorno
  ctx.strokeStyle = "#2a1d10"; ctx.lineWidth = 2; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(sx - 9, y + flap);
  ctx.quadraticCurveTo(sx - 4, y - 3, sx, y);
  ctx.quadraticCurveTo(sx + 4, y - 3, sx + 9, y + flap);
  ctx.stroke();
}

// ===== Huevos, puerta, quiz marker, banderín =====
function drawEgg(egg) {
  if (egg.taken) return;
  const sx = worldToScreen(egg.x);
  if (sx < -30 || sx > VIEW_W + 30) return;
  const bob = egg.settled === false ? 0 : Math.sin(egg.t * 1.5) * 2;
  ctx.save(); ctx.translate(sx, egg.y + bob);
  // Sombra plana
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.beginPath(); ctx.ellipse(0, 16, 9, 2, 0, 0, Math.PI * 2); ctx.fill();
  if (egg.golden) {
    // Halo dorado pulsante (no gradient, círculos translúcidos plain)
    const pulse = 20 + Math.sin(egg.t * 2) * 4;
    ctx.fillStyle = "rgba(255, 220, 100, 0.30)";
    ctx.beginPath(); ctx.arc(0, 0, pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255, 200, 60, 0.18)";
    ctx.beginPath(); ctx.arc(0, 0, pulse * 0.7, 0, Math.PI * 2); ctx.fill();
    // Huevo dorado
    ctx.beginPath(); ctx.ellipse(0, 0, 12, 15, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#ffd34a"; ctx.fill();
    ctx.strokeStyle = "#a87420"; ctx.lineWidth = 1.8; ctx.stroke();
    // Reflejo
    ctx.beginPath(); ctx.ellipse(-4, -5, 3, 5, 0.4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fill();
    // Sparkles orbitando
    for (let i = 0; i < 3; i++) {
      const ang = egg.t * 0.5 + i * (Math.PI * 2 / 3);
      const px = Math.cos(ang) * 18; const py = Math.sin(ang) * 12;
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(px, py, 1.5, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    // Huevo normal
    ctx.beginPath(); ctx.ellipse(0, 0, 11, 14, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#fff7d1"; ctx.fill();
    ctx.strokeStyle = "#2a1d10"; ctx.lineWidth = 1.4; ctx.stroke();
    // Reflejo
    ctx.beginPath(); ctx.ellipse(-4, -5, 3, 4, 0.4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fill();
  }
  ctx.restore();
}

function drawFox(fox) {
  const sx = worldToScreen(fox.x);
  if (sx < -50 || sx > VIEW_W + 50) return;
  const y = fox.y;
  const OUT = "#2a1d10";
  // Sombra
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath(); ctx.ellipse(sx, y + 18, 18, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  // Si está dormido: posición horizontal + Zzz arriba
  if (fox.state === "sleeping") {
    ctx.save();
    ctx.translate(sx, y);
    // Cuerpo acostado (elipse horizontal alargada)
    ctx.beginPath(); ctx.ellipse(0, 6, 22, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#d97a3e"; ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
    // Cabeza a la izquierda
    ctx.beginPath(); ctx.arc(-22, 4, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#d97a3e"; ctx.fill(); ctx.stroke();
    // Hocico claro
    ctx.beginPath(); ctx.ellipse(-28, 5, 4, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill();
    // Ojo cerrado (línea)
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-24, 3); ctx.lineTo(-22, 3); ctx.stroke();
    // Oreja
    ctx.fillStyle = "#a85510";
    ctx.beginPath();
    ctx.moveTo(-22, -1); ctx.lineTo(-19, -6); ctx.lineTo(-16, -1); ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Cola
    ctx.fillStyle = "#d97a3e";
    ctx.beginPath();
    ctx.moveTo(20, 4);
    ctx.quadraticCurveTo(32, -2, 28, 8);
    ctx.lineTo(20, 8);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Punta blanca de la cola
    ctx.beginPath(); ctx.ellipse(30, 4, 3, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill();
    ctx.restore();
    // Zzz flotando
    ctx.fillStyle = "#88aacc";
    ctx.font = "bold 14px system-ui";
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    const wiggle = Math.sin(fox.t * 0.1) * 2;
    ctx.fillText("z", sx + 12 + wiggle, y - 14);
    ctx.fillText("z", sx + 18 - wiggle, y - 20);
    ctx.fillText("z", sx + 24 + wiggle, y - 26);
    return;
  }
  // Patrolling: zorro de pie, vector flat
  ctx.save();
  ctx.translate(sx, y);
  if (fox.dir === -1) ctx.scale(-1, 1);
  // Cuerpo
  ctx.beginPath(); ctx.ellipse(0, 0, 18, 10, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#d97a3e"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Cabeza
  ctx.beginPath(); ctx.arc(-16, -6, 8, 0, Math.PI * 2);
  ctx.fillStyle = "#d97a3e"; ctx.fill(); ctx.stroke();
  // Hocico claro
  ctx.beginPath(); ctx.ellipse(-22, -4, 4, 3, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#fff"; ctx.fill();
  // Orejas triangulares
  ctx.fillStyle = "#a85510";
  ctx.beginPath();
  ctx.moveTo(-19, -12); ctx.lineTo(-16, -18); ctx.lineTo(-13, -12);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-12, -11); ctx.lineTo(-9, -16); ctx.lineTo(-6, -10);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // Ojo
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(-18, -7, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = OUT;
  ctx.beginPath(); ctx.arc(-18, -7, 0.9, 0, Math.PI * 2); ctx.fill();
  // Patas (un walk cycle simple)
  const walk = Math.sin(fox.t * 0.15) * 1.5;
  ctx.fillStyle = "#5b3a1a";
  ctx.beginPath(); ctx.rect(-12, 8 - Math.abs(walk), 3, 8); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.rect(-3, 8 + Math.abs(walk), 3, 8); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.rect(6, 8 - Math.abs(walk), 3, 8); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.rect(13, 8 + Math.abs(walk), 3, 8); ctx.fill(); ctx.stroke();
  // Cola alta (atrás derecha del cuerpo)
  ctx.fillStyle = "#d97a3e";
  ctx.beginPath();
  ctx.moveTo(16, -2);
  ctx.quadraticCurveTo(28, -8, 24, 6);
  ctx.lineTo(16, 4);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // Punta blanca
  ctx.beginPath(); ctx.ellipse(26, -2, 3, 3, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#fff"; ctx.fill();
  ctx.restore();
}

function drawCrow(enemy) {
  const sx = worldToScreen(enemy.x);
  if (sx < -50 || sx > VIEW_W + 50) return;
  const y = enemy.y;
  const OUT = "#2a1d10";
  const flap = Math.sin(enemy.t * 0.4) * 0.4 + 0.6;
  // Sombra en el aire (más chica = más alto)
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.beginPath(); ctx.ellipse(sx, y + 35, 14, 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(sx, y);
  // Cuerpo
  ctx.beginPath(); ctx.ellipse(0, 0, 12, 8, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#28201a"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Alas (escaladas verticalmente con flap)
  ctx.save();
  ctx.scale(1, flap);
  ctx.beginPath();
  ctx.ellipse(-10, -2, 12, 7, -0.3, 0, Math.PI * 2);
  ctx.ellipse(10, -2, 12, 7, 0.3, 0, Math.PI * 2);
  ctx.fillStyle = "#4a3c30"; ctx.fill();
  ctx.lineWidth = 1.4; ctx.stroke();
  ctx.restore();
  // Cabeza
  ctx.beginPath(); ctx.arc(0, -8, 5, 0, Math.PI * 2);
  ctx.fillStyle = "#28201a"; ctx.fill(); ctx.stroke();
  // Pico
  ctx.beginPath();
  ctx.moveTo(4, -8); ctx.lineTo(10, -7); ctx.lineTo(4, -6);
  ctx.closePath();
  ctx.fillStyle = "#a85510"; ctx.fill(); ctx.stroke();
  // Ojo
  ctx.fillStyle = "#ffd34a";
  ctx.beginPath(); ctx.arc(2, -9, 1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawFrog(enemy) {
  const sx = worldToScreen(enemy.x);
  if (sx < -50 || sx > VIEW_W + 50) return;
  const y = enemy.y;
  const OUT = "#2a1d10";
  // Sombra
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath(); ctx.ellipse(sx, y + 13, 14, 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(sx, y);
  // Cuerpo redondito
  ctx.beginPath(); ctx.ellipse(0, 2, 14, 10, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#6caa3a"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Pancita más clara
  ctx.beginPath(); ctx.ellipse(0, 6, 8, 4, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#cfe09a"; ctx.fill();
  // Ojos sobresalidos
  for (const ex of [-6, 6]) {
    ctx.beginPath(); ctx.arc(ex, -8, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#6caa3a"; ctx.fill();
    ctx.lineWidth = 1.4; ctx.stroke();
    ctx.beginPath(); ctx.arc(ex, -8, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill();
    ctx.fillStyle = OUT;
    ctx.beginPath(); ctx.arc(ex, -8, 1.2, 0, Math.PI * 2); ctx.fill();
  }
  // Boca (línea curva)
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-4, 0); ctx.quadraticCurveTo(0, 3, 4, 0);
  ctx.stroke();
  // Patas traseras (un poco a los costados)
  ctx.fillStyle = "#6caa3a";
  ctx.beginPath();
  ctx.ellipse(-12, 8, 4, 2.5, -0.3, 0, Math.PI * 2);
  ctx.ellipse(12, 8, 4, 2.5, 0.3, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawMouse(enemy) {
  const sx = worldToScreen(enemy.x);
  if (sx < -40 || sx > VIEW_W + 40) return;
  const y = enemy.y;
  const OUT = "#2a1d10";
  // Sombra
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath(); ctx.ellipse(sx, y + 10, 10, 1.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(sx, y);
  if (enemy.dir === -1) ctx.scale(-1, 1);
  // Cuerpo
  ctx.beginPath(); ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#88807a"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Pancita clara
  ctx.beginPath(); ctx.ellipse(0, 3, 6, 2, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#b8b0a8"; ctx.fill();
  // Cabeza puntiaguda
  ctx.beginPath();
  ctx.moveTo(-7, -3); ctx.lineTo(-15, -1); ctx.lineTo(-7, 3);
  ctx.closePath();
  ctx.fillStyle = "#88807a"; ctx.fill(); ctx.stroke();
  // Orejas circulares
  ctx.fillStyle = "#88807a";
  ctx.beginPath(); ctx.arc(-4, -5, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#f8c2c8";
  ctx.beginPath(); ctx.arc(-4, -5, 1.4, 0, Math.PI * 2); ctx.fill();
  // Ojo
  ctx.fillStyle = OUT;
  ctx.beginPath(); ctx.arc(-9, -2, 0.8, 0, Math.PI * 2); ctx.fill();
  // Nariz rosa
  ctx.fillStyle = "#f8c2c8";
  ctx.beginPath(); ctx.arc(-14, -1, 0.8, 0, Math.PI * 2); ctx.fill();
  // Bigotes
  ctx.strokeStyle = OUT; ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-13, 0); ctx.lineTo(-17, 1);
  ctx.moveTo(-13, -1); ctx.lineTo(-16, -3);
  ctx.stroke();
  // Cola enroscada larga
  ctx.strokeStyle = "#88807a"; ctx.lineWidth = 1.5; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(9, 0);
  ctx.quadraticCurveTo(16, -2, 14, 4);
  ctx.quadraticCurveTo(12, 8, 18, 6);
  ctx.stroke();
  // Patas (líneas finas)
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-3, 5); ctx.lineTo(-3, 8);
  ctx.moveTo(3, 5);  ctx.lineTo(3, 8);
  ctx.stroke();
  ctx.restore();
}

function drawDoor(d) {
  const sx = worldToScreen(d.x);
  if (sx + d.w < 0 || sx > VIEW_W) return;
  const OUT = "#2a1d10";
  // Marco (3 lados del cuadro)
  ctx.fillStyle = "#5b3a1a";
  ctx.fillRect(sx - 6, d.y - 6, d.w + 12, d.h + 6);
  ctx.fillStyle = "#3a2010";
  ctx.fillRect(sx - 8, d.y - 8, d.w + 16, 4);
  if (!d.opened) {
    // Puerta cerrada
    ctx.beginPath(); ctx.rect(sx, d.y, d.w, d.h);
    ctx.fillStyle = "#a87447"; ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
    // Tablones verticales (líneas, no fill)
    ctx.strokeStyle = "rgba(60,30,15,0.5)"; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(sx + d.w / 2, d.y); ctx.lineTo(sx + d.w / 2, d.y + d.h);
    ctx.stroke();
    // Manija
    ctx.fillStyle = "#ffd76b"; ctx.strokeStyle = OUT; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(sx + d.w - 6, d.y + d.h / 2, 2.5, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Cartel con el número de huevos
    ctx.beginPath(); ctx.rect(sx + d.w / 2 - 14, d.y + d.h / 2 - 14, 28, 28);
    ctx.fillStyle = "#fff8d0"; ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
    // Iconito huevo + número
    ctx.fillStyle = "#5b3a1a";
    ctx.font = "bold 18px system-ui";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(d.eggs_required), sx + d.w / 2, d.y + d.h / 2);
  } else {
    // Puerta abierta (interior oscuro)
    ctx.beginPath(); ctx.rect(sx, d.y, d.w, d.h);
    ctx.fillStyle = "#2a1d10"; ctx.fill();
    // Tilde verde
    ctx.fillStyle = "#7ed957";
    ctx.font = "bold 26px system-ui";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("✓", sx + d.w / 2, d.y + d.h / 2);
  }
}

function drawQuizMarker(q) {
  const sx = worldToScreen(q.x);
  if (sx + q.w < 0 || sx > VIEW_W) return;
  const OUT = "#2a1d10";
  // Poste
  ctx.fillStyle = "#5b3a1a";
  ctx.fillRect(sx + q.w / 2 - 3, q.y + q.h, 6, 20);
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
  ctx.strokeRect(sx + q.w / 2 - 3, q.y + q.h, 6, 20);
  if (q.solved) {
    // Tabla con tilde verde
    ctx.beginPath(); ctx.rect(sx, q.y, q.w, q.h);
    ctx.fillStyle = "#7ed957"; ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 22px system-ui";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("✓", sx + q.w / 2, q.y + q.h / 2);
    return;
  }
  // Tabla pendiente con "?" pulsante
  ctx.beginPath(); ctx.rect(sx, q.y, q.w, q.h);
  ctx.fillStyle = "#fff8d0"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  const pulse = 1 + Math.sin(state.globalT * 0.12) * 0.08;
  ctx.fillStyle = "#5b3a1a";
  ctx.font = `bold ${Math.round(28 * pulse)}px system-ui`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("?", sx + q.w / 2, q.y + q.h / 2);
}

function drawFlag(f) {
  const sx = worldToScreen(f.x);
  if (sx + f.w < 0 || sx > VIEW_W) return;
  const OUT = "#2a1d10";
  // Base
  ctx.fillStyle = "#5b3a1a";
  ctx.fillRect(sx - 6, f.y + f.h - 4, 16, 6);
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4;
  ctx.strokeRect(sx - 6, f.y + f.h - 4, 16, 6);
  // Asta
  ctx.fillStyle = "#7a4f2b";
  ctx.fillRect(sx, f.y, 4, f.h);
  ctx.strokeRect(sx, f.y, 4, f.h);
  // Topper
  ctx.beginPath(); ctx.arc(sx + 2, f.y, 3, 0, Math.PI * 2);
  ctx.fillStyle = "#ffd34a"; ctx.fill(); ctx.stroke();
  // Bandera con onda + descent (cinemática win)
  const descend = f.descend || 0;
  const flagY = f.y + 4 + descend;
  const wave = Math.sin(state.globalT * 0.08) * 4;
  ctx.beginPath();
  ctx.moveTo(sx + 4, flagY);
  ctx.lineTo(sx + 4, flagY + 34);
  ctx.quadraticCurveTo(sx + 22, flagY + 24 + wave, sx + 38, flagY + 16);
  ctx.quadraticCurveTo(sx + 22, flagY + 12 + wave, sx + 4, flagY);
  ctx.closePath();
  ctx.fillStyle = "#e85d5d"; ctx.fill(); ctx.stroke();
  // Pollito mini en la bandera (solo color, sin contorno extra)
  ctx.fillStyle = "#ffd34a";
  ctx.beginPath(); ctx.arc(sx + 16, flagY + 22, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f08a1a";
  ctx.beginPath();
  ctx.moveTo(sx + 21, flagY + 22); ctx.lineTo(sx + 25, flagY + 21);
  ctx.lineTo(sx + 21, flagY + 23); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#222";
  ctx.beginPath(); ctx.arc(sx + 17, flagY + 21, 0.8, 0, Math.PI * 2); ctx.fill();
}

// ===== Pollito (flat vector con contornos — F2 visual reboot) =====
function drawPollito(p) {
  const cx = worldToScreen(p.x) + p.w / 2;
  const cy = p.y + p.h / 2;
  const groundY = p.y + p.h;

  // Sombra elíptica plana
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  const shadowScale = p.onGround ? 1 : Math.max(0.3, 1 - Math.abs(p.vy) / 12);
  ctx.beginPath();
  ctx.ellipse(cx, groundY + 1, 14 * shadowScale, 3 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(p.facing * p.scaleX, p.scaleY);

  // Cuerpo (elipse amarilla)
  ctx.beginPath();
  ctx.ellipse(0, 3, 16, 14, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#ffd34a";
  ctx.fill();
  ctx.strokeStyle = "#2a1d10";
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Cabeza (círculo arriba a la derecha)
  ctx.beginPath();
  ctx.arc(8, -8, 10, 0, Math.PI * 2);
  ctx.fillStyle = "#ffd34a";
  ctx.fill();
  ctx.stroke();

  // Pancita más clara (sombra plana inversa)
  ctx.beginPath();
  ctx.ellipse(-2, 6, 10, 7, 0.1, 0, Math.PI * 2);
  ctx.fillStyle = "#fff4c0";
  ctx.fill();

  // Ala con flap (ciclo de animación)
  const flapY = (p.flap < 15) ? 4 : 6;
  ctx.beginPath();
  ctx.ellipse(-2, flapY, 7, 5, 0.2, 0, Math.PI * 2);
  ctx.fillStyle = "#e8a820";
  ctx.fill();
  ctx.strokeStyle = "#2a1d10";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Pico
  ctx.beginPath();
  ctx.moveTo(17, -8);
  ctx.lineTo(23, -6);
  ctx.lineTo(17, -3);
  ctx.closePath();
  ctx.fillStyle = "#f08a1a";
  ctx.fill();
  ctx.stroke();

  // Cresta (3 picos triangulares pequeños en la cabeza)
  ctx.beginPath();
  ctx.moveTo(2, -16);
  ctx.lineTo(4, -20);
  ctx.lineTo(6, -16);
  ctx.lineTo(8, -19);
  ctx.lineTo(10, -16);
  ctx.lineTo(12, -19);
  ctx.lineTo(14, -16);
  ctx.closePath();
  ctx.fillStyle = "#e85d5d";
  ctx.fill();
  ctx.stroke();

  // Ojo (círculo blanco + pupila negra + brillo)
  ctx.beginPath();
  ctx.arc(11, -10, 2.8, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.strokeStyle = "#2a1d10";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(12, -10, 1.5, 0, Math.PI * 2);
  ctx.fillStyle = "#222";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(12.5, -10.5, 0.5, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();

  // Patas con walk cycle
  ctx.strokeStyle = "#f08a1a";
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  const legPhase = p.onGround && Math.abs(p.vx) > 0.1 ? Math.sin(p.walkAnim) * 2 : 0;
  ctx.beginPath();
  ctx.moveTo(-5, 16); ctx.lineTo(-5 + legPhase, 21);
  ctx.moveTo(5, 16);  ctx.lineTo(5 - legPhase, 21);
  ctx.stroke();
  // Pequeñas garritas en cada pata
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-7 + legPhase, 21); ctx.lineTo(-3 + legPhase, 21);
  ctx.moveTo(3 - legPhase, 21);  ctx.lineTo(7 - legPhase, 21);
  ctx.stroke();

  ctx.restore();
}

function drawHintBanner() {
  if (!state.hint || state.scene !== "playing") return;
  if (state.hintTimer <= 0) return;
  // Fade out en los últimos 30 frames
  const alpha = Math.min(1, state.hintTimer / 30);
  const text = state.hint;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = "16px system-ui";
  const w = Math.min(VIEW_W - 40, ctx.measureText(text).width + 30);
  const x = (VIEW_W - w) / 2;
  // Más cerca del borde inferior para no tapar ambient animals
  const y = VIEW_H - 42;
  // sombra suave
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(x, y, w, 28);
  ctx.fillStyle = "white";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, VIEW_W / 2, y + 14);
  ctx.restore();
}

// Splash/Select: dibujamos una escena idle de fondo para que el HTML overlay
// no flote sobre un canvas negro
let splashClouds = [
  { x: 100, y: 70, scale: 1, vx: 0.12 },
  { x: 320, y: 50, scale: 0.7, vx: 0.08 },
  { x: 540, y: 100, scale: 0.9, vx: 0.1 },
  { x: 700, y: 70, scale: 1, vx: 0.14 },
];
let splashBirds = [
  { x: 100, y: 110, vx: 0.6, t: 0 },
  { x: -200, y: 80, vx: 0.5, t: 1.3 },
];
function drawSplashBackground() {
  // sky gradient (cálido)
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, "#fed8a8");
  grad.addColorStop(0.45, "#ffe9c1");
  grad.addColorStop(1, "#a3c46a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // sol
  ctx.save();
  ctx.translate(700, 110);
  ctx.fillStyle = "rgba(255, 245, 184, 0.2)";
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + state.globalT * 0.004;
    ctx.save(); ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, -28); ctx.lineTo(10, -80); ctx.lineTo(-10, -80);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  const sunGrad = ctx.createRadialGradient(700, 110, 5, 700, 110, 70);
  sunGrad.addColorStop(0, "#fff5b8");
  sunGrad.addColorStop(0.4, "#ffd76b");
  sunGrad.addColorStop(1, "rgba(255, 215, 107, 0)");
  ctx.fillStyle = sunGrad;
  ctx.beginPath(); ctx.arc(700, 110, 70, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffd76b";
  ctx.beginPath(); ctx.arc(700, 110, 32, 0, Math.PI * 2); ctx.fill();
  // nubes drift
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  for (const c of splashClouds) {
    c.x += c.vx;
    if (c.x > VIEW_W + 80) c.x = -80;
    drawCloud(c.x, c.y, c.scale);
  }
  // siluetas de colinas
  ctx.fillStyle = "#8da34c";
  ctx.beginPath();
  ctx.moveTo(0, 360);
  ctx.quadraticCurveTo(150, 280, 280, 340);
  ctx.quadraticCurveTo(400, 380, 540, 320);
  ctx.quadraticCurveTo(680, 290, 800, 340);
  ctx.lineTo(800, VIEW_H);
  ctx.lineTo(0, VIEW_H);
  ctx.closePath(); ctx.fill();
  // pasto + suelo
  ctx.fillStyle = "#7a9c4b";
  ctx.fillRect(0, 380, VIEW_W, 30);
  ctx.fillStyle = "#a3c46a";
  ctx.fillRect(0, 410, VIEW_W, VIEW_H - 410);
  // grass tufts
  ctx.fillStyle = "#5d8c3c";
  for (let i = 0; i < VIEW_W; i += 22) {
    ctx.fillRect(i + 5, 380 - 2, 2, 4);
    ctx.fillRect(i + 12, 380 - 3, 2, 5);
  }
  // flores aleatorias
  const flowerColors = ["#e85d5d", "#ffd34a", "#d989ff"];
  for (let i = 0; i < 18; i++) {
    const fx = (i * 47) % VIEW_W;
    const fy = 420 + (i % 3) * 12;
    const col = flowerColors[i % 3];
    ctx.fillStyle = "#4f8c46";
    ctx.fillRect(fx, fy, 1.5, 6);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(fx + 0.5, fy - 1, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  // pajaros idle
  ctx.strokeStyle = "#3a2a1a"; ctx.lineWidth = 2; ctx.lineCap = "round";
  for (const b of splashBirds) {
    b.x += b.vx;
    b.t += 0.08;
    if (b.x > VIEW_W + 50) b.x = -50;
    const y = b.y + Math.sin(b.t) * 3;
    const flap = Math.sin(b.t * 5) * 4;
    ctx.beginPath();
    ctx.moveTo(b.x - 8, y + flap);
    ctx.quadraticCurveTo(b.x - 4, y - 2, b.x, y);
    ctx.quadraticCurveTo(b.x + 4, y - 2, b.x + 8, y + flap);
    ctx.stroke();
  }
}

function render() {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (state.scene === "splash" || state.scene === "select") {
    drawSplashBackground();
    return;
  }
  drawSky();
  // Parallax capas (de lejos a cerca)
  drawParallaxLayer(state.parallaxFar, 0.25, (sx, it) => drawMountain(sx, it));
  drawParallaxLayer(state.parallaxMid, 0.55, (sx, it) => {
    if (it.kind === "tree") drawTree(sx, it);
    else if (it.kind === "barn") drawBarn(sx, it);
    else if (it.kind === "silo") drawSilo(sx, it);
    else if (it.kind === "windmill") drawWindmill(sx, it);
  });
  drawParallaxLayer(state.parallaxNear, 0.85, (sx, it) => {
    if (it.kind === "bush") drawBush(sx);
    else if (it.kind === "rock") drawRock(sx);
  });
  // Ambient animals (en plano del juego)
  for (const a of state.ambients) drawAmbient(a);
  // Decoración foreground
  for (const d of state.decor) drawDecor(d);
  // Agua
  for (const pit of state.waterPits) drawWaterPit(pit);
  // Plataformas
  for (const p of state.platforms) drawPlatform(p);
  // Huevos
  for (const e of state.eggs) drawEgg(e);
  // Enemigos (zorros)
  for (const e of state.enemies) {
    if (e.kind === "fox") drawFox(e);
    else if (e.kind === "crow") drawCrow(e);
    else if (e.kind === "frog") drawFrog(e);
    else if (e.kind === "mouse") drawMouse(e);
  }
  // Objetos
  if (state.door) drawDoor(state.door);
  if (state.quiz) drawQuizMarker(state.quiz);
  if (state.flag) drawFlag(state.flag);
  // Pollito + partículas (encima)
  // Si está en knockback, parpadea (cada 4 frames invisible)
  if (state.knockback === 0 || Math.floor(state.knockback / 4) % 2 === 0) {
    drawPollito(state.player);
  }
  drawParticles();
  // Vignette para atmósfera (encima de todo lo del mundo, debajo de UI)
  drawVignette();
  // UI hint
  drawHintBanner();
  // Indicador de pausa
  if (paused) {
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

function loop() {
  step();
  render();
  requestAnimationFrame(loop);
}

// Daily Flavor: arrancar el fetch en background. No bloquea el loop.
getTodayFlavor().then((f) => {
  if (f) {
    DAILY_FLAVOR = f;
    if (state.world) applyFlavorToWorld(state.world.id);
    if (f.specialEvent && !_bannerShown && (state.scene === "splash" || state.scene === "select")) {
      showFlavorBanner(f.specialEvent.banner);
      _bannerShown = true;
    }
  }
});

// Splash queda visible al cargar (HTML lo arranca con .shown).
loop();
