// Audio del juego — Web Audio API, todo procedural, sin archivos externos.
//
// Default: muted. Sofi es autista, no asumimos tolerancia sensorial.
// Toggle visible en el HUD. Volumen bajo (0.15).
// La música no arranca hasta el primer click/touch del usuario (browser policy).

let ctx = null;
let masterGain = null;
let musicGain = null;
let sfxGain = null;
let musicTimer = null;
let muted = true;  // default OFF

const VOLUME_MASTER = 0.5;
const VOLUME_MUSIC = 0.15;
const VOLUME_SFX = 0.35;

// Persistencia simple
try { muted = JSON.parse(localStorage.getItem("pollito_audio_muted") ?? "true"); }
catch { muted = true; }

function persistMute() {
  try { localStorage.setItem("pollito_audio_muted", JSON.stringify(muted)); } catch {}
}

function ensureCtx() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : VOLUME_MASTER;
    masterGain.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = VOLUME_MUSIC;
    musicGain.connect(masterGain);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = VOLUME_SFX;
    sfxGain.connect(masterGain);
  } catch { ctx = null; }
  return ctx;
}

// Tonos crudos
function tone({ freq, duration, type = "square", gainNode = sfxGain, vol = 1, attack = 0.005, release = 0.08, slideTo = null }) {
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(vol, now + attack);
  g.gain.linearRampToValueAtTime(0, now + duration + release);
  osc.connect(g); g.connect(gainNode);
  osc.start(now);
  osc.stop(now + duration + release + 0.05);
}

// SFX puntuales
export const sfx = {
  jump() { ensureCtx(); tone({ freq: 420, duration: 0.08, type: "square", slideTo: 700 }); },
  egg() {
    ensureCtx();
    tone({ freq: 880,  duration: 0.07, type: "triangle" });
    setTimeout(() => tone({ freq: 1320, duration: 0.10, type: "triangle" }), 70);
  },
  door() {
    ensureCtx();
    tone({ freq: 523, duration: 0.12, type: "sine" });
    setTimeout(() => tone({ freq: 659, duration: 0.12, type: "sine" }), 110);
    setTimeout(() => tone({ freq: 784, duration: 0.18, type: "sine" }), 220);
  },
  quizOk() {
    ensureCtx();
    tone({ freq: 659, duration: 0.10, type: "triangle" });
    setTimeout(() => tone({ freq: 880, duration: 0.15, type: "triangle" }), 100);
  },
  quizNo() {
    ensureCtx();
    tone({ freq: 220, duration: 0.18, type: "sine" });  // suave, no agresivo
  },
  win() {
    ensureCtx();
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => setTimeout(() => tone({ freq: f, duration: 0.14, type: "triangle" }), i * 120));
  },
};

// Melodía granjera simple, 4/4 en C mayor.
// Notación: [freq, beats]. Beat = 0.18s (≈ 167 BPM, ligero pero no acelerado).
const BEAT = 0.18;
const MELODY = [
  // Frase 1
  [523, 1], [659, 1], [784, 1], [659, 1],
  [523, 1], [659, 1], [784, 2],
  // Frase 2
  [880, 1], [784, 1], [659, 1], [523, 1],
  [587, 1], [659, 1], [523, 2],
  // Frase 3
  [659, 1], [784, 1], [880, 1], [784, 1],
  [659, 1], [587, 1], [523, 2],
  // Frase 4
  [392, 1], [523, 1], [659, 1], [784, 1],
  [659, 1], [523, 1], [392, 2],
];
const BASS = [261, 392, 261, 392]; // C, G, C, G (un bajo por compás de 4 beats)

function scheduleNote(freq, when, dur, type, gain) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(gain, when + 0.01);
  g.gain.linearRampToValueAtTime(0, when + dur);
  osc.connect(g); g.connect(musicGain);
  osc.start(when);
  osc.stop(when + dur + 0.02);
}

function playLoopOnce() {
  if (!ctx) return;
  const start = ctx.currentTime + 0.02;
  let t = start;
  for (const [f, b] of MELODY) {
    const dur = b * BEAT * 0.9;
    scheduleNote(f, t, dur, "triangle", 0.5);
    t += b * BEAT;
  }
  // Bajo
  let bt = start;
  const beatsPerBass = 4;
  for (let i = 0; i < (MELODY.reduce((s, [, b]) => s + b, 0) / beatsPerBass); i++) {
    const f = BASS[i % BASS.length];
    scheduleNote(f, bt, beatsPerBass * BEAT * 0.9, "sine", 0.35);
    bt += beatsPerBass * BEAT;
  }
  const totalSec = MELODY.reduce((s, [, b]) => s + b, 0) * BEAT;
  return totalSec * 1000;
}

export function startMusic() {
  if (muted) return;
  ensureCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();
  if (musicTimer) return;
  const loop = () => {
    const dur = playLoopOnce();
    musicTimer = setTimeout(loop, dur);
  };
  loop();
}

export function stopMusic() {
  if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
}

export function isMuted() { return muted; }

export function toggleMute() {
  muted = !muted;
  persistMute();
  ensureCtx();
  if (masterGain) masterGain.gain.value = muted ? 0 : VOLUME_MASTER;
  if (muted) stopMusic();
  else startMusic();
  return muted;
}

// Resume context on first user gesture (browser policy)
function unlock() {
  ensureCtx();
  if (ctx && ctx.state === "suspended") ctx.resume();
}
window.addEventListener("pointerdown", unlock, { once: true });
window.addEventListener("keydown", unlock, { once: true });
