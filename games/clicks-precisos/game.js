// @ts-check
/** @typedef {import('../../lib/types.js').GameMetrics} GameMetrics */

/**
 * @typedef {object} Cfg
 * @property {number} targetSize    px (lado del SVG)
 * @property {number} lifespanMs    cuánto vive en pantalla antes de desaparecer
 * @property {number} spawnGapMs    pausa entre target y target después de hit/miss
 * @property {number} durationSec   duración total
 */
// Tamaños y duraciones calibrados para 10-12 años con mouse en laptop ~1366×768.
// Piso 46px: por debajo del umbral cómodo de Fitts para puntero indirecto.
// Piso 950ms: tiempo necesario para mover el mouse a ~280px de distancia + click.
/** @type {Record<1|2|3|4|5, Cfg>} */
const CONFIGS = {
  1: { targetSize: 96, lifespanMs: 2000, spawnGapMs: 700, durationSec: 60 },
  2: { targetSize: 80, lifespanMs: 1650, spawnGapMs: 600, durationSec: 75 },
  3: { targetSize: 64, lifespanMs: 1350, spawnGapMs: 500, durationSec: 90 },
  4: { targetSize: 54, lifespanMs: 1100, spawnGapMs: 450, durationSec: 90 },
  5: { targetSize: 46, lifespanMs: 950,  spawnGapMs: 400, durationSec: 90 },
};

const params = new URLSearchParams(location.search);
const rawDiff = parseInt(params.get('difficulty') || '3', 10);
const difficulty = /** @type {1|2|3|4|5} */ ([1,2,3,4,5].includes(rawDiff) ? rawDiff : 3);
const cfg = CONFIGS[difficulty];
const inSession = params.get('session') === '1';

let state = 'idle'; // idle | playing | finished
let spawned = 0;
let hits = 0;
let timeouts = 0;
let missClicks = 0;     // clicks fuera del target *con target activo* (cerca pero erra)
let voidClicks = 0;     // clicks cuando NO hay target en pantalla — comisión clínica real
let reactionTimes = [];
let missDistances = [];

let currentTarget = null;
let currentSpawnTime = 0;
let currentTimer = null;
let nextTimer = null;
let endTimer = null;
let hudTimer = null;
let startMs = 0;
let lastTargetX = 50, lastTargetY = 50; // % of arena

const $arena = document.getElementById('arena');
const $startOv = document.getElementById('startOverlay');
const $endOv = document.getElementById('endOverlay');
const $startBtn = document.getElementById('startBtn');
const $playAgain = document.getElementById('playAgainBtn');
const $metricsBox = document.getElementById('metricsBox');
const $hitsHud = document.getElementById('hits');
const $time = document.getElementById('time');

function rand(min, max) { return min + Math.random() * (max - min); }

function pickPosition() {
  // Posición lejos del último target (al menos 25% de distancia)
  for (var attempt = 0; attempt < 8; attempt++) {
    var x = rand(8, 92);
    var y = rand(10, 88);
    var dx = x - lastTargetX;
    var dy = y - lastTargetY;
    if (Math.sqrt(dx * dx + dy * dy) > 25) {
      lastTargetX = x; lastTargetY = y;
      return { x: x, y: y };
    }
  }
  lastTargetX = lastTargetX > 50 ? 20 : 80;
  return { x: lastTargetX, y: lastTargetY };
}

function spawnTarget() {
  if (state !== 'playing') return;
  var pos = pickPosition();
  var btn = document.createElement('button');
  btn.className = 'target';
  btn.style.width = cfg.targetSize + 'px';
  btn.style.height = cfg.targetSize + 'px';
  btn.style.left = 'calc(' + pos.x + '% - ' + (cfg.targetSize / 2) + 'px)';
  btn.style.top  = 'calc(' + pos.y + '% - ' + (cfg.targetSize / 2) + 'px)';
  btn.innerHTML = '<img src="../../shared/sprites/pollito.png" alt="">';
  btn.addEventListener('click', onTargetClick);
  $arena.appendChild(btn);

  currentTarget = btn;
  currentSpawnTime = performance.now();
  spawned++;

  currentTimer = setTimeout(function () {
    if (!currentTarget) return;
    // timeout
    timeouts++;
    currentTarget.classList.add('timeout');
    var t = currentTarget;
    currentTarget = null;
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 280);
    scheduleNext();
  }, cfg.lifespanMs);
}

function onTargetClick(e) {
  if (!currentTarget || e.currentTarget !== currentTarget) return;
  e.stopPropagation();
  hits++;
  if (window.Granja && window.Granja.sound) window.Granja.sound.pio();
  var rt = performance.now() - currentSpawnTime;
  reactionTimes.push(Math.round(rt));
  if (currentTimer) clearTimeout(currentTimer);
  currentTarget.classList.add('hit');
  var t = currentTarget;
  currentTarget = null;
  setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 320);
  updateHud();
  scheduleNext();
}

