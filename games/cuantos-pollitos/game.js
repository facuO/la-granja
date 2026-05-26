// @ts-check
/** @typedef {import('../../lib/types.js').GameMetrics} GameMetrics */

// Exposiciones cortas: subitización/estimación real exige <1s.
// Si dejás 2 segundos, la nena cuenta serial (1-2-3...) y se mide otra cosa.
const CONFIGS = {
  1: { nMin: 4,  nMax: 7,  exposureMs: 800, freeInput: false, durationSec: 75 },
  2: { nMin: 5,  nMax: 9,  exposureMs: 700, freeInput: false, durationSec: 80 },
  3: { nMin: 7,  nMax: 12, exposureMs: 600, freeInput: false, durationSec: 90 },
  4: { nMin: 10, nMax: 15, exposureMs: 500, freeInput: false, durationSec: 90 },
  5: { nMin: 13, nMax: 20, exposureMs: 400, freeInput: true,  durationSec: 90 },
};

// Tiempo máximo para responder (después se cuenta como omisión).
const ANSWER_TIMEOUT_MS = 6000;

const params = new URLSearchParams(location.search);
const rawDiff = parseInt(params.get('difficulty') || '3', 10);
const difficulty = [1,2,3,4,5].includes(rawDiff) ? rawDiff : 3;
const cfg = CONFIGS[difficulty];
const inSession = params.get('session') === '1';

let state = 'idle';
let rounds = 0;
let correct = 0;
let wrong = 0;
let timeouts = 0;
let nearMisses = 0;       // diff 5 input libre: respuesta dentro de ±1 (raw, no accuracy)
let reactionTimes = [];
let currentN = 0;
let answerStartMs = 0;
let endTimer = null;
let hudTimer = null;
let exposureTimer = null;
let answerTimer = null;
let startMs = 0;

const $arena = document.getElementById('arena');
const $area = document.getElementById('pollitosArea');
const $prompt = document.getElementById('prompt');
const $choices = document.getElementById('choices');
const $inputBox = document.getElementById('inputBox');
const $hits = document.getElementById('hits');
const $time = document.getElementById('time');
const $startOv = document.getElementById('startOverlay');
const $endOv = document.getElementById('endOverlay');
const $startBtn = document.getElementById('startBtn');
const $playAgain = document.getElementById('playAgainBtn');
const $metricsBox = document.getElementById('metricsBox');

function rand(min, max) { return Math.floor(min + Math.random() * (max - min + 1)); }

function showPollitos(n) {
  $area.innerHTML = '';
  // Posiciones en píxeles reales del área (no en %, para que el minDist
  // tenga el mismo significado en cualquier tamaño de ventana).
  var rect = $area.getBoundingClientRect();
  var w = Math.max(200, rect.width - 56);
  var h = Math.max(180, rect.height - 56);
  var spriteSize = 48;
  // Distancia mínima entre centros: ~ tamaño del sprite + margen
  var minDist = spriteSize + 14;
  // Si hay muchos pollitos en poca área, relajar minDist para que entren
  var density = (w * h) / (n * spriteSize * spriteSize);
  if (density < 4) minDist = spriteSize + 4;

  /** @type {Array<{x:number,y:number}>} */
  var positions = [];
  var attempts = 0;
  while (positions.length < n && attempts < 400) {
    var x = rand(spriteSize / 2 + 4, w - spriteSize / 2);
    var y = rand(spriteSize / 2 + 4, h - spriteSize / 2);
    var ok = positions.every(function (p) {
      var dx = p.x - x, dy = p.y - y;
      return Math.sqrt(dx*dx + dy*dy) > minDist;
    });
    if (ok) positions.push({ x: x, y: y });
    attempts++;
  }
  // Fallback: si no se pudieron colocar todos, ubicar al azar
  while (positions.length < n) {
    positions.push({ x: rand(spriteSize / 2 + 4, w - spriteSize / 2), y: rand(spriteSize / 2 + 4, h - spriteSize / 2) });
  }

  positions.forEach(function (p) {
    var img = document.createElement('img');
    img.className = 'pol';
    img.src = '../../shared/sprites/pollito.png';
    img.alt = '';
    img.style.left = (p.x - spriteSize / 2) + 'px';
    img.style.top  = (p.y - spriteSize / 2) + 'px';
    $area.appendChild(img);
  });
}

