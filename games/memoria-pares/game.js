// @ts-check
/** @typedef {import('../../lib/types.js').GameMetrics} GameMetrics */

/* ───────── Config por dificultad ───────── */
/**
 * @typedef {object} Cfg
 * @property {number} cols
 * @property {number} rows
 * @property {number} flipViewMs   ms que dos cartas no-coincidentes quedan expuestas
 */
/** @type {Record<1|2|3|4|5, Cfg>} */
const CONFIGS = {
  1: { cols: 3, rows: 2, flipViewMs: 1500 },
  2: { cols: 4, rows: 3, flipViewMs: 1300 },
  3: { cols: 4, rows: 4, flipViewMs: 1100 },
  4: { cols: 4, rows: 4, flipViewMs: 900  },
  5: { cols: 5, rows: 4, flipViewMs: 750  },
};

const SPRITES = [
  { id: 'pollito', src: '../../shared/sprites/pollito.png' },
  { id: 'gallina', src: '../../shared/sprites/gallina.png' },
  { id: 'vaca',    src: '../../shared/sprites/vaca.png' },
  { id: 'chancho', src: '../../shared/sprites/chancho.png' },
  { id: 'pato',    src: '../../shared/sprites/pato.png' },
  { id: 'conejo',  src: '../../shared/sprites/conejo.png' },
  { id: 'cabra',   src: '../../shared/sprites/cabra.png' },
  { id: 'caballo', src: '../../shared/sprites/caballo.png' },
];

/* ───────── Params ───────── */
const params = new URLSearchParams(location.search);
const rawDiff = parseInt(params.get('difficulty') || '3', 10);
const difficulty = /** @type {1|2|3|4|5} */ ([1,2,3,4,5].includes(rawDiff) ? rawDiff : 3);
const cfg = CONFIGS[difficulty];
const inSession = params.get('session') === '1';
const totalCards = cfg.cols * cfg.rows;
const pairCount = totalCards / 2;

/* ───────── State ───────── */
let state = 'idle'; // idle | playing | finished
let flippedCards = []; // up to 2
let canFlip = true;
let attempts = 0;
let matched = 0;
let recalledMatches = 0;     // ambos índices vistos antes → match intencional
let startTimeMs = 0;
/** @type {Record<number, number>} */
let cardPriorFlips = {};     // cuántas veces se destapó cada índice antes del intento actual
/** @type {ReturnType<typeof setTimeout> | null} */
let mismatchTimer = null;

/* ───────── DOM refs ───────── */
const $board = /** @type {HTMLElement} */ (document.getElementById('board'));
const $pairs = /** @type {HTMLElement} */ (document.getElementById('pairs'));
const $time  = /** @type {HTMLElement} */ (document.getElementById('time'));
const $startOv = /** @type {HTMLElement} */ (document.getElementById('startOverlay'));
const $endOv = /** @type {HTMLElement} */ (document.getElementById('endOverlay'));
const $startBtn = /** @type {HTMLButtonElement} */ (document.getElementById('startBtn'));
const $playAgain = /** @type {HTMLButtonElement} */ (document.getElementById('playAgainBtn'));
const $metricsBox = /** @type {HTMLElement} */ (document.getElementById('metricsBox'));

let hudTimer = null;

/* ───────── Setup ───────── */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildBoard() {
  $board.innerHTML = '';
  $board.style.gridTemplateColumns = `repeat(${cfg.cols}, 1fr)`;

  // Calcular tamaño máximo de carta para que entre en el arena
  // Limit width by available — usar var CSS dinámica
  const arenaRect = $board.parentElement.getBoundingClientRect();
  const maxBoardWidth = Math.min(arenaRect.width - 48, 760);
  const cardW = (maxBoardWidth - (cfg.cols - 1) * 12) / cfg.cols;
  const maxCardH = (arenaRect.height - 48 - (cfg.rows - 1) * 12) / cfg.rows;
  const finalW = Math.min(cardW, maxCardH * 3 / 4);
  $board.style.width = (finalW * cfg.cols + (cfg.cols - 1) * 12) + 'px';

  const chosen = shuffle(SPRITES.slice()).slice(0, pairCount);
  const deck = shuffle(chosen.concat(chosen).map(function (s, i) {
    return { spriteId: s.id, src: s.src, idx: i };
  }));

  deck.forEach(function (c, idx) {
    const btn = document.createElement('button');
    btn.className = 'card';
    btn.dataset.sprite = c.spriteId;
    btn.dataset.idx = String(idx);
    btn.innerHTML = `
      <div class="card__inner">
        <div class="card__face card__face--back" aria-hidden="true"></div>
        <div class="card__face card__face--front"><img src="${c.src}" alt="${c.spriteId}"></div>
      </div>
    `;
    btn.addEventListener('click', onCardClick);
    $board.appendChild(btn);
  });
}

/* ───────── Game flow ───────── */
function startGame() {
  state = 'playing';
  flippedCards = [];
  canFlip = true;
  attempts = 0;
  matched = 0;
  recalledMatches = 0;
  cardPriorFlips = {};
  startTimeMs = performance.now();
  buildBoard();
  $startOv.classList.add('hidden');
  $endOv.classList.add('hidden');
  updateHud();
  if (hudTimer) clearInterval(hudTimer);
  hudTimer = setInterval(updateHud, 500);
}

