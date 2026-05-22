// Text-to-Speech con Web Speech API (motor del browser).
// Sin backend, sin costo. Calidad depende del sistema operativo:
// - iOS/macOS: voces Mónica / Paulina suenan bien
// - Android Chrome: depende del TTS engine instalado
// - Desktop Chrome Win/Linux: voces network de Google, suenan robóticas

let cachedVoice = null;

function pickVoice() {
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
  pickVoice();
  window.speechSynthesis.onvoiceschanged = () => pickVoice();
}

let currentUtter = null;
let currentWordEls = [];

function clearHighlights() {
  for (const el of currentWordEls) {
    if (el && el.classList) el.classList.remove("speaking");
  }
  currentWordEls = [];
}

export function stop() {
  if (currentUtter && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    currentUtter = null;
  }
  clearHighlights();
}

export function ttsAvailable() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speak(text, opts = {}) {
  if (!ttsAvailable()) {
    if (typeof opts.onDone === "function") opts.onDone();
    return;
  }
  if (!text || typeof text !== "string") return;
  stop();

  const wordEls = opts.wordEls || [];

  // Calcular posición de cada palabra en el texto para mapear onboundary
  // (charIndex) → wordIndex
  const wordStarts = [];
  let pos = 0;
  const tokens = text.split(/(\s+)/);
  for (const tok of tokens) {
    if (tok && !/^\s+$/.test(tok)) wordStarts.push(pos);
    pos += tok.length;
  }

  const utter = new SpeechSynthesisUtterance(text);
  const voice = cachedVoice || pickVoice();
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
      if (typeof opts.onDone === "function") opts.onDone();
    }
  };

  utter.onerror = () => {
    if (currentUtter === utter) {
      currentUtter = null;
      clearHighlights();
      if (typeof opts.onDone === "function") opts.onDone();
    }
  };

  window.speechSynthesis.speak(utter);
}

/**
 * Botón 🔊 que habla el texto al clickearlo.
 * @param {() => string} getText
 * @param {() => Element[]} [getWordEls] - DOM elements (uno por palabra) para highlight
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
  const reset = () => {
    active = false;
    btn.textContent = "🔊 Escuchar";
  };

  btn.addEventListener("click", (e) => {
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
    speak(text, { wordEls, onDone: reset });
  });
  return btn;
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", stop);
}
