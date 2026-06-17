// @ts-check
/** @typedef {import('../../lib/types.js').GameMetrics} GameMetrics */

/* Provincias y capitales por dificultad ascendente.
 * Diff 1: provincias muy conocidas (Bs As, Cba, Mendoza, Santa Fe).
 * Diff 5: provincias con capitales menos obvias (Tierra del Fuego, Chubut, etc.)
 */
const PROVINCIAS = {
  1: [
    { prov: 'Buenos Aires', cap: 'La Plata' },
    { prov: 'Córdoba',      cap: 'Córdoba' },
    { prov: 'Mendoza',      cap: 'Mendoza' },
    { prov: 'Santa Fe',     cap: 'Santa Fe' },
  ],
  2: [
    { prov: 'Tucumán',      cap: 'San Miguel de Tucumán' },
    { prov: 'Salta',        cap: 'Salta' },
    { prov: 'Misiones',     cap: 'Posadas' },
    { prov: 'Entre Ríos',   cap: 'Paraná' },
  ],
  3: [
    { prov: 'Jujuy',        cap: 'San Salvador de Jujuy' },
    // "San Fernando del Valle de Catamarca" es el nombre oficial pero muy
    // largo para un botón. Usamos el alias común; mostramos el oficial en feedback.
    { prov: 'Catamarca',    cap: 'San Fernando del Valle', fullCap: 'San Fernando del Valle de Catamarca' },
    { prov: 'La Rioja',     cap: 'La Rioja' },
    { prov: 'San Juan',     cap: 'San Juan' },
    { prov: 'San Luis',     cap: 'San Luis' },
  ],
  4: [
    { prov: 'Formosa',           cap: 'Formosa' },
    { prov: 'Chaco',             cap: 'Resistencia' },
    { prov: 'Corrientes',        cap: 'Corrientes' },
    { prov: 'Santiago del Estero', cap: 'Santiago del Estero' },
    { prov: 'La Pampa',          cap: 'Santa Rosa' },
  ],
  5: [
    { prov: 'Neuquén',           cap: 'Neuquén' },
    { prov: 'Río Negro',         cap: 'Viedma' },
    { prov: 'Chubut',            cap: 'Rawson' },
    { prov: 'Santa Cruz',        cap: 'Río Gallegos' },
    { prov: 'Tierra del Fuego',  cap: 'Ushuaia' },
  ],
};

// Todas las capitales para distractores
var ALL_CAPS = [];
Object.keys(PROVINCIAS).forEach(function (k) {
  PROVINCIAS[k].forEach(function (p) { ALL_CAPS.push(p.cap); });
});

const DURATION_SEC = 90;
const params = new URLSearchParams(location.search);
const rawDiff = parseInt(params.get('difficulty') || '3', 10);
const difficulty = [1,2,3,4,5].includes(rawDiff) ? rawDiff : 3;
const inSession = params.get('session') === '1';

let state = 'idle';
let rounds = 0, correct = 0, wrong = 0;
let reactionTimes = [];
let currentItem = null;
let roundStartMs = 0;
let usedIdxs = new Set();
let endTimer = null, hudTimer = null, nextTimer = null;
let startMs = 0;

const $wordsGrid = document.getElementById('wordsGrid');
const $question = document.getElementById('question');
const $feedback = document.getElementById('feedback');
const $hits = document.getElementById('hits');
const $time = document.getElementById('time');
const $startOv = document.getElementById('startOverlay');
const $endOv = document.getElementById('endOverlay');
const $startBtn = document.getElementById('startBtn');
const $playAgain = document.getElementById('playAgainBtn');
const $metricsBox = document.getElementById('metricsBox');

