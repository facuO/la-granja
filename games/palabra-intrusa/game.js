// @ts-check
/** @typedef {import('../../lib/types.js').GameMetrics} GameMetrics */

/* Pool de items por dificultad. words: array de 4. intruder: índice 0-3. category: para feedback. */
const POOL = {
  1: [
    { words: ['gallina', 'vaca', 'oveja', 'mesa'], intruder: 3, category: 'animales' },
    { words: ['rojo', 'verde', 'azul', 'pollito'], intruder: 3, category: 'colores' },
    { words: ['manzana', 'pera', 'banana', 'piedra'], intruder: 3, category: 'frutas' },
    { words: ['silla', 'cama', 'mesa', 'pájaro'], intruder: 3, category: 'muebles' },
    { words: ['martillo', 'tornillo', 'destornillador', 'gallo'], intruder: 3, category: 'herramientas' },
    { words: ['perro', 'gato', 'conejo', 'auto'], intruder: 3, category: 'animales' },
    { words: ['lápiz', 'goma', 'cuaderno', 'manzana'], intruder: 3, category: 'útiles escolares' },
    { words: ['agua', 'jugo', 'leche', 'libro'], intruder: 3, category: 'bebidas' },
    { words: ['camisa', 'pantalón', 'zapato', 'sándwich'], intruder: 3, category: 'ropa' },
  ],
  2: [
    { words: ['enero', 'julio', 'martes', 'agosto'], intruder: 2, category: 'meses' },
    { words: ['pino', 'roble', 'sauce', 'tulipán'], intruder: 3, category: 'árboles' },
    { words: ['ojo', 'oreja', 'nariz', 'rodilla'], intruder: 3, category: 'partes de la cara' },
    { words: ['guitarra', 'piano', 'violín', 'libro'], intruder: 3, category: 'instrumentos musicales' },
    { words: ['arroz', 'fideo', 'pan', 'tenedor'], intruder: 3, category: 'comidas' },
    { words: ['triángulo', 'cuadrado', 'círculo', 'cubo'], intruder: 3, category: 'figuras planas' },
    { words: ['lluvia', 'nieve', 'granizo', 'sol'], intruder: 3, category: 'precipitaciones' },
    { words: ['mate', 'café', 'té', 'gaseosa'], intruder: 3, category: 'infusiones' },
    { words: ['dulce de leche', 'mermelada', 'miel', 'manteca'], intruder: 3, category: 'dulces para untar' },
  ],
  3: [
    { words: ['vaca', 'caballo', 'oveja', 'jirafa'], intruder: 3, category: 'animales de granja' },
    { words: ['perro', 'gato', 'caballo', 'tigre'], intruder: 3, category: 'animales domésticos' },
    { words: ['avión', 'helicóptero', 'auto', 'globo aerostático'], intruder: 2, category: 'transportes aéreos' },
    { words: ['gallina', 'pato', 'pavo', 'cerdo'], intruder: 3, category: 'aves de corral' },
    { words: ['saxofón', 'guitarra', 'trompeta', 'flauta'], intruder: 1, category: 'instrumentos de viento' },
    { words: ['pizza', 'empanada', 'milanesa', 'helado'], intruder: 3, category: 'comidas saladas' },
    { words: ['lunes', 'martes', 'sábado', 'jueves'], intruder: 2, category: 'días de lunes a viernes' },
    { words: ['rojo', 'naranja', 'amarillo', 'azul'], intruder: 3, category: 'colores cálidos' },
    { words: ['tractor', 'arado', 'cosechadora', 'bicicleta'], intruder: 3, category: 'maquinaria agrícola' },
    { words: ['trigo', 'maíz', 'soja', 'sandía'], intruder: 3, category: 'cereales y oleaginosas' },
  ],
  4: [
    { words: ['atún', 'salmón', 'merluza', 'pulpo'], intruder: 3, category: 'peces' },
    { words: ['mariposa', 'abeja', 'libélula', 'araña'], intruder: 3, category: 'insectos' },
    { words: ['rosa', 'tulipán', 'girasol', 'helecho'], intruder: 3, category: 'flores' },
    { words: ['cobre', 'hierro', 'aluminio', 'madera'], intruder: 3, category: 'metales' },
    { words: ['Mercurio', 'Venus', 'Júpiter', 'Luna'], intruder: 3, category: 'planetas' },
    { words: ['novela', 'cuento', 'poesía', 'diccionario'], intruder: 3, category: 'géneros literarios' },
    { words: ['huevo', 'leche', 'queso', 'pan'], intruder: 3, category: 'alimentos de origen animal' },
    { words: ['hervir', 'freír', 'hornear', 'pelar'], intruder: 3, category: 'formas de cocción' },
    { words: ['cordero', 'lechón', 'ternero', 'avestruz'], intruder: 3, category: 'crías de animales de granja' },
  ],
  5: [
    { words: ['saxofón', 'trompeta', 'flauta', 'violín'], intruder: 3, category: 'instrumentos de viento' },
    { words: ['oro', 'plata', 'cobre', 'mármol'], intruder: 3, category: 'metales' },
    { words: ['ballena', 'delfín', 'foca', 'tiburón'], intruder: 3, category: 'mamíferos marinos' },
    { words: ['castellano', 'inglés', 'francés', 'guaraní'], intruder: 3, category: 'lenguas europeas' },
    { words: ['novela', 'cuento', 'fábula', 'biografía'], intruder: 3, category: 'géneros de ficción' },
    { words: ['rosa', 'jazmín', 'lavanda', 'malvón'], intruder: 3, category: 'flores muy perfumadas' },
    { words: ['cuadrado', 'rectángulo', 'rombo', 'círculo'], intruder: 3, category: 'cuadriláteros' },
    { words: ['adjetivo', 'verbo', 'sustantivo', 'oración'], intruder: 3, category: 'clases de palabras' },
    { words: ['sembrar', 'cosechar', 'arar', 'martillar'], intruder: 3, category: 'tareas agrícolas' },
  ],
};

