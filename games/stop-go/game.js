// @ts-check
/** @typedef {import('../../lib/types.js').GameMetrics} GameMetrics */

/**
 * @typedef {object} Cfg
 * @property {number} goRatio       Probabilidad de pollito (go) — entre 0 y 1
 * @property {number} stimMs        Duración del estímulo en pantalla
 * @property {number} isiMs         Inter-stimulus interval
 * @property {number} durationSec
 */
/** @type {Record<1|2|3|4|5, Cfg>} */
const CONFIGS = {
  1: { goRatio: 0.70, stimMs: 1100, isiMs: 800, durationSec: 75 },
  2: { goRatio: 0.72, stimMs: 950,  isiMs: 700, durationSec: 80 },
  3: { goRatio: 0.75, stimMs: 850,  isiMs: 600, durationSec: 90 },
  4: { goRatio: 0.78, stimMs: 750,  isiMs: 520, durationSec: 90 },
  5: { goRatio: 0.80, stimMs: 650,  isiMs: 450, durationSec: 90 },
};

// Variabilidad del ISI (jitter ±N ms) para evitar anticipación rítmica
const ISI_JITTER_MS = 150;

const params = new URLSearchParams(location.search);
const rawDiff = parseInt(params.get('difficulty') || '3', 10);
const difficulty = /** @type {1|2|3|4|5} */ ([1,2,3,4,5].includes(rawDiff) ? rawDiff : 3);
const cfg = CONFIGS[difficulty];
const inSession = params.get('session') === '1';

/* State */
let state = 'idle'; // idle | playing | finished
let trials = 0;
let correctGo = 0;
let correctNoGo = 0;
let omissions = 0;   // no apretó cuando había pollito
let commissions = 0; // apretó cuando había cocodrilo
let reactionTimes = [];

let currentStim = null; // { type, startTime, resolved, el }
let stimTimer = null;
let nextTimer = null;
let endTimer = null;
let hudTimer = null;
let startMs = 0;

const $stage = document.getElementById('stage');
const $startOv = document.getElementById('startOverlay');
const $endOv = document.getElementById('endOverlay');
const $startBtn = document.getElementById('startBtn');
const $playAgain = document.getElementById('playAgainBtn');
const $metricsBox = document.getElementById('metricsBox');
const $hits = document.getElementById('hits');
const $time = document.getElementById('time');

function spawnStimulus() {
  if (state !== 'playing') return;
  var isGo = Math.random() < cfg.goRatio;
  var el = document.createElement('img');
  el.className = 'stimulus';
  el.src = isGo ? '../../shared/sprites/pollito.png' : '../../shared/sprites/cocodrilo.png';
  el.alt = isGo ? 'Pollito' : 'Cocodrilo';
  $stage.appendChild(el);

  currentStim = {
    type: isGo ? 'go' : 'nogo',
    startTime: performance.now(),
    resolved: false,
    el: el,
  };
  trials++;

  stimTimer = setTimeout(function () {
    if (!currentStim || currentStim.resolved) return;
    // Tiempo agotado
    if (currentStim.type === 'go') {
      omissions++;
      flash('wrong');
    } else {
      // No apretar al cocodrilo = correcto
      correctNoGo++;
      flash('ok');
    }
    finishStim();
  }, cfg.stimMs);
}

function finishStim() {
  if (!currentStim) return;
  currentStim.resolved = true;
  var el = currentStim.el;
  el.classList.add('exit');
  setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 200);
  currentStim = null;
  if (stimTimer) clearTimeout(stimTimer);
  updateHud();
  // ISI con jitter para evitar anticipación rítmica
  var isi = cfg.isiMs + (Math.random() * 2 - 1) * ISI_JITTER_MS;
  nextTimer = setTimeout(spawnStimulus, Math.max(200, isi));
}

function onSpace(e) {
  if (e.code !== 'Space') return;
  if (state !== 'playing') return;
  e.preventDefault();
  if (!currentStim || currentStim.resolved) return;
  if (currentStim.type === 'go') {
    // GO correcto
    correctGo++;
    if (window.Granja && window.Granja.sound) window.Granja.sound.pio();
    reactionTimes.push(Math.round(performance.now() - currentStim.startTime));
    flash('ok');
  } else {
    // NO-GO violado: comisión
    commissions++;
    flash('wrong');
  }
  finishStim();
}

function flash(kind) {
  var el = document.createElement('div');
  el.className = 'feedback-flash ' + kind;
  $stage.appendChild(el);
  setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 480);
}

