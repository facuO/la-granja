// @ts-check
/** @typedef {import('../../lib/types.js').GameMetrics} GameMetrics */

/* Generador de secuencias por dificultad ascendente.
 * Devuelve { seq: [], hidden: idx, answer: n }
 * Diff 1: aritméticas +2/+3/+5
 * Diff 2: aritméticas +/-N con N hasta 12
 * Diff 3: geométricas ×2 / ÷2
 * Diff 4: aritmética + posición arbitraria del ?
 * Diff 5: patrones de "+N creciente" o Fibonacci
 */

const DURATION_SEC = 90;
const params = new URLSearchParams(location.search);
const rawDiff = parseInt(params.get('difficulty') || '3', 10);
const difficulty = [1,2,3,4,5].includes(rawDiff) ? rawDiff : 3;
const inSession = params.get('session') === '1';

function rand(min, max) { return Math.floor(min + Math.random() * (max - min + 1)); }

function genSequence(diff) {
  var seq = [], hidden = 0, answer = 0;
  if (diff === 1) {
    var start = rand(1, 8);
    var step = [2, 3, 5][rand(0, 2)];
    for (var i = 0; i < 5; i++) seq.push(start + i * step);
    hidden = rand(1, 3);
  } else if (diff === 2) {
    var sign = Math.random() < 0.5 ? 1 : -1;
    var step = rand(4, 12) * sign;
    var startMin = sign > 0 ? 5 : 50;
    var startMax = sign > 0 ? 25 : 90;
    var start = rand(startMin, startMax);
    for (var i = 0; i < 5; i++) seq.push(start + i * step);
    hidden = rand(1, 3);
  } else if (diff === 3) {
    if (Math.random() < 0.5) {
      // geométrica ×2
      var start = rand(1, 6);
      for (var i = 0; i < 5; i++) seq.push(start * Math.pow(2, i));
    } else {
      // geométrica ÷2
      var start = rand(48, 160);
      while (start % 16 !== 0) start--;
      for (var i = 0; i < 5; i++) seq.push(start / Math.pow(2, i));
    }
    hidden = rand(1, 3);
  } else if (diff === 4) {
    // Aritmética con posición arbitraria del ?. Excluye 0 (sin antecedentes
    // para inferir) y 5 (solo continuar) para mantener exigencia real. Paso
    // subido a 5-15 para que sea genuinamente más difícil que Diff 3.
    var start = rand(2, 18);
    var step = rand(5, 15);
    for (var i = 0; i < 5; i++) seq.push(start + i * step);
    hidden = rand(1, 3);
  } else {
    // Diff 5: triangulares (+1,+2,+3...) o cuadrados parciales (+1,+3,+5,+7...
    // que genera 1, 4, 9, 16, 25 — números cuadrados). Fibonacci queda fuera:
    // no es curricular en 5°-6° argentino y se confunde con triangulares.
    if (Math.random() < 0.5) {
      // Triangulares: a partir de start, sumar 1, 2, 3, 4...
      var start = rand(1, 5);
      var v = start;
      seq.push(v);
      for (var i = 1; i < 5; i++) { v += i; seq.push(v); }
    } else {
      // Cuadrados parciales: 1,3,5,7,9... acumulado → 1,4,9,16,25
      var v = 1, addition = 1;
      seq.push(v);
      for (var i = 1; i < 5; i++) { v += (2 * i + 1); seq.push(v); }
      // Resultado: 1, 4, 9, 16, 25 — números cuadrados perfectos
    }
    hidden = rand(1, 3);
  }
  answer = seq[hidden];
  return { seq: seq, hidden: hidden, answer: answer };
}

/**
 * Genera 3 distractores + el correcto. Reglas:
 *  - No coinciden con otro término visible de la secuencia (trampa injusta).
 *  - No son negativos si la secuencia es positiva.
 *  - Offset escala con magnitud del número correcto.
 * @param {number} correct
 * @param {number[]} seq  La secuencia completa (para excluir términos visibles)
 */
function genDistractors(correct, seq) {
  var opts = new Set([correct]);
  var visible = new Set(seq);
  var safety = 0;
  while (opts.size < 4 && safety++ < 50) {
    var off = rand(1, Math.max(3, Math.floor(Math.abs(correct) * 0.3)));
    var sign = Math.random() < 0.5 ? -1 : 1;
    var v = correct + off * sign;
    if (v === correct) continue;
    if (visible.has(v)) continue;             // no coincide con término visible
    if (v < 0 && correct >= 0) continue;      // no negativos si secuencia positiva
    opts.add(v);
  }
  // Fallback: offsets simples si no llenamos
  for (var k = 1; opts.size < 4 && k < 20; k++) {
    var v1 = correct + k * 2, v2 = correct - k * 2;
    if (!visible.has(v1) && (v1 >= 0 || correct < 0)) opts.add(v1);
    if (!visible.has(v2) && (v2 >= 0 || correct < 0)) opts.add(v2);
  }
  var arr = Array.from(opts).slice(0, 4);
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

let state = 'idle';
let rounds = 0, correct = 0, wrong = 0;
let reactionTimes = [];
let currentSeq = null;
let currentOptions = [];
let roundStartMs = 0;
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

function renderRound() {
  currentSeq = genSequence(difficulty);
  currentOptions = genDistractors(currentSeq.answer, currentSeq.seq);
  rounds++;
  $feedback.textContent = ''; $feedback.className = 'feedback';
  // Render secuencia con el slot oculto
  var seqHtml = currentSeq.seq.map(function (n, i) {
    if (i === currentSeq.hidden) return '<strong style="color: var(--granja-terracota); font-size: 1.2em;">?</strong>';
    return n;
  }).join(', ');
  $question.innerHTML = 'Completá la secuencia: <span style="font-variant-numeric: tabular-nums; font-weight: 700;">' + seqHtml + '</span>';
  $wordsGrid.innerHTML = '';
  currentOptions.forEach(function (n, i) {
    var btn = document.createElement('button');
    btn.className = 'word-card';
    btn.style.fontFamily = 'inherit';
    btn.style.fontVariantNumeric = 'tabular-nums';
    btn.textContent = n;
    btn.addEventListener('click', function () { onChoice(i, btn); });
    $wordsGrid.appendChild(btn);
  });
  roundStartMs = performance.now();
}

function onChoice(idx, btn) {
  if (state !== 'playing') return;
  var rt = performance.now() - roundStartMs;
  Array.from($wordsGrid.children).forEach(function (b) { b.disabled = true; });
  if (currentOptions[idx] === currentSeq.answer) {
    correct++;
    if (window.Granja && window.Granja.sound) window.Granja.sound.pio();
    reactionTimes.push(Math.round(rt));
    btn.classList.add('correct');
    $feedback.className = 'feedback ok';
    $feedback.textContent = '¡Bien! El número era ' + currentSeq.answer + '.';
  } else {
    wrong++;
    btn.classList.add('wrong');
    Array.from($wordsGrid.children).forEach(function (b) {
      if (parseInt(b.textContent, 10) === currentSeq.answer) b.classList.add('reveal');
    });
    $feedback.className = 'feedback bad';
    $feedback.textContent = 'El número era ' + currentSeq.answer + '.';
  }
  updateHud();
  nextTimer = setTimeout(renderRound, 1400);
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
  var result = { type: 'gameFinished', gameId: 'secuencias-numericas', metrics: m };
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
