// @ts-check
/** @typedef {import('../../lib/types.js').GameMetrics} GameMetrics */

/* Pool de palabras por longitud. Las tildes están preservadas a propósito:
 * mostrar "leon" sin tilde refuerza error ortográfico. Los tiles renderizan
 * la letra acentuada y la comparación es directa (string ===). */
const WORDS_BY_LEN = {
  4: ['gato', 'pato', 'vaca', 'sapo', 'pico', 'nido', 'cola', 'hoja', 'miel', 'rana', 'flor', 'pera', 'lana', 'soja', 'mate', 'pala', 'león', 'maíz'],
  5: ['gallo', 'cerdo', 'perro', 'oveja', 'trigo', 'tigre', 'leche', 'huevo', 'queso', 'plato', 'pollo', 'verde', 'patio', 'arado', 'tambo', 'parva', 'campo', 'abeja'],
  6: ['conejo', 'corral', 'granja', 'cuervo', 'paloma', 'tomate', 'patito', 'cabras', 'gansos', 'cebada', 'huerta', 'sandía'],
  7: ['pollito', 'gallina', 'caballo', 'gusanos', 'ovejita', 'pradera', 'ternero', 'sembrar', 'cosecha', 'establo', 'algodón', 'gorrión'],
  8: ['mariposa', 'pollitos', 'gallinas', 'corrales', 'panadero', 'potrillo'],
  9: ['campesino', 'cocodrilo', 'verdulera', 'sembrador'],
};

// Sanidad: si alguna palabra no coincide con su longitud, alertar en consola.
Object.keys(WORDS_BY_LEN).forEach(function (key) {
  var expected = parseInt(key, 10);
  WORDS_BY_LEN[key].forEach(function (w) {
    if (w.length !== expected) {
      console.warn('[letras-revueltas] "' + w + '" tiene longitud ' + w.length + ', esperada ' + expected);
    }
  });
});

/* Lengths usadas por dificultad */
const LENGTHS_BY_DIFF = {
  1: [4],
  2: [4, 5],
  3: [5, 6],
  4: [6, 7],
  5: [7, 8, 9],
};

const DURATION_SEC = 120;
const params = new URLSearchParams(location.search);
const rawDiff = parseInt(params.get('difficulty') || '3', 10);
const difficulty = [1,2,3,4,5].includes(rawDiff) ? rawDiff : 3;
const lengths = LENGTHS_BY_DIFF[difficulty];
const inSession = params.get('session') === '1';

let state = 'idle';
let currentWord = '';      // palabra objetivo
let currentSlots = [];     // letras ingresadas en orden
let poolTiles = [];        // { letter, used, tileEl }
let solved = 0;
let attempts = 0;          // intentos completos (palabras finalizadas, ok o no)
let mistakes = 0;          // intentos completos incorrectos
let reactionTimes = [];
let roundStartMs = 0;
let endTimer = null;
let hudTimer = null;
let nextTimer = null;
let startMs = 0;
let usedWords = new Set();

const $target = document.getElementById('target');
const $pool = document.getElementById('pool');
const $feedback = document.getElementById('feedback');
const $hits = document.getElementById('hits');
const $time = document.getElementById('time');
const $startOv = document.getElementById('startOverlay');
const $endOv = document.getElementById('endOverlay');
const $startBtn = document.getElementById('startBtn');
const $playAgain = document.getElementById('playAgainBtn');
const $metricsBox = document.getElementById('metricsBox');
const $clearBtn = document.getElementById('clearBtn');
const $skipBtn = document.getElementById('skipBtn');