function hidePollitos() {
  Array.from($area.querySelectorAll('.pol')).forEach(function (el) {
    el.classList.add('fading');
  });
  setTimeout(function () { $area.innerHTML = ''; }, 260);
}

function showChoices(correctN) {
  $choices.innerHTML = '';
  if (cfg.freeInput) {
    $inputBox.classList.remove('hidden');
    $inputBox.value = '';
    $inputBox.disabled = false;
    $inputBox.focus();
  } else {
    $inputBox.classList.add('hidden');
    // Distractores con escalado por ley de Weber: el offset crece con N.
    // N≤8 → ±1,2,3.  N>8 → ±2,3,4,5.
    var maxOffset = correctN > 8 ? 5 : 3;
    var minOffset = correctN > 8 ? 2 : 1;
    var options = new Set([correctN]);
    var safety = 0;
    while (options.size < 4 && safety++ < 50) {
      var off = rand(minOffset, maxOffset);
      var v = Math.random() < 0.5 ? correctN - off : correctN + off;
      if (v >= 1) options.add(v);
    }
    var arr = Array.from(options).sort(function (a, b) { return a - b; });
    arr.forEach(function (n) {
      var btn = document.createElement('button');
      btn.className = 'choice';
      btn.textContent = String(n);
      btn.addEventListener('click', function () { onChoice(n, btn); });
      $choices.appendChild(btn);
    });
  }
  answerStartMs = performance.now();
  // Timeout: si no responde en ANSWER_TIMEOUT_MS, contar como omisión
  if (answerTimer) clearTimeout(answerTimer);
  answerTimer = setTimeout(onAnswerTimeout, ANSWER_TIMEOUT_MS);
}

function onAnswerTimeout() {
  if (state !== 'playing') return;
  timeouts++;
  updateHud();
  // bloquear inputs
  Array.from($choices.children).forEach(function (b) { b.disabled = true; });
  $inputBox.disabled = true;
  setTimeout(nextRound, 600);
}

function onChoice(value, btn) {
  if (state !== 'playing') return;
  if (answerTimer) clearTimeout(answerTimer);
  var rt = performance.now() - answerStartMs;
  if (value === currentN) {
    correct++;
    if (window.Granja && window.Granja.sound) window.Granja.sound.pio();
    reactionTimes.push(Math.round(rt));
    btn.classList.add('correct');
  } else {
    wrong++;
    btn.classList.add('wrong');
    Array.from($choices.children).forEach(function (b) {
      if (b.textContent === String(currentN)) b.classList.add('correct');
    });
  }
  Array.from($choices.children).forEach(function (b) { b.disabled = true; });
  updateHud();
  setTimeout(nextRound, 800);
}

function onFreeSubmit() {
  if (state !== 'playing') return;
  var raw = $inputBox.value.trim();
  if (raw === '') return;
  var v = parseInt(raw, 10);
  if (isNaN(v)) return;
  if (answerTimer) clearTimeout(answerTimer);
  var rt = performance.now() - answerStartMs;
  if (v === currentN) {
    correct++;
    if (window.Granja && window.Granja.sound) window.Granja.sound.pio();
    reactionTimes.push(Math.round(rt));
    $inputBox.classList.add('correct');
  } else {
    wrong++;
    // En estimación libre, ±1 cuenta como "cerca" para raw (no para accuracy estricto)
    if (Math.abs(v - currentN) <= 1) nearMisses++;
    $inputBox.classList.add('wrong');
  }
  $inputBox.disabled = true;
  updateHud();
  setTimeout(function () {
    $inputBox.classList.remove('correct', 'wrong');
    $inputBox.disabled = false;
    nextRound();
  }, 900);
}

