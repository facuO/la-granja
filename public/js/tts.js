// Text-to-Speech con dos motores:
// 1. Backend ElevenLabs (calidad alta + word timing exacto)
// 2. Fallback: Web Speech del browser (gratis pero calidad variable)
//
// Ambos modos soportan highlight de palabras: pasale wordEls
// (array de DOM elements, uno por palabra) y se va marcando con
// la clase .speaking a medida que se leen.

import { api, NoAccessError } from "./api.js";

// --- Web Speech voice selection ---

let cachedVoice = null;

function pickWebSpeechVoice() {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;
  const prefs = ["es-AR", "es-MX", "es-419", "es-ES", "es-CL", "es-CO", "es"];
  // Preferir voces LOCALES (sistema) sobre Google network — sonido más natural
  for (const p of prefs) {
    const v = voices.find((x) => x.lang && x.lang.toLowerCase().startsWith(p.toLowerCase()) && x.localService);
    if (v) { cachedVoice = v; return v; }
  }
  // Si no hay local, cualquier es-*
  for (const p of prefs) {
    const v = voices.find((x) => x.lang && x.lang.toLowerCase().startsWith(p.toLowerCase()));
    if (v) { cachedVoice = v; return v; }
  }
  cachedVoice = voices[0];
  return cachedVoice;
}

if ("speechSynthesis" in window) {
  pickWebSpeechVoice();
  window.speechSynthesis.onvoiceschanged = () => pickWebSpeechVoice();
}

// --- Internal current playback handle (so we can stop) ---

let currentAudio = null;
let currentUtter = null;
let currentTimers = [];
let currentWordEls = [];

function clearHighlights() {
  for (const el of currentWordEls) {
    if (el && el.classList) el.classList.remove("speaking");
  }
  currentWordEls = [];
}

function clearTimers() {
  for (const t of currentTimers) clearTimeout(t);
  currentTimers = [];
}

export function stop() {
  if (currentAudio) {
    try { currentAudio.pause(); } catch {}
    currentAudio = null;
  }
  if (currentUtter && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    currentUtter = null;
  }
  clearTimers();
  clearHighlights();
}

// --- Backend ElevenLabs playback ---

async function playElevenLabs(text, wordEls, onDone) {
  let result;
  try {
    result = await api("/api/sofi/tts", { method: "POST", body: { text } });
  } catch (err) {
    if (err instanceof NoAccessError) throw err;
    // Cualquier error del backend (503 no configurado, 500 ElevenLabs rechazó,
    // network, etc) → caer a Web Speech para que igual se escuche algo.
    const e = new Error("tts_backend_failed");
    e.fallback = true;
    e.original = err;
    throw e;
  }

  const audio = new Audio("data:audio/mpeg;base64," + result.audio_base64);
  currentAudio = audio;
  currentWordEls = wordEls;

  // Schedule word highlights (each word matched by index to wordEls)
  const words = result.words || [];
  for (let i = 0; i < Math.min(words.length, wordEls.length); i++) {
    const w = words[i];
    const el = wordEls[i];
    const startMs = Math.max(0, w.start * 1000);
    const endMs = Math.max(startMs + 50, w.end * 1000);
    currentTimers.push(setTimeout(() => { if (el && el.classList) el.classList.add("speaking"); }, startMs));
    currentTimers.push(setTimeout(() => { if (el && el.classList) el.classList.remove("speaking"); }, endMs));
  }

  audio.addEventListener("ended", () => {
    if (currentAudio === audio) {
      clearTimers();
      clearHighlights();
      currentAudio = null;
      if (typeof onDone === "function") onDone();
    }
  });
  audio.addEventListener("error", () => {
    if (currentAudio === audio) {
      clearTimers();
      clearHighlights();
      currentAudio = null;
      if (typeof onDone === "function") onDone();
    }
  });

  try {
    await audio.play();
  } catch (err) {
    clearTimers();
    clearHighlights();
    currentAudio = null;
    throw err;
  }
}

// --- Web Speech fallback playback ---

function playWebSpeech(text, wordEls, onDone) {
  if (!("speechSynthesis" in window)) {
    if (typeof onDone === "function") onDone();
    return;
  }

  // Compute char start index of each whitespace-separated word in `text`,
  // so onboundary events (charIndex) can be mapped to a word index.
  const wordStarts = [];
  let pos = 0;
  const tokens = text.split(/(\s+)/);
  for (const tok of tokens) {
    if (tok && !/^\s+$/.test(tok)) wordStarts.push(pos);
    pos += tok.length;
  }

  const utter = new SpeechSynthesisUtterance(text);
  const voice = cachedVoice || pickWebSpeechVoice();
  if (voice) {
    utter.voice = voice;
    utter.lang = voice.lang;
  } else {
    utter.lang = "es-AR";
  }
  utter.rate = 0.95;
  utter.pitch = 1.0;

  currentUtter = utter;
  currentWordEls = wordEls;

  utter.onboundary = (ev) => {
    if (ev.name !== "word") return;
    let wi = 0;
    for (let i = wordStarts.length - 1; i >= 0; i--) {
      if (wordStarts[i] <= ev.charIndex) { wi = i; break; }
    }
    for (let i = 0; i < wordEls.length; i++) {
      if (wordEls[i] && wordEls[i].classList) {
        wordEls[i].classList.toggle("speaking", i === wi);
      }
    }
  };

  utter.onend = () => {
    if (currentUtter === utter) {
      currentUtter = null;
      clearHighlights();
      if (typeof onDone === "function") onDone();
    }
  };

  utter.onerror = () => {
    if (currentUtter === utter) {
      currentUtter = null;
      clearHighlights();
      if (typeof onDone === "function") onDone();
    }
  };

  window.speechSynthesis.speak(utter);
}

// --- Public API ---

export function ttsAvailable() {
  return typeof window !== "undefined" && ("speechSynthesis" in window);
}

export async function speak(text, opts = {}) {
  const wordEls = opts.wordEls || [];
  const onDone = opts.onDone;
  if (!text || typeof text !== "string") return;
  stop();
  try {
    await playElevenLabs(text, wordEls, onDone);
  } catch (err) {
    if (err && (err.fallback || err.message === "tts_not_configured")) {
      playWebSpeech(text, wordEls, onDone);
    } else {
      // Network or other error: fall back to Web Speech too
      console.warn("Backend TTS falló, usando Web Speech:", err);
      playWebSpeech(text, wordEls, onDone);
    }
  }
}

/**
 * Crea un botón 🔊 que habla el texto dado.
 * @param {() => string} getText - retorna el texto a leer
 * @param {() => Element[]} [getWordEls] - retorna los DOM els (uno por palabra) para highlight
 */
export function makeSpeakButton(getText, getWordEls) {
  const btn = document.createElement("button");
  btn.className = "speak-btn";
  btn.type = "button";
  btn.setAttribute("aria-label", "Escuchar");
  btn.textContent = "🔊 Escuchar";
  if (!ttsAvailable()) {
    btn.disabled = true;
    btn.title = "Voz no disponible en este navegador";
    return btn;
  }
  let active = false;

  function reset() {
    active = false;
    btn.textContent = "🔊 Escuchar";
  }

  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (active) {
      stop();
      reset();
      return;
    }
    const text = typeof getText === "function" ? getText() : String(getText ?? "");
    const wordEls = typeof getWordEls === "function" ? getWordEls() : [];
    if (!text) return;
    active = true;
    btn.textContent = "🔇 Parar";
    await speak(text, { wordEls, onDone: reset });
  });
  return btn;
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", stop);
}
