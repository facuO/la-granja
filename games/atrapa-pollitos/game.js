// @ts-check
/** @typedef {import('../../lib/types.js').GameMetrics} GameMetrics */

/* ───────── Config por dificultad ───────── */
/**
 * @typedef {object} Cfg
 * @property {number} dropMs            Tiempo total de caída de un pollito
 * @property {number} spawnIntervalMs   Intervalo entre apariciones
 * @property {number} durationSec       Duración total del juego
 */
/** @type {Record<1|2|3|4|5, Cfg>} */
const CONFIGS = {
  1: { dropMs: 2600, spawnIntervalMs: 1900, durationSec: 60 },
  2: { dropMs: 2200, spawnIntervalMs: 1600, durationSec: 75 },
  3: { dropMs: 1800, spawnIntervalMs: 1400, durationSec: 90 },
  4: { dropMs: 1400, spawnIntervalMs: 1150, durationSec: 75 },
  5: { dropMs: 1200, spawnIntervalMs: 1100, durationSec: 75 },
};

// Ventana válida para considerar el hit como "reacción medible".
// Hits más allá de este ratio se cuentan como "captura tardía" en raw.lateHits.
const VALID_RT_RATIO = 0.75;

/* ───────── Parámetros ───────── */
const params = new URLSearchParams(location.search);
const rawDiff = parseInt(params.get('difficulty') || '3', 10);
const difficulty = /** @type {1|2|3|4|5} */ ([1,2,3,4,5].includes(rawDiff) ? rawDiff : 3);
const cfg = CONFIGS[difficulty];
const inSession = params.get('session') === '1';

/* ───────── Estado ───────── */
/** @typedef {'idle' | 'playing' | 'finished'} GameState */
/** @type {GameState} */
let state = 'idle';

/**
 * @typedef {object} ActivePollito
 * @property {HTMLImageElement} el
 * @property {'left' | 'right'} side
 * @property {'F' | 'J'} expectedKey
 * @property {number} spawnTime
 * @property {boolean} resolved
 */
/** @type {ActivePollito[]} */
let pollitos = [];

const stats = {
  hits: 0,
  omissions: 0,
  commissions: 0,
  lateHits: 0,        // hits fuera de la ventana válida (captura tardía)
  emptyPresses: 0,    // F o J apretado sin pollito vivo de NINGÚN lado
  /** @type {number[]} */
  reactionTimes: [],  // sólo RTs dentro de la ventana válida
  perHand: {
    F: { hits: 0, attempts: 0 },
    J: { hits: 0, attempts: 0 },
  },
  // Para detección de fatiga: split por mitades
  firstHalf:  { hits: 0, total: 0, rts: /** @type {number[]} */ ([]) },
  secondHalf: { hits: 0, total: 0, rts: /** @type {number[]} */ ([]) },
  totalSpawned: 0,
};

let startTimeMs = 0;
/** @type {ReturnType<typeof setTimeout> | null} */
let spawnTimer = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let endTimer = null;
/** @type {ReturnType<typeof setInterval> | null} */
let hudTimer = null;

/* ───────── DOM refs ───────── */
const $arena    = /** @type {HTMLElement} */ (document.getElementById('arena'));
const $score    = /** @type {HTMLElement} */ (document.getElementById('score'));
const $timeLeft = /** @type {HTMLElement} */ (document.getElementById('timeLeft'));
const $startOv  = /** @type {HTMLElement} */ (document.getElementById('startOverlay'));
const $endOv    = /** @type {HTMLElement} */ (document.getElementById('endOverlay'));
const $startBtn = /** @type {HTMLButtonElement} */ (document.getElementById('startBtn'));
const $playAgain = /** @type {HTMLButtonElement} */ (document.getElementById('playAgainBtn'));
const $metricsBox = /** @type {HTMLElement} */ (document.getElementById('metricsBox'));
const $keyLeft  = /** @type {HTMLElement} */ (document.getElementById('keyHintLeft'));
const $keyRight = /** @type {HTMLElement} */ (document.getElementById('keyHintRight'));

/* ───────── Flujo ───────── */
function startGame() {
  state = 'playing';
  startTimeMs = performance.now();

  // reset stats
  stats.hits = 0;
  stats.omissions = 0;
  stats.commissions = 0;
  stats.lateHits = 0;
  stats.emptyPresses = 0;
  stats.reactionTimes.length = 0;
  stats.perHand.F = { hits: 0, attempts: 0 };
  stats.perHand.J = { hits: 0, attempts: 0 };
  stats.firstHalf  = { hits: 0, total: 0, rts: [] };
  stats.secondHalf = { hits: 0, total: 0, rts: [] };
  stats.totalSpawned = 0;

  $startOv.classList.add('hidden');
  $endOv.classList.add('hidden');
  updateHud();

  document.addEventListener('keydown', handleKey);

  spawnLoop();
  endTimer = setTimeout(endGame, cfg.durationSec * 1000);
  hudTimer = setInterval(updateHud, 250);
}

