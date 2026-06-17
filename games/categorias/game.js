// @ts-check
/** @typedef {import('../../lib/types.js').GameMetrics} GameMetrics */

/**
 * Pool de categorías por dificultad ASCENDENTE:
 *   Diff 1: categorías concretas, conocidas y cotidianas (5-10 ejemplos obvios).
 *   Diff 2: categorías cotidianas pero requieren un poco de búsqueda.
 *   Diff 3: subcategorías o criterios específicos.
 *   Diff 4: abstracción media, criterio compuesto.
 *   Diff 5: criterio formal o gramatical (más cercano a aula).
 */
const CATEGORIES = {
  // Target diff 1 sube a 6: las categorías obvias dan más de 5 fácil, evita techo.
  1: [
    { label: 'animales de granja', target: 6 },
    { label: 'colores', target: 6 },
    { label: 'frutas', target: 6 },
    { label: 'partes del cuerpo', target: 6 },
    { label: 'verduras', target: 6 },
  ],
  2: [
    { label: 'muebles de la casa', target: 5 },
    { label: 'ropa que usás en invierno', target: 5 },
    { label: 'cosas que hay en tu mochila', target: 5 },
    { label: 'comidas que te gustan', target: 5 },
    { label: 'útiles escolares', target: 5 },
  ],
  // Saco "palabras con M" (es fluidez fonológica, juego aparte).
  // "Cosas que hay en la cocina" → "utensilios de cocina" (más restrictiva, fuerza categorización).
  3: [
    { label: 'comidas saladas', target: 6 },
    { label: 'animales que vuelan', target: 6 },
    { label: 'juguetes', target: 6 },
    { label: 'utensilios de cocina', target: 6 },
    { label: 'cosas que dan calor', target: 6 },
  ],
  // Reformulo "lugares de compra" y "se pueden romper" (eran demasiado abiertos).
  4: [
    { label: 'instrumentos musicales', target: 6 },
    { label: 'deportes que se juegan en equipo', target: 6 },
    { label: 'animales que viven en el agua', target: 6 },
    { label: 'negocios del barrio', target: 6 },
    { label: 'cosas frágiles de vidrio o cerámica', target: 5 },
  ],
  // Saco "países con mar" (enciclopédico, no fluidez) y "esdrújulas" (metalingüístico escolar).
  // Reemplazo por criterios funcionales abstractos que mantienen abstracción sin currículum.
  5: [
    { label: 'cosas que se enchufan', target: 6 },
    { label: 'objetos que pesan menos que vos', target: 6 },
    { label: 'oficios que requieren herramientas', target: 6 },
    { label: 'lugares donde se hace silencio', target: 5 },
    { label: 'cosas que se hacen una sola vez en la vida', target: 4 },
  ],
};
const REC_SECONDS = { 1: 40, 2: 45, 3: 45, 4: 50, 5: 50 };

const params = new URLSearchParams(location.search);
const rawDiff = parseInt(params.get('difficulty') || '3', 10);
const difficulty = [1,2,3,4,5].includes(rawDiff) ? rawDiff : 3;
const inSession = params.get('session') === '1';
const pool = CATEGORIES[difficulty];
const item = pool[Math.floor(Math.random() * pool.length)];
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

const $cat = document.getElementById('categoryLabel');
const $target = document.getElementById('targetLabel');
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
    showError('Tu navegador no permite grabar. Decílas igual y después contá.');
    state = 'recorded'; revealReport(); return;
  }
  try { mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch (_e) { showError('No pude acceder al micrófono. Igual podés decirlas y contar.'); state = 'recorded'; revealReport(); return; }
  try { mediaRecorder = new MediaRecorder(mediaStream); }
  catch (_e) { showError('No se puede grabar acá. Decílas igual.'); cleanupStream(); state = 'recorded'; revealReport(); return; }
  chunks = [];
  mediaRecorder.addEventListener('dataavailable', function (e) { if (e.data && e.data.size > 0) chunks.push(e.data); });
  mediaRecorder.addEventListener('stop', onRecordingStop);
  mediaRecorder.start();
  state = 'recording';
  recStartMs = performance.now();
  $micBtn.classList.add('recording');
  $micLabel.textContent = 'Detener';
  $hint.textContent = 'Decí cosas de esa categoría. Tomate tu tiempo.';
  stopTimer = setTimeout(function () { if (state === 'recording') stopRecording(); }, maxRecSec * 1000);
  timerTick = setInterval(function () {
    var e = (performance.now() - recStartMs) / 1000;
    $bar.style.width = Math.min(100, (e / maxRecSec) * 100) + '%';
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
  $hint.textContent = 'Escuchate y contá cuántas dijiste.';
  revealReport();
}

function cleanupStream() {
  if (mediaStream) { mediaStream.getTracks().forEach(function (t) { t.stop(); }); mediaStream = null; }
}

function revealReport() { $report.classList.remove('hidden'); $countInput.focus(); }

function finish() {
  var v = parseInt($countInput.value, 10);
  if (isNaN(v) || v < 0) return;
  reportedCount = v;
  state = 'finished';
  /** @type {GameMetrics} */
  var metrics = {
    accuracy: null,
    avgReactionMs: null,
    errors: { omission: 0, commission: 0 },
    level: difficulty,
    durationSec: Math.round(recDurationMs / 1000) || 0,
    raw: {
      category: item.label,
      target: item.target,
      reportedCount: reportedCount,
      reachedTarget: reportedCount >= item.target,
      hasAudio: !!recordingBlobUrl,
    },
  };
  reportResult(metrics);
  showEnd();
}

function reportResult(m) {
  var result = { type: 'gameFinished', gameId: 'categorias', metrics: m };
  try { if (window.parent !== window) window.parent.postMessage(result, '*'); } catch (_e) {}
  try { localStorage.setItem('lastGameResult', JSON.stringify(result)); } catch (_e) {}
}

function showEnd() {
  // Mensaje suavizado: no es un examen, es un registro descriptivo.
  // El objetivo es referencia, no pasa/no pasa.
  var note = reportedCount >= item.target
    ? '¡Sumaste un buen montón!'
    : 'Mañana probás otra.';
  $endMessage.innerHTML = 'Dijiste <strong>' + reportedCount + '</strong> cosas de "' + item.label + '". ' + note;
  if (inSession) { $endActions.innerHTML = '<a class="btn btn--primary" href="../../session.html">Continuar sesión →</a>'; }
  $endOv.classList.remove('hidden');
}

$cat.textContent = item.label;
$target.textContent = 'Objetivo: decí al menos ' + item.target;

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
    $hint.textContent = 'Tocá grabar y empezá a nombrar cosas.';
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
