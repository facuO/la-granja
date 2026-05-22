// Text-to-Speech wrapper sobre la Web Speech API.
// Gratis, sin backend, calidad variable por device.
// iOS/macOS: voces Mónica / Paulina son decentes en español.
// Android Chrome: depende del system TTS engine instalado.

let cachedVoice = null;

function pickVoice() {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;
  // Preferencia: español rioplatense > latino > España > cualquier español
  const prefs = ["es-AR", "es-MX", "es-419", "es-ES", "es-CL", "es-CO", "es"];
  for (const p of prefs) {
    const v = voices.find((x) => x.lang && x.lang.toLowerCase().startsWith(p.toLowerCase()));
    if (v) {
      cachedVoice = v;
      return v;
    }
  }
  // Fallback: cualquiera, mejor que nada
  cachedVoice = voices[0];
  return cachedVoice;
}

export function ttsAvailable() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speak(text) {
  if (!ttsAvailable()) return;
  if (!text || typeof text !== "string") return;
  stop();
  const utter = new SpeechSynthesisUtterance(text);
  const voice = cachedVoice || pickVoice();
  if (voice) {
    utter.voice = voice;
    utter.lang = voice.lang;
  } else {
    utter.lang = "es-AR";
  }
  utter.rate = 0.95; // un poquito más lento que default
  utter.pitch = 1.0;
  utter.volume = 1.0;
  window.speechSynthesis.speak(utter);
}

export function stop() {
  if (!ttsAvailable()) return;
  window.speechSynthesis.cancel();
}

// Voices a veces cargan async (especialmente Chrome). Pre-warm la cache
// cuando estén disponibles.
if (ttsAvailable()) {
  pickVoice();
  window.speechSynthesis.onvoiceschanged = () => pickVoice();
}

/**
 * Crea un botón 🔊 que habla el texto dado al clickearlo.
 * Mientras habla, el botón pasa a 🔇 (toque corta).
 */
export function makeSpeakButton(getText, className = "speak-btn") {
  const btn = document.createElement("button");
  btn.className = className;
  btn.type = "button";
  btn.setAttribute("aria-label", "Escuchar");
  btn.textContent = "🔊 Escuchar";
  if (!ttsAvailable()) {
    btn.disabled = true;
    btn.title = "Voz no disponible en este navegador";
    return btn;
  }
  let speaking = false;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const text = typeof getText === "function" ? getText() : String(getText ?? "");
    if (speaking) {
      stop();
      speaking = false;
      btn.textContent = "🔊 Escuchar";
      return;
    }
    speak(text);
    speaking = true;
    btn.textContent = "🔇 Parar";
    // Cuando termina (o lo cortan), volver al estado original
    const tick = setInterval(() => {
      if (!window.speechSynthesis.speaking) {
        speaking = false;
        btn.textContent = "🔊 Escuchar";
        clearInterval(tick);
      }
    }, 200);
  });
  return btn;
}

// Si la página navega o se descarga, cortar TTS para no dejarlo colgado.
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", stop);
}