function shuffleArr(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

function pickItem() {
  var pool = PROVINCIAS[difficulty];
  if (usedIdxs.size >= pool.length) usedIdxs.clear();
  var available = [];
  for (var i = 0; i < pool.length; i++) if (!usedIdxs.has(i)) available.push(i);
  var idx = available[Math.floor(Math.random() * available.length)];
  usedIdxs.add(idx);
  var item = pool[idx];

  // Distractores: PRIMERO buscar capitales del MISMO nivel de dificultad.
  // Evita que en diff 1 aparezcan capitales patagónicas que Sofi descarta
  // por desconocidas (infla accuracy por familiaridad, no por saber).
  var sameDiffCaps = PROVINCIAS[difficulty].map(function (p) { return p.cap; }).filter(function (c) { return c !== item.cap; });
  shuffleArr(sameDiffCaps);
  var distractors = sameDiffCaps.slice(0, 3);
  // Si no hay suficientes en la misma diff, completar con capitales de diffs adyacentes
  if (distractors.length < 3) {
    var extra = ALL_CAPS.filter(function (c) { return c !== item.cap && distractors.indexOf(c) < 0; });
    shuffleArr(extra);
    distractors = distractors.concat(extra.slice(0, 3 - distractors.length));
  }
  var options = [item.cap].concat(distractors);
  shuffleArr(options);
  var correctIdx = options.indexOf(item.cap);
  return { prov: item.prov, cap: item.cap, fullCap: item.fullCap || item.cap, options: options, correct: correctIdx };
}

function renderRound() {
  currentItem = pickItem();
  rounds++;
  $feedback.textContent = ''; $feedback.className = 'feedback';
  $question.innerHTML = '¿Cuál es la capital de <strong>' + currentItem.prov + '</strong>?';
  $wordsGrid.innerHTML = '';
  currentItem.options.forEach(function (cap, i) {
    var btn = document.createElement('button');
    btn.className = 'word-card';
    btn.style.fontSize = 'clamp(13px, 1.5vw, 16px)';
    btn.textContent = cap;
    btn.addEventListener('click', function () { onChoice(i, btn); });
    $wordsGrid.appendChild(btn);
  });
  roundStartMs = performance.now();
}

function onChoice(idx, btn) {
  if (state !== 'playing') return;
  var rt = performance.now() - roundStartMs;
  Array.from($wordsGrid.children).forEach(function (b) { b.disabled = true; });
  if (idx === currentItem.correct) {
    correct++;
    if (window.Granja && window.Granja.sound) window.Granja.sound.pio();
    reactionTimes.push(Math.round(rt));
    btn.classList.add('correct');
    $feedback.className = 'feedback ok';
    $feedback.textContent = '¡Bien! La capital de ' + currentItem.prov + ' es ' + currentItem.fullCap + '.';
  } else {
    wrong++;
    btn.classList.add('wrong');
    Array.from($wordsGrid.children)[currentItem.correct].classList.add('reveal');
    $feedback.className = 'feedback bad';
    $feedback.textContent = 'La capital de ' + currentItem.prov + ' es ' + currentItem.fullCap + '.';
  }
  updateHud();
  nextTimer = setTimeout(renderRound, 1500);
}

function updateHud() {
  $hits.textContent = String(correct);
  if (state === 'playing') {
    var left = Math.max(0, Math.round(DURATION_SEC - (performance.now() - startMs) / 1000));
    $time.textContent = left + 's';
  }
}

function startGame() {
  state = 'playing';
  rounds = correct = wrong = 0;
  reactionTimes.length = 0;
  usedIdxs.clear();
  startMs = performance.now();
  $startOv.classList.add('hidden');
  $endOv.classList.add('hidden');
  hudTimer = setInterval(updateHud, 300);
  endTimer = setTimeout(endGame, DURATION_SEC * 1000);
  renderRound();
}

function endGame() {
  state = 'finished';
  if (endTimer) clearTimeout(endTimer);
  if (hudTimer) clearInterval(hudTimer);
  if (nextTimer) clearTimeout(nextTimer);
  $wordsGrid.innerHTML = ''; $feedback.textContent = '';

  var attempts = correct + wrong;
  var accuracy = attempts > 0 ? correct / attempts : 0;
  var avgRt = reactionTimes.length > 0
    ? Math.round(reactionTimes.reduce(function (a,b) { return a+b; }, 0) / reactionTimes.length)
    : null;

  /** @type {GameMetrics} */
  var metrics = {
    accuracy: accuracy,
    avgReactionMs: avgRt,
    errors: { omission: 0, commission: wrong },
    level: difficulty,
    durationSec: DURATION_SEC,
    raw: { correct: correct, wrong: wrong, rounds: rounds },
  };
  reportResult(metrics);
  showEnd(metrics);
}

function reportResult(m) {
  var result = { type: 'gameFinished', gameId: 'capitales-argentinas', metrics: m };
  try { if (window.parent !== window) window.parent.postMessage(result, '*'); } catch (_e) {}
  try { localStorage.setItem('lastGameResult', JSON.stringify(result)); } catch (_e) {}
}

function showEnd(m) {
  var accPct = Math.round(m.accuracy * 100);
  $metricsBox.innerHTML =
    '<div class="metric"><div class="metric__value">' + correct + '</div><div class="metric__label">Aciertos</div></div>' +
    '<div class="metric"><div class="metric__value">' + accPct + '%</div><div class="metric__label">Precisión</div></div>' +
    '<div class="metric"><div class="metric__value">' + (m.avgReactionMs != null ? (m.avgReactionMs/1000).toFixed(1) + 's' : '—') + '</div><div class="metric__label">Reacción media</div></div>' +
    '<div class="metric"><div class="metric__value">' + rounds + '</div><div class="metric__label">Rondas</div></div>';
  if (inSession) {
    var $actions = $endOv.querySelector('.overlay__actions');
    if ($actions) $actions.innerHTML = '<a class="btn btn--primary" href="../../session.html">Continuar sesión →</a>';
  }
  $endOv.classList.remove('hidden');
}

$startBtn.addEventListener('click', startGame);
$playAgain.addEventListener('click', startGame);
document.addEventListener('keydown', function (e) {
  if (state === 'idle' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); startGame(); }
});
window.addEventListener('beforeunload', function () {
  if (endTimer) clearTimeout(endTimer);
  if (hudTimer) clearInterval(hudTimer);
  if (nextTimer) clearTimeout(nextTimer);
});
