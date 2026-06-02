// Audio del juego — Web Audio API, todo procedural, sin archivos externos.
//
// Default: muted. Sofi es autista, no asumimos tolerancia sensorial.
// Toggle visible en el HUD. Volumen bajo (0.15).
//
// Diseño:
//  - El AudioContext SIEMPRE se desbloquea con el primer gesto del usuario
//    (splash "Empezar"). Después, mute solo afecta el gain master.
//  - Eso evita el bug de "el toggle no hace nada la primera vez" porque
//    el ctx no estaba running todavía.

let ctx = null;
let masterGain = null;
let musicGain = null;
let sfxGain = null;
let musicTimer = null;
let unlocked = false;
let muted = true;

const VOLUME_MASTER = 0.55;
const VOLUME_MUSIC = 0.18;
const VOLUME_SFX = 0.4;

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

/**
 * Desbloquea el AudioContext en un gesto del usuario.
 * CRITICAL: debe ser SINCRONICO. iOS Safari pierde el "user gesture context"
 * si usamos await — por eso fire-and-forget en resume y silent-buffer trick.
 */
export function unlock() {
  ensureCtx();
  if (!ctx) return false;
  // Trick iOS: tocar un buffer mudo de 1 frame en el mismo gesto despierta
  // el output. Sin esto, ios suele dejar el ctx en "running" pero sin audio audible.
  try {
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  } catch {}
  if (ctx.state === "suspended") {
    // Fire-and-forget. iOS necesita que dispare el resume ANTES de que el
    // gesture context se pierda. Si esperamos con await, ya no cuenta.
    ctx.resume().catch(() => {});
  }
  unlocked = true;
  return true;
}

// Tono crudo con envoltura ADSR mínima
function tone({ freq, duration, type = "square", vol = 1, attack = 0.005, release = 0.08, slideTo = null, gainNode = null }) {
  if (!ctx) return;
  // iOS auto-suspende el ctx tras inactividad — resume defensivo
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  const dest = gainNode || sfxGain;
  if (!dest) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(vol, now + attack);
  g.gain.linearRampToValueAtTime(0, now + duration + release);
  osc.connect(g); g.connect(dest);
  osc.start(now);
  osc.stop(now + duration + release + 0.05);
}

// SFX puntuales
export const sfx = {
  jump() { ensureCtx(); tone({ freq: 420, duration: 0.08, type: "square", slideTo: 700 }); },
  land() { ensureCtx(); tone({ freq: 180, duration: 0.04, type: "sine", vol: 0.5 }); },
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
    tone({ freq: 220, duration: 0.18, type: "sine" });
  },
  win() {
    ensureCtx();
    const notes = [523, 659, 784, 1046, 1318];
    notes.forEach((f, i) => setTimeout(() => tone({ freq: f, duration: 0.14, type: "triangle" }), i * 120));
  },
  // Sonidos ambientes (raros, suaves)
  moo() { ensureCtx(); tone({ freq: 180, duration: 0.45, type: "sawtooth", vol: 0.35, slideTo: 140 }); },
  baa() { ensureCtx(); tone({ freq: 320, duration: 0.3, type: "triangle", vol: 0.3, slideTo: 280 }); },
  cluck() {
    ensureCtx();
    tone({ freq: 600, duration: 0.05, type: "square", vol: 0.3 });
    setTimeout(() => tone({ freq: 500, duration: 0.05, type: "square", vol: 0.3 }), 80);
  },
};

// Melodía granjera procedural — múltiples patrones por mundo, mood diferente.
// Cada patrón: melody[] + bass[]
const PATTERNS = {
  corral: {
    // alegre, mayor, sencilla
    beat: 0.18,
    melody: [
      [523, 1], [659, 1], [784, 1], [659, 1],
      [523, 1], [659, 1], [784, 2],
      [880, 1], [784, 1], [659, 1], [523, 1],
      [587, 1], [659, 1], [523, 2],
      [659, 1], [784, 1], [880, 1], [784, 1],
      [659, 1], [587, 1], [523, 2],
      [392, 1], [523, 1], [659, 1], [784, 1],
      [659, 1], [523, 1], [392, 2],
    ],
    bass: [261, 392, 261, 392],
  },
  campo: {
    // pastoral, ligeramente más reflexiva
    beat: 0.2,
    melody: [
      [440, 1], [523, 1], [659, 2],
      [587, 1], [523, 1], [440, 2],
      [523, 1], [659, 1], [784, 2],
      [659, 1], [587, 1], [523, 2],
      [440, 1], [523, 1], [659, 1], [784, 1],
      [659, 1], [523, 1], [440, 2],
      [392, 1], [440, 1], [523, 2],
      [392, 2], [440, 2],
    ],
    bass: [220, 330, 220, 330],
  },
  estanque: {
    // calma, agua, pentatónica suave
    beat: 0.22,
    melody: [
      [392, 1], [440, 1], [523, 2],
      [659, 1], [587, 1], [523, 2],
      [392, 1], [440, 1], [523, 1], [659, 1],
      [587, 2], [523, 2],
      [330, 1], [392, 1], [440, 1], [523, 1],
      [440, 1], [392, 1], [330, 2],
      [392, 2], [330, 2],
      [262, 4],
    ],
    bass: [196, 262, 196, 262],
  },
  granero: {
    // rítmica, country
    beat: 0.16,
    melody: [
      [523, 1], [523, 1], [659, 1], [784, 1],
      [659, 1], [523, 1], [392, 2],
      [523, 1], [659, 1], [784, 1], [880, 1],
      [784, 1], [659, 1], [523, 2],
      [659, 1], [784, 1], [880, 1], [659, 1],
      [523, 1], [587, 1], [523, 2],
      [392, 1], [523, 1], [659, 1], [784, 1],
      [880, 2], [523, 2],
    ],
    bass: [262, 196, 262, 196],
  },
};

let currentPattern = PATTERNS.corral;

export function setMusicPattern(worldId) {
  if (PATTERNS[worldId]) currentPattern = PATTERNS[worldId];
  // Si está sonando, restartear el loop con el nuevo patrón
  if (musicTimer) { stopMusic(); startMusic(); }
}

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
  if (!ctx) return 0;
  const pat = currentPattern;
  const start = ctx.currentTime + 0.02;
  let t = start;
  for (const [f, b] of pat.melody) {
    const dur = b * pat.beat * 0.9;
    scheduleNote(f, t, dur, "triangle", 0.5);
    t += b * pat.beat;
  }
  let bt = start;
  const beatsPerBass = 4;
  const totalBeats = pat.melody.reduce((s, [, b]) => s + b, 0);
  for (let i = 0; i < (totalBeats / beatsPerBass); i++) {
    const f = pat.bass[i % pat.bass.length];
    scheduleNote(f, bt, beatsPerBass * pat.beat * 0.9, "sine", 0.35);
    bt += beatsPerBass * pat.beat;
  }
  return totalBeats * pat.beat * 1000;
}

export function startMusic() {
  if (muted) return;
  ensureCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") { ctx.resume().catch(() => {}); }
  if (musicTimer) return;
  const loop = () => {
    const dur = playLoopOnce();
    musicTimer = setTimeout(loop, Math.max(dur, 500));
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
  unlock();  // sincrónico: nada de await
  if (masterGain) masterGain.gain.value = muted ? 0 : VOLUME_MASTER;
  if (muted) stopMusic();
  else startMusic();
  return muted;
}
