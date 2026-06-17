// @ts-check
/** @typedef {import('../../lib/types.js').GameMetrics} GameMetrics */

// Diff 5 suavizado: 650ms generaba omisión artificial por apremio temporal,
// no por fallo inhibitorio. ISI 500 da reseteo post-error.
const CONFIGS = {
  1: { stimMs: 1500, isiMs: 800, durationSec: 60 },
  2: { stimMs: 1250, isiMs: 700, durationSec: 75 },
  3: { stimMs: 1050, isiMs: 600, durationSec: 90 },
  4: { stimMs: 900,  isiMs: 550, durationSec: 90 },
  5: { stimMs: 800,  isiMs: 500, durationSec: 90 },
};

const params = new URLSearchParams(location.search);
const rawDiff = parseInt(params.get('difficulty') || '3', 10);
const difficulty = [1,2,3,4,5].includes(rawDiff) ? rawDiff : 3;
const cfg = CONFIGS[difficulty];
const inSession = params.get('session') === '1';

let state = 'idle';
let trials = 0;
let correct = 0;
let wrongKey = 0;     // apretó tecla del mismo lado del estímulo (no cruzó) = commission
let omissions = 0;    // no apretó nada → omission
let reactionTimes = [];
let perHand = { F: { hits: 0, attempts: 0 }, J: { hits: 0, attempts: 0 } };

let currentStim = null;
let stimTimer = null;
let nextTimer = null;
let endTimer = null;
let hudTimer = null;
let startMs = 0;

const $laneLeft = document.getElementById('laneLeft');
const $laneRight = document.getElementById('laneRight');
const $keyLeftEl = document.getElementById('keyLeft');
const $keyRightEl = document.getElementById('keyRight');
const $hits = document.getElementById('hits');
const $time = document.getElementById('time');
const $startOv = document.getElementById('startOverlay');
const $endOv = document.getElementById('endOverlay');
const $startBtn = document.getElementById('startBtn');
const $playAgain = document.getElementById('playAgainBtn');
const $metricsBox = document.getElementById('metricsBox');

function spawn() {
  if (state !== 'playing') return;
  var side = Math.random() < 0.5 ? 'left' : 'right';
  // Tecla esperada es la DEL LADO OPUESTO al estímulo (mano cruzada)
  var expectedKey = side === 'left' ? 'J' : 'F';
  var lane = side === 'left' ? $laneLeft : $laneRight;
  lane.classList.add('active');

  var img = document.createElement('img');
  img.className = 'lane__pol';
  img.src = '../../shared/sprites/pollito.png';
  img.alt = '';
  lane.appendChild(img);

  currentStim = { side: side, expectedKey: expectedKey, lane: lane, img: img, startTime: performance.now(), resolved: false };
  trials++;

  stimTimer = setTimeout(function () {
    if (!currentStim || currentStim.resolved) return;
    omissions++;
    finishStim(false);
  }, cfg.stimMs);
}

function finishStim(showGlow) {
  if (!currentStim) return;
  var s = currentStim;
  s.resolved = true;
  s.img.classList.add('exit');
  s.lane.classList.remove('active');
  if (showGlow) {
    var g = document.createElement('div');
    g.className = 'fb-glow ' + showGlow;
    s.lane.appendChild(g);
    setTimeout(function () { if (g.parentNode) g.parentNode.removeChild(g); }, 380);
  }
  setTimeout(function () { if (s.img.parentNode) s.img.parentNode.removeChild(s.img); }, 200);
  if (stimTimer) clearTimeout(stimTimer);
  currentStim = null;
  updateHud();
  nextTimer = setTimeout(spawn, cfg.isiMs);
}