function onArenaClick(e) {
  if (state !== 'playing') return;
  if (e.target.closest('.target')) return; // ya manejado por el target

  var rect = $arena.getBoundingClientRect();
  var clickX = e.clientX - rect.left;
  var clickY = e.clientY - rect.top;

  if (currentTarget) {
    // Hay target activo y erró cerca: miss espacial (no penaliza accuracy clínico,
    // pero registra distancia al centro como gradiente de precisión).
    missClicks++;
    var targetRect = currentTarget.getBoundingClientRect();
    var cx = targetRect.left - rect.left + targetRect.width / 2;
    var cy = targetRect.top - rect.top + targetRect.height / 2;
    var dist = Math.round(Math.sqrt((clickX - cx) * (clickX - cx) + (clickY - cy) * (clickY - cy)));
    missDistances.push(dist);
  } else {
    // No hay target visible: click "en el aire" — comisión clínica real
    voidClicks++;
  }

  var ripple = document.createElement('div');
  ripple.className = 'miss-ripple';
  ripple.style.left = clickX + 'px';
  ripple.style.top = clickY + 'px';
  $arena.appendChild(ripple);
  setTimeout(function () { if (ripple.parentNode) ripple.parentNode.removeChild(ripple); }, 380);
}

function scheduleNext() {
  if (state !== 'playing') return;
  if (nextTimer) clearTimeout(nextTimer);
  nextTimer = setTimeout(spawnTarget, cfg.spawnGapMs);
}

function updateHud() {
  $hitsHud.textContent = String(hits);
  if (state === 'playing') {
    var elapsed = (performance.now() - startMs) / 1000;
    var left = Math.max(0, Math.round(cfg.durationSec - elapsed));
    $time.textContent = left + 's';
  }
}

function startGame() {
  state = 'playing';
  spawned = 0; hits = 0; timeouts = 0; missClicks = 0; voidClicks = 0;
  reactionTimes.length = 0;
  missDistances.length = 0;
  startMs = performance.now();
  $startOv.classList.add('hidden');
  $endOv.classList.add('hidden');
  updateHud();
  hudTimer = setInterval(updateHud, 300);
  $arena.addEventListener('click', onArenaClick);
  spawnTarget();
  endTimer = setTimeout(endGame, cfg.durationSec * 1000);
}

function endGame() {
  state = 'finished';
  if (currentTimer) clearTimeout(currentTimer);
  if (nextTimer) clearTimeout(nextTimer);
  if (endTimer) clearTimeout(endTimer);
  if (hudTimer) clearInterval(hudTimer);
  $arena.removeEventListener('click', onArenaClick);
  if (currentTarget && currentTarget.parentNode) currentTarget.parentNode.removeChild(currentTarget);
  currentTarget = null;

  var accuracy = spawned > 0 ? hits / spawned : 0;
  var avgRt = reactionTimes.length > 0
    ? Math.round(reactionTimes.reduce(function (a,b) { return a+b; }, 0) / reactionTimes.length)
    : null;
  var avgMissDist = missDistances.length > 0
    ? Math.round(missDistances.reduce(function (a,b) { return a+b; }, 0) / missDistances.length)
    : null;

  // Nota: missClicks (errar cerca del target) NO penaliza accuracy clínico —
  // sólo voidClicks (click sin target visible) cuenta como comisión real.
  /** @type {GameMetrics} */
  var metrics = {
    accuracy: accuracy,
    avgReactionMs: avgRt,
    errors: { omission: timeouts, commission: voidClicks },
    level: difficulty,
    durationSec: cfg.durationSec,
    raw: {
      hits: hits,
      spawned: spawned,
      missClicks: missClicks,
      missDistancePxAvg: avgMissDist,
      voidClicks: voidClicks,
      targetSizePx: cfg.targetSize,
    },
  };
  reportResult(metrics);
  showEnd(metrics);
}

function reportResult(metrics) {
  var result = { type: 'gameFinished', gameId: 'clicks-precisos', metrics: metrics };
  try { if (window.parent !== window) window.parent.postMessage(result, '*'); } catch (_e) {}
  try { localStorage.setItem('lastGameResult', JSON.stringify(result)); } catch (_e) {}
}

function showEnd(metrics) {
  var accPct = Math.round(metrics.accuracy * 100);
  var missDistTxt = metrics.raw.missDistancePxAvg != null ? metrics.raw.missDistancePxAvg + 'px' : '—';
  $metricsBox.innerHTML =
    '<div class="metric"><div class="metric__value">' + hits + '</div><div class="metric__label">Atrapados</div></div>' +
    '<div class="metric"><div class="metric__value">' + accPct + '%</div><div class="metric__label">Precisión</div></div>' +
    '<div class="metric"><div class="metric__value">' + (metrics.avgReactionMs != null ? metrics.avgReactionMs + ' ms' : '—') + '</div><div class="metric__label">Reacción</div></div>' +
    '<div class="metric"><div class="metric__value">' + missDistTxt + '</div><div class="metric__label">Distancia media al errar</div></div>';
  if (inSession) {
    var $actions = $endOv.querySelector('.overlay__actions');
    if ($actions) $actions.innerHTML = '<a class="btn btn--primary" href="../../session.html">Continuar sesión →</a>';
  }
  $endOv.classList.remove('hidden');
}

$startBtn.addEventListener('click', startGame);
$playAgain.addEventListener('click', startGame);
document.addEventListener('keydown', function (e) {
  if (state === 'idle' && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); startGame(); }
});
window.addEventListener('beforeunload', function () {
  if (currentTimer) clearTimeout(currentTimer);
  if (nextTimer) clearTimeout(nextTimer);
  if (endTimer) clearTimeout(endTimer);
  if (hudTimer) clearInterval(hudTimer);
});