function onCardClick(e) {
  if (!canFlip || state !== 'playing') return;
  const btn = e.currentTarget;
  if (btn.classList.contains('flipped') || btn.classList.contains('matched')) return;
  if (flippedCards.length >= 2) return;
  if (flippedCards.includes(btn)) return;

  btn.classList.add('flipped');
  flippedCards.push(btn);

  if (flippedCards.length === 2) {
    attempts++;
    const [a, b] = flippedCards;
    const idxA = parseInt(a.dataset.idx, 10);
    const idxB = parseInt(b.dataset.idx, 10);
    const priorA = cardPriorFlips[idxA] || 0;
    const priorB = cardPriorFlips[idxB] || 0;
    // Marcar como "visto" para próximos intentos
    cardPriorFlips[idxA] = priorA + 1;
    cardPriorFlips[idxB] = priorB + 1;

    if (a.dataset.sprite === b.dataset.sprite) {
      // MATCH
      matched++;
      if (window.Granja && window.Granja.sound) window.Granja.sound.pio();
      if (priorA >= 1 && priorB >= 1) recalledMatches++;
      a.classList.add('matched');
      b.classList.add('matched');
      a.disabled = true;
      b.disabled = true;
      flippedCards = [];
      updateHud();
      if (matched === pairCount) {
        setTimeout(endGame, 600);
      }
    } else {
      // MISMATCH
      canFlip = false;
      a.classList.add('mismatch');
      b.classList.add('mismatch');
      mismatchTimer = setTimeout(function () {
        a.classList.remove('flipped', 'mismatch');
        b.classList.remove('flipped', 'mismatch');
        flippedCards = [];
        canFlip = true;
      }, cfg.flipViewMs);
      updateHud();
    }
  }
}

function updateHud() {
  $pairs.textContent = matched + ' / ' + pairCount;
  if (state === 'playing') {
    const sec = Math.round((performance.now() - startTimeMs) / 1000);
    $time.textContent = sec + 's';
  }
}

function endGame() {
  state = 'finished';
  if (hudTimer) clearInterval(hudTimer);

  const durationSec = Math.round((performance.now() - startTimeMs) / 1000);
  const accuracy = attempts > 0 ? matched / attempts : 0;
  const mismatchCount = attempts - matched;

  // Nota: en memoria-pares, omisión y comisión clínicas NO aplican
  // (no es paradigma Go/No-Go ni Continuous Performance). Los mismatches
  // van a raw, no a errors.
  /** @type {GameMetrics} */
  const metrics = {
    accuracy: accuracy,
    avgReactionMs: null,
    errors: { omission: 0, commission: 0 },
    level: difficulty,
    durationSec: durationSec,
    raw: {
      pairs: matched,
      pairsTotal: pairCount,
      attempts: attempts,
      mismatches: mismatchCount,
      recalledMatches: recalledMatches,
      gridCols: cfg.cols,
      gridRows: cfg.rows,
    },
  };
  reportResult(metrics);
  showEnd(metrics);
}

function reportResult(metrics) {
  const result = { type: 'gameFinished', gameId: 'memoria-pares', metrics };
  try {
    if (window.parent && window.parent !== window) window.parent.postMessage(result, '*');
  } catch (_e) {}
  try { localStorage.setItem('lastGameResult', JSON.stringify(result)); } catch (_e) {}
}

function showEnd(metrics) {
  const accPct = Math.round(metrics.accuracy * 100);
  const perPair = matched > 0 ? (attempts / matched).toFixed(2) : '—';
  $metricsBox.innerHTML = `
    <div class="metric">
      <div class="metric__value">${matched}</div>
      <div class="metric__label">Pares encontrados</div>
    </div>
    <div class="metric">
      <div class="metric__value">${attempts}</div>
      <div class="metric__label">Intentos</div>
    </div>
    <div class="metric">
      <div class="metric__value">${perPair}</div>
      <div class="metric__label">Intentos por par</div>
    </div>
    <div class="metric">
      <div class="metric__value">${metrics.durationSec}s</div>
      <div class="metric__label">Tiempo</div>
    </div>
  `;
  if (inSession) {
    const $actions = $endOv.querySelector('.overlay__actions');
    if ($actions) $actions.innerHTML = '<a class="btn btn--primary" href="../../session.html">Continuar sesión →</a>';
  }
  $endOv.classList.remove('hidden');
}

/* ───────── Wire ───────── */
$startBtn.addEventListener('click', startGame);
$playAgain.addEventListener('click', startGame);
document.addEventListener('keydown', function (e) {
  if (state === 'idle' && (e.key === ' ' || e.key === 'Enter')) {
    e.preventDefault();
    startGame();
  }
});
window.addEventListener('beforeunload', function () {
  if (mismatchTimer) clearTimeout(mismatchTimer);
  if (hudTimer) clearInterval(hudTimer);
});
