// @ts-check
/** @typedef {import('../../lib/types.js').GameMetrics} GameMetrics */

/** N de cada nivel, longitud de secuencia, timings, cantidad de colores.
 *  Recalibrado tras feedback de psicoped: SOA en 3-back nunca bajo ~1300ms.
 *  En adulto sano 3-back usa SOA 2500-3000ms; pediátrico aún más lento. */
const CONFIGS = {
  1: { n: 1, length: 22, stimMs: 1500, isiMs: 500, colors: 4 },
  2: { n: 2, length: 26, stimMs: 1300, isiMs: 500, colors: 4 },
  3: { n: 2, length: 28, stimMs: 1100, isiMs: 400, colors: 4 },
  4: { n: 3, length: 28, stimMs: 1100, isiMs: 400, colors: 4 },
  5: { n: 3, length: 32, stimMs: 950,  isiMs: 400, colors: 4 },
};

// Paleta reducida a 4 colores BIEN separados perceptualmente para no contaminar
// la métrica de memoria con error de discriminación visual.
// Amarillo (0deg base), verde (110), celeste (200), rosa (320).
const HUES = [0, 110, 200, 320];

const params = new URLSearchParams(location.search);
const rawDiff = parseInt(params.get('difficulty') || '3', 10);
const difficulty = [1,2,3,4,5].includes(rawDiff) ? rawDiff : 3;
const cfg = CONFIGS[difficulty];
const inSession = params.get('session') === '1';

let state = 'idle';
let sequence = [];      // valores de color (índices)
let stepIdx = 0;
let respondedThisStep = false;
let hits = 0;
let misses = 0;
let falseAlarms = 0;
let correctRejections = 0;
let reactionTimes = [];
let stepStartMs = 0;
let stepTimer = null;
let endTimer = null;

const $stage = document.getElementById('stage');
const $progress = document.getElementById('progressFill');
const $score = document.getElementById('score');
const $stepCounter = document.getElementById('stepCounter');
const $startOv = document.getElementById('startOverlay');
const $endOv = document.getElementById('endOverlay');
const $startBtn = document.getElementById('startBtn');
const $playAgain = document.getElementById('playAgainBtn');
const $metricsBox = document.getElementById('metricsBox');

function generateSequence() {
  var len = cfg.length;
  var n = cfg.n;
  var colors = cfg.colors;
  var targetMatchRate = 0.30;
  var seq = [];
  for (var i = 0; i < len; i++) {
    if (i >= n && Math.random() < targetMatchRate) {
      seq.push(seq[i - n]);
    } else {
      var v;
      var tries = 0;
      do {
        v = Math.floor(Math.random() * colors);
        tries++;
      } while (i >= n && v === seq[i - n] && tries < 10);
      seq.push(v);
    }
  }
  return seq;
}

function isMatch(i) {
  return i >= cfg.n && sequence[i] === sequence[i - cfg.n];
}

function showStim(value) {
  $stage.innerHTML = '';
  var img = document.createElement('img');
  img.className = 'stim';
  img.src = '../../shared/sprites/pollito.png';
  img.alt = '';
  img.style.filter = 'hue-rotate(' + HUES[value] + 'deg) drop-shadow(0 4px 0 rgba(60, 47, 37, 0.16))';
  $stage.appendChild(img);
}

function flash(kind) {
  var el = document.createElement('div');
  el.className = 'fb ' + kind;
  $stage.appendChild(el);
  setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 380);
}

function nextStep() {
  if (state !== 'playing') return;
  // Procesar la respuesta del paso anterior si no hubo
  if (stepIdx > 0 && !respondedThisStep) {
    // No respondió → si era match, omisión; si no, correct rejection
    if (isMatch(stepIdx - 1)) {
      misses++;
    } else {
      correctRejections++;
    }
  }
  if (stepIdx >= sequence.length) { endGame(); return; }
  respondedThisStep = false;
  showStim(sequence[stepIdx]);
  stepStartMs = performance.now();
  updateHud();
  // Avanzar después de stimMs + isiMs
  stepTimer = setTimeout(function () {
    // Ocultar antes de pasar al siguiente
    var img = $stage.querySelector('.stim');
    if (img) img.classList.add('exit');
    setTimeout(function () {
      stepIdx++;
      nextStep();
    }, cfg.isiMs);
  }, cfg.stimMs);
}

