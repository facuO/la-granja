// @ts-check
/** @typedef {import('../../lib/types.js').GameMetrics} GameMetrics */

/* ───────── Trabalenguas por dificultad ───────── */
const POOL = {
  1: [
    'Pablito clavó un clavito.\n¿Qué clavito clavó Pablito?',
    'Como poco coco como,\npoco coco compro.',
    'Mi mamá me mima,\nyo mimo a mi mamá.',
  ],
  2: [
    'Tres tristes tigres\ncomían trigo en un trigal.',
    'El cielo está enladrillado.\n¿Quién lo desenladrillará?',
    'Camarón caramelo,\ncaramelo camarón.',
  ],
  3: [
    'Pepe pecas pica papas con un pico.\nCon un pico pica papas Pepe pecas.',
    'Erre con erre guitarra,\nerre con erre carril.\nMira qué rápido ruedan\nlas ruedas del ferrocarril.',
    'El perro de San Roque no tiene rabo,\nporque Ramón Ramírez se lo ha cortado.',
  ],
  4: [
    'Si seis sierras serruchan seis cipreses,\nseiscientas sierras serruchan\nseiscientos cipreses.',
    'María Chuchena su choza techaba,\ny un techador que pasaba le dijo:\nMaría Chuchena, ¿techás tu choza\no techás la ajena?',
    'Cuando cuentes cuentos,\ncuenta cuántos cuentos cuentas,\nporque si no cuentas cuántos cuentos cuentas\nnunca sabrás cuántos cuentos sabés contar.',
  ],
  5: [
    'Si Pancha plancha con cuatro planchas,\n¿con cuántas planchas plancha Pancha?',
    'Treinta y tres tramos de troncos trozaron\ntres tristes trozadores de troncos\ny triplicaron su trabajo,\ntrabajando juntos los tres.',
  ],
};

const REC_SECONDS_BY_DIFF = { 1: 10, 2: 12, 3: 14, 4: 16, 5: 16 };

/* ───────── Params ───────── */
const params = new URLSearchParams(location.search);
const rawDiff = parseInt(params.get('difficulty') || '3', 10);
const difficulty = /** @type {1|2|3|4|5} */ ([1,2,3,4,5].includes(rawDiff) ? rawDiff : 3);
const inSession = params.get('session') === '1';
const trabalenguasText = pickRandom(POOL[difficulty]);
const maxRecSec = REC_SECONDS_BY_DIFF[difficulty];

/* ───────── State ───────── */
let state = 'idle'; // idle | recording | recorded | rated | finished
let mediaRecorder = null;
let mediaStream = null;
let chunks = [];
let recordingStartMs = 0;
let recordingDurationMs = 0;
let rating = 0; // 1..3
let recordingBlobUrl = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let stopTimer = null;
/** @type {ReturnType<typeof setInterval> | null} */
let timerTick = null;

/* ───────── DOM ───────── */
const $text = document.getElementById('trabalenguasText');
const $micBtn = document.getElementById('micBtn');
const $micLabel = document.getElementById('micLabel');
const $timerBar = document.getElementById('timerBarFill');
const $hint = document.getElementById('hint');
const $playback = document.getElementById('playbackBlock');
const $playbackAudio = /** @type {HTMLAudioElement} */ (document.getElementById('playbackAudio'));
const $rating = document.getElementById('ratingBlock');
const $stars = Array.from(document.querySelectorAll('.star-btn'));
const $finishBtn = document.getElementById('finishBtn');
const $error = document.getElementById('errorBanner');
const $endOv = document.getElementById('endOverlay');
const $endActions = document.getElementById('endActions');
const $endMessage = document.getElementById('endMessage');

/* ───────── Utils ───────── */
function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function showError(msg) {
  $error.textContent = msg;
  $error.classList.remove('hidden');
}

/* ───────── Recording ───────── */
async function startRecording() {
  if (state === 'recording') return;
  $error.classList.add('hidden');

  if (!navigator.mediaDevices || !window.MediaRecorder) {
    // Fallback: sin grabación, igual habilitar self-rating
    state = 'recorded';
    showError('Tu navegador no permite grabar audio. Leélo en voz alta igual y calificate.');
    revealRating();
    return;
  }

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    showError('No pude acceder al micrófono. Igual podés leerlo en voz alta y calificarte.');
    state = 'recorded';
    revealRating();
    return;
  }

  try {
    mediaRecorder = new MediaRecorder(mediaStream);
  } catch (err) {
    showError('Tu navegador no soporta MediaRecorder. Leélo en voz alta y calificate.');
    cleanupStream();
    state = 'recorded';
    revealRating();
    return;
  }

  chunks = [];
  mediaRecorder.addEventListener('dataavailable', function (e) {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  });
  mediaRecorder.addEventListener('stop', onRecordingStop);

  mediaRecorder.start();
  state = 'recording';
  recordingStartMs = performance.now();
  $micBtn.classList.add('recording');
  $micLabel.textContent = 'Detener';
  $hint.textContent = 'Leélo en voz alta...';

  // Auto-stop al máximo
  stopTimer = setTimeout(function () {
    if (state === 'recording') stopRecording();
  }, maxRecSec * 1000);

  // Timer visual
  timerTick = setInterval(function () {
    const elapsed = (performance.now() - recordingStartMs) / 1000;
    const pct = Math.min(100, (elapsed / maxRecSec) * 100);
    $timerBar.style.width = pct + '%';
  }, 100);
}

