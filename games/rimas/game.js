// @ts-check
/** @typedef {import('../../lib/types.js').GameMetrics} GameMetrics */

/* Pool de ítems por dificultad ascendente.
 * cada item: { target, options: [4 palabras], correct: index 0-3 }
 * Las 3 distractoras NO deben rimar con target. */
const POOL = {
  1: [
    { target: 'pollito',  options: ['cerdito', 'mesa', 'casa', 'agua'],     correct: 0 },
    { target: 'gallina',  options: ['conejo', 'cocina', 'flor', 'mar'],     correct: 1 },
    { target: 'pato',     options: ['vaca', 'gato', 'rojo', 'puerta'],      correct: 1 },
    { target: 'vaca',     options: ['caballo', 'flaca', 'verde', 'piedra'], correct: 1 },
    { target: 'oveja',    options: ['conejo', 'cereza', 'abeja', 'silla'],  correct: 2 },
    { target: 'rana',     options: ['sapo', 'manzana', 'perro', 'luz'],     correct: 1 },
    { target: 'caballo',  options: ['gallo', 'pollito', 'puerta', 'agua'],  correct: 0 },
    { target: 'cabra',    options: ['oveja', 'palabra', 'libro', 'oro'],    correct: 1 },
  ],
  2: [
    { target: 'gato',     options: ['libro', 'pato', 'rojo', 'verde'],      correct: 1 },
    { target: 'sol',      options: ['luna', 'caracol', 'estrella', 'aire'], correct: 1 },
    { target: 'pan',      options: ['agua', 'imán', 'comida', 'sopa'],      correct: 1 },
    { target: 'mar',      options: ['lluvia', 'rosa', 'cantar', 'tierra'],  correct: 2 },
    { target: 'casa',     options: ['mesa', 'taza', 'silla', 'flor'],       correct: 1 },
    { target: 'pelota',   options: ['libro', 'gota', 'salto', 'agua'],      correct: 1 },
    { target: 'flor',     options: ['amor', 'casa', 'mesa', 'luz'],         correct: 0 },
    { target: 'silla',    options: ['ardilla', 'casa', 'mesa', 'banco'],    correct: 0 },
  ],
  3: [
    { target: 'corazón',  options: ['canción', 'mesa', 'cielo', 'ruta'],    correct: 0 },
    { target: 'cielo',    options: ['nube', 'pelo', 'agua', 'verde'],       correct: 1 },
    { target: 'camino',   options: ['casa', 'pajarito', 'jardín', 'sol'],   correct: 1 },
    { target: 'ventana',  options: ['banana', 'libro', 'flor', 'lápiz'],    correct: 0 },
    { target: 'estrella', options: ['cielo', 'huella', 'sol', 'tierra'],    correct: 1 },
    { target: 'guitarra', options: ['canción', 'cigarra', 'piano', 'voz'],  correct: 1 },
    { target: 'verano',   options: ['frío', 'gusano', 'lluvia', 'casa'],    correct: 1 },
    { target: 'lluvia',   options: ['rubia', 'paraguas', 'invierno', 'sol'], correct: 0 },
  ],
  4: [
    { target: 'sombrero', options: ['gorra', 'mensajero', 'campo', 'azul'], correct: 1 },
    { target: 'montaña',  options: ['cabaña', 'sierra', 'valle', 'río'],    correct: 0 },
    { target: 'libreta',  options: ['lápiz', 'galleta', 'mochila', 'libro'], correct: 1 },
    { target: 'cordillera', options: ['montaña', 'pradera', 'nieve', 'altura'], correct: 1 },
    { target: 'paisaje',  options: ['valle', 'viaje', 'campo', 'cielo'],    correct: 1 },
    { target: 'silencio', options: ['ruido', 'comercio', 'noche', 'agua'],  correct: 1 },
    { target: 'ventana',  options: ['mañana', 'puerta', 'casa', 'cuarto'],  correct: 0 },
    { target: 'estrella', options: ['ella', 'cielo', 'noche', 'brillar'],   correct: 0 },
  ],
  5: [
    { target: 'aventura', options: ['ternura', 'viaje', 'pasado', 'sueño'], correct: 0 },
    { target: 'recuerdo', options: ['olvido', 'acuerdo', 'memoria', 'pasado'], correct: 1 },
    { target: 'amanecer', options: ['atardecer', 'noche', 'día', 'sol'],    correct: 0 },
    { target: 'soledad',  options: ['compañía', 'amistad', 'silencio', 'casa'], correct: 1 },
    { target: 'naturaleza', options: ['paisaje', 'belleza', 'agua', 'bosque'], correct: 1 },
    { target: 'esperanza', options: ['tristeza', 'confianza', 'vida', 'sueño'], correct: 1 },
    { target: 'horizonte', options: ['monte', 'mar', 'sol', 'cielo'],       correct: 0 },
    { target: 'aleteo',    options: ['vuelo', 'cabeceo', 'pluma', 'ave'],   correct: 1 },
    { target: 'melodía',   options: ['armonía', 'canción', 'música', 'voz'], correct: 0 },
    { target: 'crepúsculo', options: ['minúsculo', 'noche', 'sol', 'tarde'], correct: 0 },
  ],
};

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
  var pool = POOL[difficulty];
  if (usedIdxs.size >= pool.length) usedIdxs.clear();
  var available = [];
  for (var i = 0; i < pool.length; i++) if (!usedIdxs.has(i)) available.push(i);
  var idx = available[Math.floor(Math.random() * available.length)];
  usedIdxs.add(idx);
  var item = pool[idx];
  // Barajar las opciones manteniendo cuál es correcta
  var indexed = item.options.map(function (w, i) { return { w: w, isCorrect: i === item.correct }; });
  shuffleArr(indexed);
  var correctNew = indexed.findIndex(function (x) { return x.isCorrect; });
  return { target: item.target, options: indexed.map(function (x) { return x.w; }), correct: correctNew };
}

function renderRound() {
  currentItem = pickItem();
  rounds++;
  $feedback.textContent = ''; $feedback.className = 'feedback';
  $question.innerHTML = '¿Cuál rima con <strong>' + currentItem.target + '</strong>?';
  $wordsGrid.innerHTML = '';
  currentItem.options.forEach(function (w, i) {
    var btn = document.createElement('button');
    btn.className = 'word-card';
    btn.textContent = w;
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
    $feedback.textContent = '¡Bien! "' + currentItem.options[currentItem.correct] + '" rima con "' + currentItem.target + '".';
  } else {
    wrong++;
    btn.classList.add('wrong');
    Array.from($wordsGrid.children)[currentItem.correct].classList.add('reveal');
    $feedback.className = 'feedback bad';
    $feedback.textContent = 'La que rima era "' + currentItem.options[currentItem.correct] + '".';
  }
  updateHud();
  nextTimer = setTimeout(renderRound, 1200);
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
  var result = { type: 'gameFinished', gameId: 'rimas', metrics: m };
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
