// @ts-check
/** @typedef {import('../../lib/types.js').GameMetrics} GameMetrics */

/* Animales disponibles (sprites en shared/sprites/) */
const ANIMALS = {
  pollito:   { name: 'pollito',   src: '../../shared/sprites/pollito.png',   tags: ['ave', 'cria', 'pone-huevos-cuando-grande', 'omnivoro', 'tiene-plumas'] },
  gallina:   { name: 'gallina',   src: '../../shared/sprites/gallina.png',   tags: ['ave', 'pone-huevos', 'omnivoro', 'tiene-plumas', 'animal-granja'] },
  vaca:      { name: 'vaca',      src: '../../shared/sprites/vaca.png',      tags: ['mamifero', 'da-leche', 'herbivoro', 'tiene-pelo', 'animal-granja', 'tiene-cuernos'] },
  chancho:   { name: 'chancho',   src: '../../shared/sprites/chancho.png',   tags: ['mamifero', 'omnivoro', 'tiene-pelo', 'animal-granja'] },
  pato:      { name: 'pato',      src: '../../shared/sprites/pato.png',      tags: ['ave', 'pone-huevos', 'nada', 'tiene-plumas', 'animal-granja', 'vive-en-agua'] },
  conejo:    { name: 'conejo',    src: '../../shared/sprites/conejo.png',    tags: ['mamifero', 'herbivoro', 'tiene-pelo'] },
  cabra:     { name: 'cabra',     src: '../../shared/sprites/cabra.png',     tags: ['mamifero', 'herbivoro', 'da-leche', 'tiene-pelo', 'animal-granja', 'tiene-cuernos'] },
  caballo:   { name: 'caballo',   src: '../../shared/sprites/caballo.png',   tags: ['mamifero', 'herbivoro', 'tiene-pelo', 'animal-granja'] },
  cocodrilo: { name: 'cocodrilo', src: '../../shared/sprites/cocodrilo.png', tags: ['reptil', 'pone-huevos', 'carnivoro', 'tiene-escamas', 'vive-en-agua'] },
};

/* Preguntas por dificultad. Cada item:
 *  - question: string
 *  - tag: tag a buscar (la respuesta correcta tiene ese tag, las distractoras NO)
 *  - candidates: animales que pueden ser correctos (al menos 1, idealmente 2-3 para variedad)
 *  - distractors: animales que NO tienen ese tag (al menos 3)
 *  - difficulty escala: básico (es/no es) → taxonómico (vertebrados) → ecológico (vive en) → trófico (herbívoro)
 */