const params = new URLSearchParams(location.search);
const rawDiff = parseInt(params.get('difficulty') || '3', 10);
const difficulty = [1,2,3,4,5].includes(rawDiff) ? rawDiff : 3;
const DURATION_SEC = 90;
const inSession = params.get('session') === '1';

let state = 'idle';
let rounds = 0;
let correct = 0;
let wrong = 0;
let reactionTimes = [];
let currentItem = null;
let roundStartMs = 0;
let usedIdxs = new Set();
let endTimer = null;
let hudTimer = null;
let startMs = 0;
let nextTimer = null;

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
  for (var i = 0; i < pool.length; i++) {
    if (!usedIdxs.has(i)) available.push(i);
  }
  var idx = available[Math.floor(Math.random() * available.length)];
  usedIdxs.add(idx);
  // Devolver copia con orden barajado y nuevo intruderIdx
  var item = pool[idx];
  var indexed = item.words.map(function (w, i) { return { w: w, isIntruder: i === item.intruder }; });
  shuffleArr(indexed);
  var intruderNew = indexed.findIndex(function (x) { return x.isIntruder; });
  return { words: indexed.map(function (x) { return x.w; }), intruder: intruderNew, category: item.category };
}

function renderRound() {
  currentItem = pickItem();
  rounds++;
  $feedback.textContent = '';
  $feedback.className = 'feedback';
  $question.innerHTML = '¿Cuál <strong>no encaja</strong> con las demás?';
  $wordsGrid.innerHTML = '';
  currentItem.words.forEach(function (w, i) {
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
  if (idx === currentItem.intruder) {
    correct++;
    if (window.Granja && window.Granja.sound) window.Granja.sound.pio();
    reactionTimes.push(Math.round(rt));
    btn.classList.add('correct');
    $feedback.className = 'feedback ok';
    $feedback.textContent = 'Bien — las otras tres eran ' + currentItem.category + '.';
  } else {
    wrong++;
    btn.classList.add('wrong');
    Array.from($wordsGrid.children)[currentItem.intruder].classList.add('reveal');
    $feedback.className = 'feedback bad';
    $feedback.textContent = 'La intrusa era "' + currentItem.words[currentItem.intruder] + '". Las otras tres eran ' + currentItem.category + '.';
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
  rounds = 0; correct = 0; wrong = 0;
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
  $wordsGrid.innerHTML = '';
  $feedback.textContent = '';

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
  var result = { type: 'gameFinished', gameId: 'palabra-intrusa', metrics: m };
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
document.addEventListener('keydown', function (e) {
  if (state === 'idle' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); startGame(); }
});
window.addEventListener('beforeunload', function () {
  if (endTimer) clearTimeout(endTimer);
  if (hudTimer) clearInterval(hudTimer);
  if (nextTimer) clearTimeout(nextTimer);
});
