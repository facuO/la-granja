// @ts-check
/** @typedef {import('../../lib/types.js').GameMetrics} GameMetrics */

/* Config: tiempo por problema + duración total, según dificultad.
 * Diff 5 sube de 4s a 6s: la jerarquía de operaciones requiere planificación,
 * no sólo recuperación de hechos. */
const CONFIGS = {
  1: { problemMs: 7000, durationSec: 75 },
  2: { problemMs: 6000, durationSec: 80 },
  3: { problemMs: 5000, durationSec: 90 },
  4: { problemMs: 5000, durationSec: 90 },
  5: { problemMs: 6000, durationSec: 90 },
};

const params = new URLSearchParams(location.search);
const rawDiff = parseInt(params.get('difficulty') || '3', 10);
const difficulty = [1,2,3,4,5].includes(rawDiff) ? rawDiff : 3;
const cfg = CONFIGS[difficulty];
const inSession = params.get('session') === '1';

/* ── Generadores de problemas por dificultad ── */
function rand(min, max) { return Math.floor(min + Math.random() * (max - min + 1)); }

const FRAMES = [
  function (a, b) { return 'La gallina puso ' + a + ' huevos y después ' + b + '. ¿Cuántos hay?'; },
  function (a, b) { return 'En el corral hay ' + a + ' pollitos. Llegan ' + b + ' más. ¿Cuántos pollitos hay?'; },
  function (a, b) { return 'Había ' + a + ' granos de maíz. La gallina guardó ' + b + ' en el nido. ¿Cuántos quedan?'; },
];

function maybeFrame(a, b, op, value) {
  // Frasear sólo en diff 1-2 (en diff alta agrega ruido de lectura al RT).
  // Pequeñas operaciones para no encarecer la lectura.
  if (difficulty <= 2 && Math.random() < 0.25 && (op === '+' || op === '-') && Math.max(a, b) <= 25) {
    var frame = op === '+'
      ? FRAMES[rand(0, 1)]
      : FRAMES[2];
    return { text: frame(a, b), answer: value, isFrame: true, type: op };
  }
  return { text: a + ' ' + op + ' ' + b, answer: value, isFrame: false, type: op };
}

function genProblem(diff) {
  // Diff 1: sumas hasta 30, restas hasta 25. Currículum 2°-3° pero como warm-up.
  if (diff === 1) {
    if (Math.random() < 0.5) {
      var a = rand(5, 18), b = rand(3, 12);
      return maybeFrame(a, b, '+', a + b);
    } else {
      var a = rand(10, 25), b = rand(3, a - 1);
      return maybeFrame(a, b, '-', a - b);
    }
  }
  // Diff 2: sumas/restas hasta 80
  if (diff === 2) {
    if (Math.random() < 0.5) {
      var a = rand(15, 50), b = rand(8, 30);
      return maybeFrame(a, b, '+', a + b);
    } else {
      var a = rand(20, 80), b = rand(5, a - 1);
      return maybeFrame(a, b, '-', a - b);
    }
  }
  // Diff 3: SOLO tablas de multiplicar (familia homogénea, RT interpretable)
  if (diff === 3) {
    var a = rand(2, 9), b = rand(2, 9);
    return { text: a + ' × ' + b, answer: a * b, isFrame: false, type: '×' };
  }
  // Diff 4: tablas + división exacta (mismas familias)
  if (diff === 4) {
    if (Math.random() < 0.5) {
      var a = rand(3, 9), b = rand(2, 9);
      return { text: a + ' × ' + b, answer: a * b, isFrame: false, type: '×' };
    } else {
      var b = rand(2, 9), result = rand(2, 9);
      var a = b * result;
      return { text: a + ' ÷ ' + b, answer: result, isFrame: false, type: '÷' };
    }
  }
  // Diff 5: dos operaciones MÁXIMO con paréntesis EXPLÍCITOS (no jerarquía implícita)
  var pattern = rand(1, 3);
  if (pattern === 1) {
    var a = rand(2, 10), b = rand(2, 10), c = rand(2, 9);
    return { text: '(' + a + ' + ' + b + ') × ' + c, answer: (a + b) * c, isFrame: false, type: 'mix' };
  }
  if (pattern === 2) {
    var a = rand(15, 50), b = rand(5, 15), c = rand(2, 6);
    return { text: a + ' - (' + b + ' × ' + c + ')', answer: a - b * c, isFrame: false, type: 'mix' };
  }
  var b = rand(2, 9), result = rand(2, 9);
  var a = b * result;
  var c = rand(2, 12);
  return { text: '(' + a + ' ÷ ' + b + ') + ' + c, answer: result + c, isFrame: false, type: 'mix' };
}

/* ── Estado ── */
let state = 'idle';
let totalProblems = 0;
let correct = 0;
let wrong = 0;
let timeouts = 0;
let reactionTimes = [];
let byType = {};       // raw.byType: tipo de operación → { correct, wrong, timeouts }
let rtByType = {};     // raw.rtByType: tipo → array de RTs correctas
let currentProblem = null;
let problemStartMs = 0;
let problemTimer = null;
let problemBarTimer = null;
let endTimer = null;
let hudTimer = null;
let startMs = 0;