function updateHud() {
  $hits.textContent = String(correctGo + correctNoGo);
  if (state === 'playing') {
    var elapsed = (performance.now() - startMs) / 1000;
    var left = Math.max(0, Math.round(cfg.durationSec - elapsed));
    $time.textContent = left + 's';
  }
}

function startGame() {
  state = 'playing';
  trials = 0; correctGo = 0; correctNoGo = 0; omissions = 0; commissions = 0;
  reactionTimes.length = 0;
  startMs = performance.now();
  $startOv.classList.add('hidden');
  $endOv.classList.add('hidden');
  document.addEventListener('keydown', onSpace);
  hudTimer = setInterval(updateHud, 300);
  endTimer = setTimeout(endGame, cfg.durationSec * 1000);
  spawnStimulus();
}

function endGame() {
  state = 'finished';
  document.removeEventListener('keydown', onSpace);
  if (stimTimer) clearTimeout(stimTimer);
  if (nextTimer) clearTimeout(nextTimer);
  if (endTimer) clearTimeout(endTimer);
  if (hudTimer) clearInterval(hudTimer);
  if (currentStim && currentStim.el && currentStim.el.parentNode) currentStim.el.parentNode.removeChild(currentStim.el);
  currentStim = null;

  var correct = correctGo + correctNoGo;
  var accuracy = trials > 0 ? correct / trials : 0;
  var sortedRt = reactionTimes.slice().sort(function (a, b) { return a - b; });
  var avgRt = sortedRt.length > 0
    ? Math.round(sortedRt.reduce(function (a,b) { return a+b; }, 0) / sortedRt.length)
    : null;
  var medianRt = sortedRt.length > 0
    ? sortedRt[Math.floor(sortedRt.length / 2)]
    : null;
  // Desvío estándar (variabilidad intra-sujeto) — indicador de atención sostenida
  var rtSd = null;
  if (sortedRt.length > 1) {
    var mean = avgRt;
    var variance = sortedRt.reduce(function (a, x) { return a + (x - mean) * (x - mean); }, 0) / sortedRt.length;
    rtSd = Math.round(Math.sqrt(variance));
  }
  // Contar trials por tipo (info útil para interpretar comisión/omisión)
  var goTrials = correctGo + omissions;
  var nogoTrials = correctNoGo + commissions;

  /** @type {GameMetrics} */
  var metrics = {
    accuracy: accuracy,
    avgReactionMs: avgRt,
    errors: { omission: omissions, commission: commissions },
    level: difficulty,
    durationSec: cfg.durationSec,
    raw: {
      trials: trials,
      correctGo: correctGo,
      correctNoGo: correctNoGo,
      goTrials: goTrials,
      nogoTrials: nogoTrials,
      goRatio: cfg.goRatio,
      medianRtMs: medianRt,
      rtSd: rtSd,
    },
  };
  reportResult(metrics);
  showEnd(metrics);
}

function reportResult(metrics) {
  var result = { type: 'gameFinished', gameId: 'stop-go', metrics: metrics };
  try { if (window.parent !== window) window.parent.postMessage(result, '*'); } catch (_e) {}
  try { localStorage.setItem('lastGameResult', JSON.stringify(result)); } catch (_e) {}
}

function showEnd(metrics) {
  var accPct = Math.round(metrics.accuracy * 100);
  $metricsBox.innerHTML =
    '<div class="metric"><div class="metric__value">' + (correctGo + correctNoGo) + ' / ' + trials + '</div><div class="metric__label">Aciertos</div></div>' +
    '<div class="metric"><div class="metric__value">' + accPct + '%</div><div class="metric__label">Precisión</div></div>' +
    '<div class="metric"><div class="metric__value">' + (metrics.avgReactionMs != null ? metrics.avgReactionMs + ' ms' : '—') + '</div><div class="metric__label">Reacción</div></div>' +
    '<div class="metric"><div class="metric__value">' + commissions + '</div><div class="metric__label">Apretadas al cocodrilo</div></div>';
  if (inSession) {
    var $actions = $endOv.querySelector('.overlay__actions');
    if ($actions) $actions.innerHTML = '<a class="btn btn--primary" href="../../session.html">Continuar sesión →</a>';
  }
  $endOv.classList.remove('hidden');
}

$startBtn.addEventListener('click', startGame);
$playAgain.addEventListener('click', startGame);
document.addEventListener('keydown', function (e) {
  if (state === 'idle' && (e.key === 'Enter')) { e.preventDefault(); startGame(); }
});
window.addEventListener('beforeunload', function () {
  if (stimTimer) clearTimeout(stimTimer);
  if (nextTimer) clearTimeout(nextTimer);
  if (endTimer) clearTimeout(endTimer);
  if (hudTimer) clearInterval(hudTimer);
});
