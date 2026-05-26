// @ts-check
/** @typedef {import('../../lib/types.js').GameMetrics} GameMetrics */

/* Letras por dificultad. Calibrado con feedback fono:
 * - H movida a diff 4 (muda + baja frecuencia, es trampa en diff 3).
 * - Ñ baja a diff 4 con guiño (tope realista: ñoqui/ñandú/ñato).
 * - Q y X eliminadas (pool casi inexistente en castellano, frustra).
 * - F/R repiten en diff 5 como "retomas" de fluencia con presión temporal.
 * - Tiempos MONOTÓNICOS descendentes: cuanto más raro el fonema, antes se
 *   satura el pool — bajar el tiempo evita silencios frustrantes.
 */
const LETTERS = {
  1: ['M', 'P', 'C', 'S', 'T', 'L'],
  2: ['A', 'B', 'D', 'F', 'N', 'R'],
  3: ['E', 'I', 'O', 'G', 'CH'],
  4: ['V', 'J', 'U', 'H', 'Ñ'],
  5: ['Z', 'Y', 'LL', 'F', 'R'],
};
const REC_SECONDS = { 1: 45, 2: 45, 3: 40, 4: 40, 5: 35 };

const params = new URLSearchParams(location.search);
const rawDiff = parseInt(params.get('difficulty') || '3', 10);
const difficulty = [1,2,3,4,5].includes(rawDiff) ? rawDiff : 3;
const inSession = params.get('session') === '1';
const letter = LETTERS[difficulty][Math.floor(Math.random() * LETTERS[difficulty].length)];
const maxRecSec = REC_SECONDS[difficulty];

let state = 'idle';
let mediaRecorder = null;
let mediaStream = null;
let chunks = [];
let recStartMs = 0;
let recDurationMs = 0;
let reportedCount = 0;
let recordingBlobUrl = null;
let stopTimer = null;
let timerTick = null;

const $letter = document.getElementById('letter');
const $micBtn = document.getElementById('micBtn');
const $micLabel = document.getElementById('micLabel');
const $bar = document.getElementById('timerBarFill');
const $hint = document.getElementById('hint');
const $error = document.getElementById('errorBanner');
const $playback = document.getElementById('playbackBlock');
const $playbackAudio = document.getElementById('playbackAudio');
const $report = document.getElementById('reportBlock');
const $countInput = document.getElementById('countInput');
const $finishBtn = document.getElementById('finishBtn');
const $endOv = document.getElementById('endOverlay');
const $endMessage = document.getElementById('endMessage');
const $endActions = document.getElementById('endActions');

function showError(msg) { $error.textContent = msg; $error.classList.remove('hidden'); }

async function startRecording() {
  if (state === 'recording') return;
  $error.classList.add('hidden');
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    showError('Tu navegador no permite grabar audio. Decílas en voz alta igual y después contá.');
    state = 'recorded';
    revealReport();
    return;
  }
  try { mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch (_e) {
    showError('No pude acceder al micrófono. Igual podés decirlas en voz alta y contar.');
    state = 'recorded'; revealReport(); return;
  }
  try { mediaRecorder = new MediaRecorder(mediaStream); }
  catch (_e) {
    showError('No se puede grabar acá. Decílas igual y contá.');
    cleanupStream(); state = 'recorded'; revealReport(); return;
  }
  chunks = [];
  mediaRecorder.addEventListener('dataavailable', function (e) { if (e.data && e.data.size > 0) chunks.push(e.data); });
  mediaRecorder.addEventListener('stop', onRecordingStop);
  mediaRecorder.start();
  state = 'recording';
  recStartMs = performance.now();
  $micBtn.classList.add('recording');
  $micLabel.textContent = 'Detener';
  $hint.textContent = 'Decí palabras que empiecen con esa letra. Tomate tu tiempo.';
  stopTimer = setTimeout(function () { if (state === 'recording') stopRecording(); }, maxRecSec * 1000);
  timerTick = setInterval(function () {
    var elapsed = (performance.now() - recStartMs) / 1000;
    $bar.style.width = Math.min(100, (elapsed / maxRecSec) * 100) + '%';
  }, 100);
}