function nextRound() {
  if (state !== 'playing') return;
  rounds++;
  currentN = rand(cfg.nMin, cfg.nMax);
  $prompt.classList.add('hidden');
  $choices.innerHTML = '';
  $inputBox.classList.add('hidden');
  showPollitos(currentN);
  exposureTimer = setTimeout(function () {
    hidePollitos();
    setTimeout(function () {
      $prompt.classList.remove('hidden');
      showChoices(currentN);
    }, 200);
  }, cfg.exposureMs);
}

function updateHud() {
  $hits.textContent = String(correct);
  if (state === 'playing') {
    var left = Math.max(0, Math.round(cfg.durationSec - (performance.now() - startMs) / 1000));
    $time.textContent = left + 's';
  }
}

function startGame() {
  state = 'playing';
  rounds = 0; correct = 0; wrong = 0; timeouts = 0; nearMisses = 0;
  reactionTimes.length = 0;
  startMs = performance.now();
  $startOv.classList.add('hidden');
  $endOv.classList.add('hidden');
  $prompt.classList.add('hidden');
  hudTimer = setInterval(updateHud, 300);
  endTimer = setTimeout(endGame, cfg.durationSec * 1000);
  nextRound();
}

function endGame() {
  state = 'finished';
  if (exposureTimer) clearTimeout(exposureTimer);
  if (endTimer) clearTimeout(endTimer);
  if (hudTimer) clearInterval(hudTimer);
  if (answerTimer) clearTimeout(answerTimer);
  $prompt.classList.add('hidden');
  $area.innerHTML = '';

  var attempts = correct + wrong + timeouts;
  var accuracy = attempts > 0 ? correct / attempts : 0;
  var avgRt = reactionTimes.length > 0
    ? Math.round(reactionTimes.reduce(function (a,b) { return a+b; }, 0) / reactionTimes.length)
    : null;

  /** @type {GameMetrics} */
  var metrics = {
    accuracy: accuracy,
    avgReactionMs: avgRt,
    errors: { omission: timeouts, commission: wrong },
    level: difficulty,
    durationSec: cfg.durationSec,
    raw: {
      correct: correct, wrong: wrong, timeouts: timeouts, rounds: rounds,
      nearMisses: nearMisses,
      nRange: [cfg.nMin, cfg.nMax],
      exposureMs: cfg.exposureMs,
    },
  };
  reportResult(metrics);
  showEnd(metrics);
}

function reportResult(m) {
  var result = { type: 'gameFinished', gameId: 'cuantos-pollitos', metrics: m };
  try { if (window.parent !== window) window.parent.postMessage(result, '*'); } catch (_e) {}
  try { localStorage.setItem('lastGameResult', JSON.stringify(result)); } catch (_e) {}
}

function showEnd(m) {
  var accPct = Math.round(m.accuracy * 100);
  $metricsBox.innerHTML =
    '<div class="metric"><div class="metric__value">' + correct + '</div><div class="metric__label">Aciertos</div></div>' +
    '<div class="metric"><div class="metric__value">' + accPct + '%</div><div class="metric__label">Precisión</div></div>' +
    '<div class="metric"><div class="metric__value">' + (m.avgReactionMs != null ? (m.avgReactionMs/1000).toFixed(1) + 's' : '—') + '</div><div class="metric__label">Reacción media</div></div>' +
    '<div class="metric"><div class="metric__value">' + rounds + '</div><div class="metric__label">Rondas jugadas</div></div>';
  if (inSession) {
    var $actions = $endOv.querySelector('.overlay__actions');
    if ($actions) $actions.innerHTML = '<a class="btn btn--primary" href="../../session.html">Continuar sesión →</a>';
  }
  $endOv.classList.remove('hidden');
}

$startBtn.addEventListener('click', startGame);
$playAgain.addEventListener('click', startGame);
$inputBox.addEventListener('keydown', function (e) { if (e.key === 'Enter') onFreeSubmit(); });
document.addEventListener('keydown', function (e) {
  if (state === 'idle' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); startGame(); }
});
window.addEventListener('beforeunload', function () {
  if (exposureTimer) clearTimeout(exposureTimer);
  if (endTimer) clearTimeout(endTimer);
  if (hudTimer) clearInterval(hudTimer);
  if (answerTimer) clearTimeout(answerTimer);
});