function shuffle(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

function pickWord() {
  var len = lengths[Math.floor(Math.random() * lengths.length)];
  var bank = WORDS_BY_LEN[len].filter(function (w) { return !usedWords.has(w); });
  if (bank.length === 0) {
    // reset usado dentro de esa longitud
    WORDS_BY_LEN[len].forEach(function (w) { usedWords.delete(w); });
    bank = WORDS_BY_LEN[len];
  }
  var w = bank[Math.floor(Math.random() * bank.length)];
  usedWords.add(w);
  return w;
}

function renderRound(word) {
  currentWord = word;
  currentSlots = [];
  $target.className = 'target';

  // Slots vacíos
  $target.innerHTML = '';
  for (var i = 0; i < word.length; i++) {
    var slot = document.createElement('div');
    slot.className = 'slot';
    slot.dataset.idx = String(i);
    slot.addEventListener('click', onSlotClick);
    $target.appendChild(slot);
  }

  // Pool de letras barajadas
  var letters = word.split('');
  // Garantizar barajado ≠ palabra
  var tries = 0;
  do {
    shuffle(letters);
    tries++;
  } while (letters.join('') === word && tries < 5);

  $pool.innerHTML = '';
  poolTiles = letters.map(function (l, i) {
    var tile = document.createElement('button');
    tile.className = 'tile';
    tile.textContent = l;
    tile.dataset.idx = String(i);
    tile.addEventListener('click', function () { onTileClick(i); });
    $pool.appendChild(tile);
    return { letter: l, used: false, tileEl: tile };
  });

  $feedback.textContent = '';
  $feedback.className = 'feedback';
  roundStartMs = performance.now();
}

function onTileClick(poolIdx) {
  if (state !== 'playing') return;
  var tile = poolTiles[poolIdx];
  if (tile.used) return;
  if (currentSlots.length >= currentWord.length) return;

  tile.used = true;
  tile.tileEl.classList.add('used');
  currentSlots.push({ letter: tile.letter, poolIdx: poolIdx });
  var idx = currentSlots.length - 1;
  var slotEl = $target.children[idx];
  slotEl.textContent = tile.letter;
  slotEl.classList.add('filled');

  if (currentSlots.length === currentWord.length) {
    // 350ms de gracia antes de validar — permite hacer click en un slot
    // para corregir la última letra antes del auto-check.
    if (nextTimer) clearTimeout(nextTimer);
    nextTimer = setTimeout(function () {
      // Si en el ínterin el usuario removió letras, no checkear aún
      if (currentSlots.length === currentWord.length) checkWord();
    }, 350);
  }
}

function onSlotClick(e) {
  if (state !== 'playing') return;
  var idx = parseInt(e.currentTarget.dataset.idx, 10);
  // Remover desde esa posición hacia adelante (más simple que arbitrario)
  while (currentSlots.length > idx) {
    var last = currentSlots.pop();
    poolTiles[last.poolIdx].used = false;
    poolTiles[last.poolIdx].tileEl.classList.remove('used');
    var slotEl = $target.children[currentSlots.length];
    slotEl.textContent = '';
    slotEl.classList.remove('filled');
  }
}

function clearSlots() {
  while (currentSlots.length > 0) {
    var last = currentSlots.pop();
    poolTiles[last.poolIdx].used = false;
    poolTiles[last.poolIdx].tileEl.classList.remove('used');
    var slotEl = $target.children[currentSlots.length];
    slotEl.textContent = '';
    slotEl.classList.remove('filled');
  }
  $target.className = 'target';
  $feedback.textContent = '';
}

function checkWord() {
  attempts++;
  var built = currentSlots.map(function (s) { return s.letter; }).join('');
  if (built === currentWord) {
    solved++;
    if (window.Granja && window.Granja.sound) window.Granja.sound.pio();
    reactionTimes.push(Math.round(performance.now() - roundStartMs));
    $target.classList.add('correct');
    $feedback.className = 'feedback ok';
    $feedback.textContent = '¡Bien! "' + currentWord + '"';
    updateHud();
    nextTimer = setTimeout(function () { renderRound(pickWord()); }, 900);
  } else {
    mistakes++;
    $target.classList.add('wrong');
    $feedback.className = 'feedback bad';
    $feedback.textContent = 'Esa no es. Probá otra vez.';
    updateHud();
    nextTimer = setTimeout(function () { clearSlots(); }, 700);
  }
}

function skipWord() {
  if (state !== 'playing' || !currentWord) return;
  attempts++;
  mistakes++;
  $feedback.className = 'feedback bad';
  $feedback.textContent = 'La palabra era "' + currentWord + '". Vamos a la próxima.';
  updateHud();
  nextTimer = setTimeout(function () { renderRound(pickWord()); }, 1200);
}

function updateHud() {
  $hits.textContent = String(solved);
  if (state === 'playing') {
    var left = Math.max(0, Math.round(DURATION_SEC - (performance.now() - startMs) / 1000));
    $time.textContent = left + 's';
  }
}

function startGame() {
  state = 'playing';
  solved = 0; attempts = 0; mistakes = 0;
  reactionTimes.length = 0;
  usedWords.clear();
  startMs = performance.now();
  $startOv.classList.add('hidden');
  $endOv.classList.add('hidden');
  hudTimer = setInterval(updateHud, 300);
  endTimer = setTimeout(endGame, DURATION_SEC * 1000);
  renderRound(pickWord());
}

function endGame() {
  state = 'finished';
  if (endTimer) clearTimeout(endTimer);
  if (hudTimer) clearInterval(hudTimer);
  if (nextTimer) clearTimeout(nextTimer);
  $target.innerHTML = ''; $pool.innerHTML = ''; $feedback.textContent = '';

  var accuracy = attempts > 0 ? solved / attempts : 0;
  var avgRt = reactionTimes.length > 0
    ? Math.round(reactionTimes.reduce(function (a,b) { return a+b; }, 0) / reactionTimes.length)
    : null;

  /** @type {GameMetrics} */
  var metrics = {
    accuracy: accuracy,
    avgReactionMs: avgRt,
    errors: { omission: 0, commission: mistakes },
    level: difficulty,
    durationSec: DURATION_SEC,
    raw: { solved: solved, attempts: attempts, mistakes: mistakes, lengths: lengths },
  };
  reportResult(metrics);
  showEnd(metrics);
}

function reportResult(m) {
  var result = { type: 'gameFinished', gameId: 'letras-revueltas', metrics: m };
  try { if (window.parent !== window) window.parent.postMessage(result, '*'); } catch (_e) {}
  try { localStorage.setItem('lastGameResult', JSON.stringify(result)); } catch (_e) {}
}

function showEnd(m) {
  var accPct = Math.round(m.accuracy * 100);
  $metricsBox.innerHTML =
    '<div class="metric"><div class="metric__value">' + solved + '</div><div class="metric__label">Palabras resueltas</div></div>' +
    '<div class="metric"><div class="metric__value">' + accPct + '%</div><div class="metric__label">Precisión</div></div>' +
    '<div class="metric"><div class="metric__value">' + (m.avgReactionMs != null ? (m.avgReactionMs/1000).toFixed(1) + 's' : '—') + '</div><div class="metric__label">Tiempo medio por palabra</div></div>' +
    '<div class="metric"><div class="metric__value">' + mistakes + '</div><div class="metric__label">Errores</div></div>';
  if (inSession) {
    var $actions = $endOv.querySelector('.overlay__actions');
    if ($actions) $actions.innerHTML = '<a class="btn btn--primary" href="../../session.html">Continuar sesión →</a>';
  }
  $endOv.classList.remove('hidden');
}

$startBtn.addEventListener('click', startGame);
$playAgain.addEventListener('click', startGame);
$clearBtn.addEventListener('click', clearSlots);
$skipBtn.addEventListener('click', skipWord);
document.addEventListener('keydown', function (e) {
  if (state === 'idle' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); startGame(); }
});
window.addEventListener('beforeunload', function () {
  if (endTimer) clearTimeout(endTimer);
  if (hudTimer) clearInterval(hudTimer);
  if (nextTimer) clearTimeout(nextTimer);
});