function stopRecording() {
  if (state !== 'recording') return;
  recDurationMs = performance.now() - recStartMs;
  if (stopTimer) clearTimeout(stopTimer);
  if (timerTick) clearInterval(timerTick);
  $bar.style.width = '100%';
  try { mediaRecorder.stop(); } catch (_e) {}
}

function onRecordingStop() {
  cleanupStream();
  if (chunks.length > 0) {
    var blob = new Blob(chunks, { type: 'audio/webm' });
    recordingBlobUrl = URL.createObjectURL(blob);
    $playbackAudio.src = recordingBlobUrl;
    $playback.classList.remove('hidden');
  }
  state = 'recorded';
  $micBtn.classList.remove('recording');
  $micLabel.textContent = 'Grabar otra vez';
  $hint.textContent = 'Escuchate y después contá cuántas dijiste.';
  revealReport();
}

function cleanupStream() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(function (t) { t.stop(); });
    mediaStream = null;
  }
}

function revealReport() {
  $report.classList.remove('hidden');
  $countInput.focus();
}

function finish() {
  var v = parseInt($countInput.value, 10);
  if (isNaN(v) || v < 0) return;
  reportedCount = v;
  state = 'finished';
  /** @type {GameMetrics} */
  var metrics = {
    accuracy: null, // métrica auto-reportada, no precisión objetiva
    avgReactionMs: null,
    errors: { omission: 0, commission: 0 },
    level: difficulty,
    durationSec: Math.round(recDurationMs / 1000) || 0,
    raw: {
      letter: letter,
      reportedCount: reportedCount,
      hasAudio: !!recordingBlobUrl,
    },
  };
  reportResult(metrics);
  showEnd();
}

function reportResult(m) {
  var result = { type: 'gameFinished', gameId: 'palabras-al-vuelo', metrics: m };
  try { if (window.parent !== window) window.parent.postMessage(result, '*'); } catch (_e) {}
  try { localStorage.setItem('lastGameResult', JSON.stringify(result)); } catch (_e) {}
}

function showEnd() {
  $endMessage.innerHTML = 'Dijiste <strong>' + reportedCount + '</strong> palabras con la letra <strong>' + letter + '</strong>.<br>Cada palabra que se te vino a la cabeza es un punto.';
  if (inSession) { $endActions.innerHTML = '<a class="btn btn--primary" href="../../session.html">Continuar sesión →</a>'; }
  $endOv.classList.remove('hidden');
}

/* Wire */
$letter.innerHTML = letter + '<small>palabras con esta letra</small>';
$micBtn.addEventListener('click', function () {
  if (state === 'idle') startRecording();
  else if (state === 'recording') stopRecording();
  else if (state === 'recorded') {
    state = 'idle';
    $playback.classList.add('hidden');
    $report.classList.add('hidden');
    if (recordingBlobUrl) { URL.revokeObjectURL(recordingBlobUrl); recordingBlobUrl = null; }
    $bar.style.width = '0%';
    $micLabel.textContent = 'Grabar';
    $hint.textContent = 'Tocá grabar y empezá a decir palabras.';
    $countInput.value = '';
    startRecording();
  }
});
$finishBtn.addEventListener('click', finish);
$countInput.addEventListener('input', function () {
  $finishBtn.disabled = !$countInput.value || isNaN(parseInt($countInput.value, 10));
});
$countInput.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !$finishBtn.disabled) finish(); });
window.addEventListener('beforeunload', function () {
  if (stopTimer) clearTimeout(stopTimer);
  if (timerTick) clearInterval(timerTick);
  cleanupStream();
  if (recordingBlobUrl) URL.revokeObjectURL(recordingBlobUrl);
});