function spawnLoop() {
  if (state !== 'playing') return;
  spawnPollito();
  spawnTimer = setTimeout(spawnLoop, cfg.spawnIntervalMs);
}

function spawnPollito() {
  const side = Math.random() < 0.5 ? 'left' : 'right';
  const expectedKey = side === 'left' ? 'F' : 'J';

  const el = document.createElement('img');
  el.src = '../../shared/sprites/pollito.png';
  el.alt = '';
  el.className = `pollito pollito--${side}`;

  // Calcular distancia de caída basada en altura real del arena
  const arenaHeight = $arena.clientHeight;
  const dropDistance = arenaHeight - 90; // piso aprox
  el.style.setProperty('--drop-distance', `${dropDistance}px`);
  el.style.animationDuration = `${cfg.dropMs}ms`;

  const pollito = /** @type {ActivePollito} */ ({
    el,
    side,
    expectedKey,
    spawnTime: performance.now(),
    resolved: false,
  });

  el.addEventListener('animationend', () => {
    if (pollito.resolved) return;
    // Llegó al piso sin ser atrapado
    pollito.resolved = true;
    stats.omissions++;
    // Tracking de mitad
    const halfElapsed = (performance.now() - startTimeMs) / 1000;
    const halfBucket = halfElapsed < cfg.durationSec / 2 ? stats.firstHalf : stats.secondHalf;
    halfBucket.total++;
    el.classList.add('missed');
    setTimeout(() => removePollito(pollito), 240);
    updateHud();
  });

  $arena.appendChild(el);
  pollitos.push(pollito);
  stats.totalSpawned++;
}

/** @param {KeyboardEvent} e */
function handleKey(e) {
  if (state !== 'playing') return;
  const k = e.key.toUpperCase();
  if (k !== 'F' && k !== 'J') return;

  const key = /** @type {'F' | 'J'} */ (k);
  flashKeyHint(key);

  // Pollitos vivos del lado correspondiente, el más viejo primero
  const candidates = pollitos
    .filter(p => !p.resolved && p.expectedKey === key)
    .sort((a, b) => a.spawnTime - b.spawnTime);

  if (candidates.length === 0) {
    const wrongSide = pollitos.some(p => !p.resolved && p.expectedKey !== key);
    if (wrongSide) {
      // Hay un pollito vivo del OTRO lado → mano equivocada (comisión clínica)
      stats.commissions++;
      stats.perHand[key].attempts++;
    } else {
      // Nada vivo en ningún lado → tecleo en vacío (no penaliza accuracy,
      // pero se reporta como indicador de impulsividad en raw)
      stats.emptyPresses++;
    }
    return;
  }

  // HIT — atrapás al pollito más viejo de tu lado.
  const target = candidates[0];
  const elapsed = performance.now() - target.spawnTime;
  target.resolved = true;
  stats.hits++;
  if (window.Granja && window.Granja.sound) window.Granja.sound.pio();
  stats.perHand[key].hits++;
  stats.perHand[key].attempts++;

  // RT sólo cuenta para promedio si fue dentro de la ventana válida.
  // Hits "tardíos" (>75% de la caída) se cuentan aparte para no contaminar
  // el promedio de reacción con capturas de último momento.
  const isValidRt = elapsed <= cfg.dropMs * VALID_RT_RATIO;
  if (isValidRt) {
    stats.reactionTimes.push(Math.round(elapsed));
  } else {
    stats.lateHits++;
  }

  // Tracking por mitades (detección de fatiga)
  const halfElapsed = (performance.now() - startTimeMs) / 1000;
  const halfBucket = halfElapsed < cfg.durationSec / 2 ? stats.firstHalf : stats.secondHalf;
  halfBucket.hits++;
  halfBucket.total++;
  if (isValidRt) halfBucket.rts.push(Math.round(elapsed));

  // Animación de captura: fijar la Y actual antes de cambiar animation
  const arenaHeight = $arena.clientHeight;
  const dropDistance = arenaHeight - 90;
  const progress = Math.min(elapsed / cfg.dropMs, 1);
  const catchY = -90 + dropDistance * progress + 90;
  target.el.style.setProperty('--catch-y', `${catchY}px`);
  target.el.classList.add('caught');
  setTimeout(() => removePollito(target), 320);

  updateHud();
}

/** @param {'F' | 'J'} key */
function flashKeyHint(key) {
  const $el = key === 'F' ? $keyLeft : $keyRight;
  $el.classList.add('flash');
  setTimeout(() => $el.classList.remove('flash'), 120);
}

/** @param {ActivePollito} p */
function removePollito(p) {
  if (p.el.parentNode) p.el.parentNode.removeChild(p.el);
  pollitos = pollitos.filter(x => x !== p);
}

function updateHud() {
  $score.textContent = String(stats.hits);
  const elapsed = (performance.now() - startTimeMs) / 1000;
  const left = Math.max(0, Math.round(cfg.durationSec - elapsed));
  $timeLeft.textContent = `${left}s`;
}