function onKey(e) {
  if (state !== 'playing') return;
  if (e.code !== 'Space') return;
  e.preventDefault();
  if (respondedThisStep) return;
  respondedThisStep = true;
  var rt = performance.now() - stepStartMs;
  if (isMatch(stepIdx)) {
    hits++;
    if (window.Granja && window.Granja.sound) window.Granja.sound.pio();
    reactionTimes.push(Math.round(rt));
    flash('ok');
  } else {
    falseAlarms++;
    flash('wrong');
  }
  updateHud();
}

function updateHud() {
  $score.textContent = String(hits);
  $stepCounter.textContent = Math.min(stepIdx + 1, sequence.length) + '/' + sequence.length;
  $progress.style.width = (stepIdx / sequence.length * 100) + '%';
}

function startGame() {
  state = 'playing';
  sequence = generateSequence();
  stepIdx = 0;
  hits = misses = falseAlarms = correctRejections = 0;
  reactionTimes.length = 0;
  $startOv.classList.add('hidden');
  $endOv.classList.add('hidden');
  document.addEventListener('keydown', onKey);
  nextStep();
}

function endGame() {
  state = 'finished';
  if (stepTimer) clearTimeout(stepTimer);
  if (endTimer) clearTimeout(endTimer);
  document.removeEventListener('keydown', onKey);
  $stage.innerHTML = '';

  var total = sequence.length - cfg.n; // los primeros N nunca pueden ser match
  var correct = hits + correctRejections;
  var accuracy = total > 0 ? correct / total : 0;
  var avgRt = reactionTimes.length > 0
    ? Math.round(reactionTimes.reduce(function (a,b) { return a+b; }, 0) / reactionTimes.length)
    : null;

  /** @type {GameMetrics} */
  var metrics = {
    accuracy: accuracy,
    avgReactionMs: avgRt,
    errors: { omission: misses, commission: falseAlarms },
    level: difficulty,
    durationSec: Math.round(sequence.length * (cfg.stimMs + cfg.isiMs) / 1000),
    raw: {
      n: cfg.n,
      sequenceLength: sequence.length,
      hits: hits, misses: misses,
      falseAlarms: falseAlarms, correctRejections: correctRejections,
      colors: cfg.colors,
    },
  };
  reportResult(metrics);
  showEnd(metrics);
}

function reportResult(m) {
  var result = { type: 'gameFinished', gameId: 'n-back', metrics: m };
  try { if (window.parent !== window) window.parent.postMessage(result, '*'); } catch (_e) {}
  try { localStorage.setItem('lastGameResult', JSON.stringify(result)); } catch (_e) {}
}

function showEnd(m) {
  var accPct = Math.round(m.accuracy * 100);
  $metricsBox.innerHTML =
    '<div class="metric"><div class="metric__value">' + hits + '</div><div class="metric__label">Aciertos</div></div>' +
    '<div class="metric"><div class="metric__value">' + accPct + '%</div><div class="metric__label">Precisión</div></div>' +
    '<div class="metric"><div class="metric__value">' + (m.avgReactionMs != null ? m.avgReactionMs + ' ms' : '—') + '</div><div class="metric__label">Reacción</div></div>' +
    '<div class="metric"><div class="metric__value">' + falseAlarms + ' / ' + misses + '</div><div class="metric__label">Falsas alarmas / dejó pasar</div></div>';
  if (inSession) {
    var $actions = $endOv.querySelector('.overlay__actions');
    if ($actions) $actions.innerHTML = '<a class="btn btn--primary" href="../../session.html">Continuar sesión →</a>';
  }
  $endOv.classList.remove('hidden');
}

// Setup intro: mostrar N específico del nivel
document.getElementById('nIndicator').textContent = String(cfg.n);
$startBtn.addEventListener('click', startGame);
$playAgain.addEventListener('click', startGame);
document.addEventListener('keydown', function (e) {
  if (state === 'idle' && e.key === 'Enter') { e.preventDefault(); startGame(); }
});
window.addEventListener('beforeunload', function () {
  if (stepTimer) clearTimeout(stepTimer);
  if (endTimer) clearTimeout(endTimer);
});