function stopRecording() {
  if (state !== 'recording') return;
  recordingDurationMs = performance.now() - recordingStartMs;
  if (stopTimer) clearTimeout(stopTimer);
  if (timerTick) clearInterval(timerTick);
  $timerBar.style.width = '100%';
  try { mediaRecorder.stop(); } catch (_e) {}
}

function onRecordingStop() {
  cleanupStream();
  if (chunks.length === 0) {
    state = 'recorded';
    revealRating();
    return;
  }
  const blob = new Blob(chunks, { type: 'audio/webm' });
  recordingBlobUrl = URL.createObjectURL(blob);
  $playbackAudio.src = recordingBlobUrl;
  $playback.classList.remove('hidden');
  state = 'recorded';
  $micBtn.classList.remove('recording');
  $micLabel.textContent = 'Grabar otra vez';
  $hint.textContent = 'Escuchate y después calificate.';
  revealRating();
}

function cleanupStream() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(function (t) { t.stop(); });
    mediaStream = null;
  }
}

function revealRating() {
  $rating.classList.remove('hidden');
}

/* ───────── Rating ───────── */
function setRating(n) {
  rating = n;
  $stars.forEach(function (s) {
    const v = parseInt(s.dataset.value, 10);
    s.classList.toggle('filled', v <= n);
  });
  $finishBtn.disabled = false;
}

/* ───────── End ───────── */
function finish() {
  if (rating < 1) return;
  state = 'finished';

  // Nota: NO reportamos rating como `accuracy` (sería pseudo-precisión engañosa).
  // El self-rating va sólo a raw. accuracy queda null para señalar "métrica descriptiva".
  /** @type {GameMetrics} */
  const metrics = {
    accuracy: null,
    avgReactionMs: null,
    errors: { omission: 0, commission: 0 },
    level: difficulty,
    durationSec: Math.round(recordingDurationMs / 1000) || 0,
    raw: {
      trabalenguas: trabalenguasText,
      selfRating: rating,
      recordedSec: Math.round(recordingDurationMs / 1000) || null,
      hasAudio: !!recordingBlobUrl,
    },
  };
  reportResult(metrics);
  showEnd();
}

function reportResult(metrics) {
  const result = { type: 'gameFinished', gameId: 'trabalenguas', metrics };
  try { if (window.parent !== window) window.parent.postMessage(result, '*'); } catch (_e) {}
  try { localStorage.setItem('lastGameResult', JSON.stringify(result)); } catch (_e) {}
}

function showEnd() {
  const stars = '★'.repeat(rating) + '☆'.repeat(3 - rating);
  $endMessage.innerHTML = `Te calificaste <strong>${stars}</strong>.<br>Bien ahí. Practicar trabalenguas trabaja la articulación.`;
  if (inSession) {
    $endActions.innerHTML = '<a class="btn btn--primary" href="../../session.html">Continuar sesión →</a>';
  }
  $endOv.classList.remove('hidden');
}

/* ───────── Wire ───────── */
$text.textContent = trabalenguasText;

$micBtn.addEventListener('click', function () {
  if (state === 'idle') startRecording();
  else if (state === 'recording') stopRecording();
  else if (state === 'recorded') {
    // Re-grabar
    state = 'idle';
    $playback.classList.add('hidden');
    $rating.classList.add('hidden');
    $finishBtn.disabled = true;
    rating = 0;
    $stars.forEach(function (s) { s.classList.remove('filled'); });
    if (recordingBlobUrl) { URL.revokeObjectURL(recordingBlobUrl); recordingBlobUrl = null; }
    $timerBar.style.width = '0%';
    $micLabel.textContent = 'Grabar';
    $hint.textContent = 'Tocá grabar y leélo en voz alta.';
    startRecording();
  }
});

$stars.forEach(function (s) {
  s.addEventListener('click', function () {
    setRating(parseInt(s.dataset.value, 10));
  });
});

$finishBtn.addEventListener('click', finish);

window.addEventListener('beforeunload', function () {
  if (stopTimer) clearTimeout(stopTimer);
  if (timerTick) clearInterval(timerTick);
  cleanupStream();
  if (recordingBlobUrl) URL.revokeObjectURL(recordingBlobUrl);
});