function endGame() {
  state = 'finished';
  if (spawnTimer) clearTimeout(spawnTimer);
  if (endTimer)   clearTimeout(endTimer);
  if (hudTimer)   clearInterval(hudTimer);
  document.removeEventListener('keydown', handleKey);

  // Limpiar pollitos vivos
  pollitos.forEach(p => p.el.remove());
  pollitos = [];

  const attempts = stats.hits + stats.omissions + stats.commissions;
  const accuracy = attempts > 0 ? stats.hits / attempts : 0;
  const avgReactionMs = stats.reactionTimes.length > 0
    ? Math.round(stats.reactionTimes.reduce((a, b) => a + b, 0) / stats.reactionTimes.length)
    : null;

  // Half accuracies — proxy de fatiga
  const halfAcc = (b) => b.total > 0 ? b.hits / b.total : null;

  // Per-hand significativa sólo con N mínimo (evitar reportar diferencias ruidosas)
  const MIN_PER_HAND_N = 20;
  const handFOk = stats.perHand.F.attempts >= MIN_PER_HAND_N;
  const handJOk = stats.perHand.J.attempts >= MIN_PER_HAND_N;
  const perHandReportable = handFOk && handJOk;

  /** @type {GameMetrics} */
  const metrics = {
    accuracy,
    avgReactionMs,
    errors: { omission: stats.omissions, commission: stats.commissions },
    level: difficulty,
    durationSec: cfg.durationSec,
    raw: {
      hits: stats.hits,
      lateHits: stats.lateHits,
      totalSpawned: stats.totalSpawned,
      emptyPresses: stats.emptyPresses,
      perHand: stats.perHand,
      perHandReportable: perHandReportable,
      firstHalfAccuracy: halfAcc(stats.firstHalf),
      secondHalfAccuracy: halfAcc(stats.secondHalf),
      validRtRatio: VALID_RT_RATIO,
    },
  };

  reportResult(metrics);
  showEndScreen(metrics);
}

/** @param {GameMetrics} metrics */
function reportResult(metrics) {
  const result = { type: 'gameFinished', gameId: 'atrapa-pollitos', metrics };
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(result, '*');
    }
  } catch (_) { /* cross-origin: ignore */ }
  try {
    localStorage.setItem('lastGameResult', JSON.stringify(result));
  } catch (_) { /* storage lleno o bloqueado: ignore */ }
}

/** @param {GameMetrics} metrics */
function showEndScreen(metrics) {
  const accuracyPct = Math.round(metrics.accuracy * 100);
  const rt = metrics.avgReactionMs != null ? `${metrics.avgReactionMs} ms` : '—';
  const handF = stats.perHand.F;
  const handJ = stats.perHand.J;
  const accF = handF.attempts ? Math.round(handF.hits / handF.attempts * 100) : 0;
  const accJ = handJ.attempts ? Math.round(handJ.hits / handJ.attempts * 100) : 0;

  // Solo mostrar comparación por mano si hay N suficiente
  const handRow = metrics.raw.perHandReportable
    ? `<div class="metric">
         <div class="metric__value">${accF}% / ${accJ}%</div>
         <div class="metric__label">Mano izq (F) / der (J)</div>
       </div>`
    : `<div class="metric">
         <div class="metric__value">${stats.hits}/${stats.totalSpawned}</div>
         <div class="metric__label">Atrapados / total</div>
       </div>`;

  $metricsBox.innerHTML = `
    <div class="metric">
      <div class="metric__value">${stats.hits}</div>
      <div class="metric__label">Pollitos atrapados</div>
    </div>
    <div class="metric">
      <div class="metric__value">${accuracyPct}%</div>
      <div class="metric__label">Precisión</div>
    </div>
    <div class="metric">
      <div class="metric__value">${rt}</div>
      <div class="metric__label">Reacción promedio</div>
    </div>
    ${handRow}
  `;

  // Si vino de session.html, reemplazar botones por "Continuar"
  if (inSession) {
    const $actions = $endOv.querySelector('.overlay__actions');
    if ($actions) {
      $actions.innerHTML = '<a class="btn btn--primary" href="../../session.html">Continuar sesión →</a>';
    }
  }

  $endOv.classList.remove('hidden');
}

/* ───────── Wire up ───────── */
$startBtn.addEventListener('click', startGame);
$playAgain.addEventListener('click', startGame);

// Permitir arrancar con Space / Enter en la pantalla de inicio
document.addEventListener('keydown', (e) => {
  if (state === 'idle' && (e.key === ' ' || e.key === 'Enter')) {
    e.preventDefault();
    startGame();
  }
});

// Limpieza si el usuario cierra/refresca
window.addEventListener('beforeunload', () => {
  if (spawnTimer) clearTimeout(spawnTimer);
  if (endTimer)   clearTimeout(endTimer);
  if (hudTimer)   clearInterval(hudTimer);
});