const QUESTIONS = {
  1: [
    { q: '¿Cuál es un ave?',           correctTag: 'ave',           candidates: ['pollito','gallina','pato'], distractors: ['vaca','chancho','conejo','cabra','caballo','cocodrilo'] },
    { q: '¿Cuál tiene plumas?',         correctTag: 'tiene-plumas',  candidates: ['pollito','gallina','pato'], distractors: ['vaca','chancho','conejo','cabra','caballo','cocodrilo'] },
    { q: '¿Cuál tiene pelo?',           correctTag: 'tiene-pelo',    candidates: ['vaca','chancho','conejo','cabra','caballo'], distractors: ['pollito','gallina','pato','cocodrilo'] },
    { q: '¿Cuál vive en la granja?',    correctTag: 'animal-granja', candidates: ['gallina','vaca','chancho','pato','cabra','caballo'], distractors: ['conejo','cocodrilo'] },
  ],
  2: [
    { q: '¿Cuál pone huevos (de grande)?', correctTag: 'pone-huevos', candidates: ['gallina','pato','cocodrilo'], distractors: ['vaca','chancho','conejo','cabra','caballo'] },
    { q: '¿Cuál da leche?',                correctTag: 'da-leche',    candidates: ['vaca','cabra'],              distractors: ['gallina','pollito','pato','chancho','conejo','cocodrilo'] },
    { q: '¿Cuál tiene cuernos?',           correctTag: 'tiene-cuernos', candidates: ['vaca','cabra'],            distractors: ['gallina','pollito','pato','chancho','conejo','caballo','cocodrilo'] },
    { q: '¿Cuál nada en el agua?',         correctTag: 'vive-en-agua', candidates: ['pato','cocodrilo'],         distractors: ['vaca','gallina','chancho','conejo','cabra','caballo','pollito'] },
  ],
  3: [
    { q: '¿Cuál es mamífero?',     correctTag: 'mamifero',  candidates: ['vaca','chancho','conejo','cabra','caballo'], distractors: ['gallina','pollito','pato','cocodrilo'] },
    { q: '¿Cuál es reptil?',       correctTag: 'reptil',    candidates: ['cocodrilo'],                                  distractors: ['vaca','chancho','conejo','cabra','caballo','gallina','pollito','pato'] },
    { q: '¿Cuál tiene escamas?',   correctTag: 'tiene-escamas', candidates: ['cocodrilo'],                              distractors: ['vaca','chancho','conejo','cabra','caballo','gallina','pollito','pato'] },
  ],
  4: [
    { q: '¿Cuál es herbívoro (come solo plantas)?', correctTag: 'herbivoro', candidates: ['vaca','conejo','cabra','caballo'], distractors: ['gallina','chancho','pato','cocodrilo'] },
    { q: '¿Cuál es carnívoro?',                     correctTag: 'carnivoro', candidates: ['cocodrilo'],                       distractors: ['vaca','conejo','cabra','caballo','gallina','chancho','pato'] },
    { q: '¿Cuál es omnívoro (come de todo)?',       correctTag: 'omnivoro',  candidates: ['gallina','chancho','pollito'],     distractors: ['vaca','conejo','cabra','caballo','cocodrilo'] },
  ],
  // Diff 5: combinación de tags (intersecciones reales, no preguntas
  // que se reducen a otra más simple).
  5: [
    { q: '¿Cuál pone huevos y vive en el agua?',     candidates: ['pato','cocodrilo'], distractors: ['vaca','chancho','conejo','cabra','caballo','gallina','pollito'] },
    { q: '¿Cuál es mamífero, herbívoro y da leche?', candidates: ['vaca','cabra'],     distractors: ['gallina','pollito','pato','chancho','conejo','cocodrilo','caballo'] },
    { q: '¿Cuál tiene pelo y es herbívoro?',          candidates: ['vaca','conejo','cabra','caballo'], distractors: ['gallina','pollito','pato','chancho','cocodrilo'] },
    { q: '¿Cuál es de la granja pero NO es ave?',     candidates: ['vaca','chancho','cabra','caballo'], distractors: ['gallina','pollito','pato','conejo','cocodrilo'] },
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
  var pool = QUESTIONS[difficulty];
  if (usedIdxs.size >= pool.length) usedIdxs.clear();
  var available = [];
  for (var i = 0; i < pool.length; i++) if (!usedIdxs.has(i)) available.push(i);
  var idx = available[Math.floor(Math.random() * available.length)];
  usedIdxs.add(idx);
  var item = pool[idx];

  // 1 correct + 3 distractor (todos animales diferentes)
  var correct = item.candidates[Math.floor(Math.random() * item.candidates.length)];
  var distractorPool = item.distractors.slice();
  shuffleArr(distractorPool);
  var distractors = distractorPool.slice(0, 3);
  var options = [correct].concat(distractors);
  shuffleArr(options);
  var correctIdx = options.indexOf(correct);
  return { question: item.q, options: options, correct: correctIdx, correctName: ANIMALS[correct].name };
}

function renderRound() {
  currentItem = pickItem();
  rounds++;
  $feedback.textContent = ''; $feedback.className = 'feedback';
  $question.innerHTML = currentItem.question;
  $wordsGrid.innerHTML = '';
  currentItem.options.forEach(function (animalId, i) {
    var btn = document.createElement('button');
    btn.className = 'word-card';
    btn.style.padding = '12px';
    btn.style.display = 'flex';
    btn.style.flexDirection = 'column';
    btn.style.gap = '6px';
    btn.style.alignItems = 'center';
    var img = document.createElement('img');
    img.src = ANIMALS[animalId].src;
    img.alt = animalId;
    img.style.width = '72px';
    img.style.height = '72px';
    var lbl = document.createElement('span');
    lbl.textContent = ANIMALS[animalId].name;
    lbl.style.fontSize = '13px';
    btn.appendChild(img);
    btn.appendChild(lbl);
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
    $feedback.textContent = '¡Bien! Era el ' + currentItem.correctName + '.';
  } else {
    wrong++;
    btn.classList.add('wrong');
    Array.from($wordsGrid.children)[currentItem.correct].classList.add('reveal');
    $feedback.className = 'feedback bad';
    $feedback.textContent = 'Era el ' + currentItem.correctName + '.';
  }
  updateHud();
  nextTimer = setTimeout(renderRound, 1300);
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
  var result = { type: 'gameFinished', gameId: 'adivina-animal', metrics: m };
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