const $stage = document.getElementById('stage');
const $problem = document.getElementById('problem');
const $answer = document.getElementById('answer');
const $bar = document.getElementById('timerBar');
const $hits = document.getElementById('hits');
const $time = document.getElementById('time');
const $startOv = document.getElementById('startOverlay');
const $endOv = document.getElementById('endOverlay');
const $startBtn = document.getElementById('startBtn');
const $playAgain = document.getElementById('playAgainBtn');
const $metricsBox = document.getElementById('metricsBox');

function nextProblem() {
  if (state !== 'playing') return;
  currentProblem = genProblem(difficulty);
  $problem.textContent = currentProblem.text;
  $problem.classList.toggle('frase', !!currentProblem.isFrame);
  $answer.value = '';
  $answer.focus();
  problemStartMs = performance.now();
  totalProblems++;

  if (problemTimer) clearTimeout(problemTimer);
  problemTimer = setTimeout(onTimeout, cfg.problemMs);

  // Barra de tiempo
  $bar.style.transition = 'none';
  $bar.style.width = '100%';
  // forzar reflow para reiniciar transition
  void $bar.offsetWidth;
  $bar.style.transition = 'width ' + cfg.problemMs + 'ms linear';
  $bar.style.width = '0%';
}

function trackType(type, kind, rtMs) {
  if (!byType[type]) byType[type] = { correct: 0, wrong: 0, timeouts: 0 };
  byType[type][kind]++;
  if (kind === 'correct' && rtMs != null) {
    if (!rtByType[type]) rtByType[type] = [];
    rtByType[type].push(Math.round(rtMs));
  }
}

function onTimeout() {
  if (state !== 'playing') return;
  timeouts++;
  if (currentProblem) trackType(currentProblem.type, 'timeouts');
  flash('bad');
  setTimeout(nextProblem, 250);
}

function onSubmit() {
  if (state !== 'playing' || !currentProblem) return;
  var raw = $answer.value.trim();
  if (raw === '') return;
  var v = parseInt(raw, 10);
  if (isNaN(v)) { flash('bad'); return; }
  var rt = performance.now() - problemStartMs;
  if (v === currentProblem.answer) {
    correct++;
    if (window.Granja && window.Granja.sound) window.Granja.sound.pio();
    reactionTimes.push(Math.round(rt));
    trackType(currentProblem.type, 'correct', rt);
    flash('ok');
  } else {
    wrong++;
    trackType(currentProblem.type, 'wrong');
    flash('bad');
  }
  if (problemTimer) clearTimeout(problemTimer);
  setTimeout(nextProblem, 220);
  updateHud();
}

function flash(kind) {
  $answer.classList.remove('flash-ok', 'flash-bad');
  void $answer.offsetWidth;
  $answer.classList.add(kind === 'ok' ? 'flash-ok' : 'flash-bad');
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
  totalProblems = 0; correct = 0; wrong = 0; timeouts = 0;
  reactionTimes.length = 0;
  byType = {}; rtByType = {};
  startMs = performance.now();
  $startOv.classList.add('hidden');
  $endOv.classList.add('hidden');
  updateHud();
  hudTimer = setInterval(updateHud, 300);
  endTimer = setTimeout(endGame, cfg.durationSec * 1000);
  nextProblem();
}

function endGame() {
  state = 'finished';
  if (problemTimer) clearTimeout(problemTimer);
  if (endTimer) clearTimeout(endTimer);
  if (hudTimer) clearInterval(hudTimer);
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
    raw: { correct: correct, wrong: wrong, timeouts: timeouts, totalProblems: totalProblems, byType: byType, rtByType: rtByType },
  };
  reportResult(metrics);
  showEnd(metrics);
}

function reportResult(m) {
  var result = { type: 'gameFinished', gameId: 'mate-rapidas', metrics: m };
  try { if (window.parent !== window) window.parent.postMessage(result, '*'); } catch (_e) {}
  try { localStorage.setItem('lastGameResult', JSON.stringify(result)); } catch (_e) {}
}

function showEnd(m) {
  var accPct = Math.round(m.accuracy * 100);
  $metricsBox.innerHTML =
    '<div class="metric"><div class="metric__value">' + correct + '</div><div class="metric__label">Aciertos</div></div>' +
    '<div class="metric"><div class="metric__value">' + accPct + '%</div><div class="metric__label">Precisión</div></div>' +
    '<div class="metric"><div class="metric__value">' + (m.avgReactionMs != null ? (m.avgReactionMs/1000).toFixed(1) + 's' : '—') + '</div><div class="metric__label">Reacción media</div></div>' +
    '<div class="metric"><div class="metric__value">' + wrong + ' / ' + timeouts + '</div><div class="metric__label">Errores / sin tiempo</div></div>';
  if (inSession) {
    var $actions = $endOv.querySelector('.overlay__actions');
    if ($actions) $actions.innerHTML = '<a class="btn btn--primary" href="../../session.html">Continuar sesión →</a>';
  }
  $endOv.classList.remove('hidden');
}

$startBtn.addEventListener('click', startGame);
$playAgain.addEventListener('click', startGame);
$answer.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') onSubmit();
});
document.addEventListener('keydown', function (e) {
  if (state === 'idle' && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    startGame();
  }
});
window.addEventListener('beforeunload', function () {
  if (problemTimer) clearTimeout(problemTimer);
  if (endTimer) clearTimeout(endTimer);
  if (hudTimer) clearInterval(hudTimer);
});