function onKey(e) {
  if (state !== 'playing') return;
  var k = e.key.toUpperCase();
  if (k !== 'F' && k !== 'J') return;
  // flash visual del key
  var $kc = k === 'F' ? $keyLeftEl : $keyRightEl;
  $kc.classList.add('flash');
  setTimeout(function () { $kc.classList.remove('flash'); }, 130);

  if (!currentStim || currentStim.resolved) return;

  perHand[k].attempts++;
  if (k === currentStim.expectedKey) {
    correct++;
    if (window.Granja && window.Granja.sound) window.Granja.sound.pio();
    perHand[k].hits++;
    reactionTimes.push(Math.round(performance.now() - currentStim.startTime));
    finishStim('ok');
  } else {
    wrongKey++;
    finishStim('wrong');
  }
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
  trials = correct = wrongKey = omissions = 0;
  reactionTimes.length = 0;
  perHand.F = { hits: 0, attempts: 0 };
  perHand.J = { hits: 0, attempts: 0 };
  startMs = performance.now();
  $startOv.classList.add('hidden');
  $endOv.classList.add('hidden');
  document.addEventListener('keydown', onKey);
  hudTimer = setInterval(updateHud, 300);
  endTimer = setTimeout(endGame, cfg.durationSec * 1000);
  spawn();
}

function endGame() {
  state = 'finished';
  if (stimTimer) clearTimeout(stimTimer);
  if (nextTimer) clearTimeout(nextTimer);
  if (endTimer) clearTimeout(endTimer);
  if (hudTimer) clearInterval(hudTimer);
  document.removeEventListener('keydown', onKey);
  if (currentStim && currentStim.img.parentNode) currentStim.img.parentNode.removeChild(currentStim.img);
  $laneLeft.classList.remove('active');
  $laneRight.classList.remove('active');
  currentStim = null;

  var accuracy = trials > 0 ? correct / trials : 0;
  var avgRt = reactionTimes.length > 0
    ? Math.round(reactionTimes.reduce(function (a,b) { return a+b; }, 0) / reactionTimes.length)
    : null;

  /** @type {GameMetrics} */
  var metrics = {
    accuracy: accuracy,
    avgReactionMs: avgRt,
    errors: { omission: omissions, commission: wrongKey },
    level: difficulty,
    durationSec: cfg.durationSec,
    raw: { trials: trials, correct: correct, wrongKey: wrongKey, omissions: omissions, perHand: perHand },
  };
  reportResult(metrics);
  showEnd(metrics);
}

function reportResult(m) {
  var result = { type: 'gameFinished', gameId: 'cruzados', metrics: m };
  try { if (window.parent !== window) window.parent.postMessage(result, '*'); } catch (_e) {}
  try { localStorage.setItem('lastGameResult', JSON.stringify(result)); } catch (_e) {}
}

function showEnd(m) {
  var accPct = Math.round(m.accuracy * 100);
  $metricsBox.innerHTML =
    '<div class="metric"><div class="metric__value">' + correct + ' / ' + trials + '</div><div class="metric__label">Aciertos</div></div>' +
    '<div class="metric"><div class="metric__value">' + accPct + '%</div><div class="metric__label">Precisión</div></div>' +
    '<div class="metric"><div class="metric__value">' + (m.avgReactionMs != null ? m.avgReactionMs + ' ms' : '—') + '</div><div class="metric__label">Reacción</div></div>' +
    '<div class="metric"><div class="metric__value">' + wrongKey + '</div><div class="metric__label">Mano del mismo lado</div></div>';
  if (inSession) {
    var $actions = $endOv.querySelector('.overlay__actions');
    if ($actions) $actions.innerHTML = '<a class="btn btn--primary" href="../../session.html">Continuar sesión →</a>';
  }
  $endOv.classList.remove('hidden');
}

$startBtn.addEventListener('click', startGame);
$playAgain.addEventListener('click', startGame);
document.addEventListener('keydown', function (e) {
  if (state === 'idle' && e.key === 'Enter') { e.preventDefault(); startGame(); }
});
window.addEventListener('beforeunload', function () {
  if (stimTimer) clearTimeout(stimTimer);
  if (nextTimer) clearTimeout(nextTimer);
  if (endTimer) clearTimeout(endTimer);
  if (hudTimer) clearInterval(hudTimer);
});
