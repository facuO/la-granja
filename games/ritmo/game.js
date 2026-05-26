// @ts-check
/** @typedef {import('../../lib/types.js').GameMetrics} GameMetrics */

/**
 * Tempo y patrón por dificultad.
 *  - bpm: pulsaciones por minuto
 *  - beats: cantidad total de notas
 *  - fallMs: cuánto tarda una nota desde que aparece hasta la zona de hit
 *  - hitWindowMs: tolerancia temporal (±) considerada hit
 *  - patternKind: 'alt' (alterna) | 'mix' (mezcla) | 'chord' (con dobles simultáneas)
 */
// Diff 5 suavizado tras feedback: 130 BPM + ventana 180ms + 15% chord es injusto.
// La sincronía bimanual estricta <50ms no es esperable a 10-12 sin entrenamiento.
const CONFIGS = {
  1: { bpm: 60,  beats: 18, fallMs: 2800, hitWindowMs: 280, patternKind: 'alt',  chordRate: 0    },
  2: { bpm: 75,  beats: 22, fallMs: 2500, hitWindowMs: 250, patternKind: 'alt',  chordRate: 0    },
  3: { bpm: 90,  beats: 28, fallMs: 2200, hitWindowMs: 220, patternKind: 'mix',  chordRate: 0    },
  4: { bpm: 110, beats: 32, fallMs: 1900, hitWindowMs: 210, patternKind: 'mix',  chordRate: 0    },
  5: { bpm: 118, beats: 36, fallMs: 1750, hitWindowMs: 200, patternKind: 'chord', chordRate: 0.10 },
};

// Doble-tecleo en mismo lane dentro de esta ventana = perseveración (commission).
const DOUBLE_PRESS_MS = 150;

const params = new URLSearchParams(location.search);
const rawDiff = parseInt(params.get('difficulty') || '3', 10);
const difficulty = [1,2,3,4,5].includes(rawDiff) ? rawDiff : 3;
const cfg = CONFIGS[difficulty];
const inSession = params.get('session') === '1';

let state = 'idle';
let notes = [];        // { id, lane, hitTime, el, resolved, spawnedAt }
let nextNoteId = 0;
let startMs = 0;
let hits = 0;
let misses = 0;
let extraPresses = 0;  // tecla sin nota cerca
let doublePresses = 0; // doble tecleo en mismo lane <150ms (perseveración)
let lastPressByLane = { L: -Infinity, R: -Infinity };
let timingErrorsMs = []; // |hit time - press time| sobre hits
let spawnIdx = 0;
let schedule = [];     // array de { lane: 'L' | 'R', hitTime: ms relative to start }
let spawnTimer = null;
let endTimer = null;
let hudTimer = null;

const $laneL = document.getElementById('laneL');
const $laneR = document.getElementById('laneR');
const $keyLeft = document.getElementById('keyLeft');
const $keyRight = document.getElementById('keyRight');
const $hits = document.getElementById('hits');
const $time = document.getElementById('time');
const $startOv = document.getElementById('startOverlay');
const $endOv = document.getElementById('endOverlay');
const $startBtn = document.getElementById('startBtn');
const $playAgain = document.getElementById('playAgainBtn');
const $metricsBox = document.getElementById('metricsBox');

function genSchedule() {
  var beatMs = 60000 / cfg.bpm;
  /** @type {Array<{lane: 'L'|'R', hitTime: number}>} */
  var s = [];
  // Comenzar con 2 beats de "lead-in" silencioso para que aparezca la primera nota
  var leadIn = beatMs * 2;
  for (var i = 0; i < cfg.beats; i++) {
    var t = leadIn + i * beatMs;
    if (cfg.patternKind === 'alt') {
      s.push({ lane: i % 2 === 0 ? 'L' : 'R', hitTime: t });
    } else if (cfg.patternKind === 'mix') {
      // Mezcla: 70% alterna, 30% random
      var lane;
      if (Math.random() < 0.30) lane = Math.random() < 0.5 ? 'L' : 'R';
      else lane = i % 2 === 0 ? 'L' : 'R';
      s.push({ lane: lane, hitTime: t });
    } else { // chord (chordRate determina probabilidad)
      var r = Math.random();
      if (r < cfg.chordRate && i > 0) {
        s.push({ lane: 'L', hitTime: t });
        s.push({ lane: 'R', hitTime: t });
      } else {
        s.push({ lane: i % 2 === 0 ? 'L' : 'R', hitTime: t });
      }
    }
  }
  return s;
}

function spawnNote(plan) {
  if (state !== 'playing') return;
  var lane = plan.lane === 'L' ? $laneL : $laneR;
  var img = document.createElement('img');
  img.className = 'note';
  img.src = '../../shared/sprites/pollito.png';
  img.alt = '';

  var rect = lane.getBoundingClientRect();
  // La nota tiene que llegar a la zona de hit (88px desde el bottom + 35px = centro hit zone)
  var hitZoneCenterFromTop = rect.height - 88 - 35;
  var noteSize = 56;
  var endY = hitZoneCenterFromTop - noteSize / 2;
  img.style.setProperty('--end-y', endY + 'px');
  img.style.animationName = 'noteFall';
  img.style.animationDuration = cfg.fallMs + 'ms';
  lane.appendChild(img);

  var note = {
    id: ++nextNoteId,
    lane: plan.lane,
    hitTime: plan.hitTime,
    el: img,
    resolved: false,
    spawnedAt: performance.now() - startMs,
  };
  notes.push(note);

  // Cleanup: si pasa la nota sin hit, removerla y contarla como miss
  img.addEventListener('animationend', function () {
    if (note.resolved) return;
    note.resolved = true;
    misses++;
    showFloat(img, 'fail', 'X');
    setTimeout(function () { if (img.parentNode) img.parentNode.removeChild(img); }, 200);
    notes = notes.filter(function (x) { return x.id !== note.id; });
    updateHud();
  });
}

function scheduleSpawning() {
  if (state !== 'playing') return;
  // Mirar próximo en schedule. Si llegó el momento de spawnear (hitTime - fallMs), spawnear.
  var elapsed = performance.now() - startMs;
  while (spawnIdx < schedule.length && schedule[spawnIdx].hitTime - cfg.fallMs <= elapsed) {
    spawnNote(schedule[spawnIdx]);
    spawnIdx++;
  }
  // Reprogramar
  if (spawnIdx < schedule.length) {
    var next = schedule[spawnIdx].hitTime - cfg.fallMs;
    var delta = Math.max(10, next - elapsed);
    spawnTimer = setTimeout(scheduleSpawning, delta);
  } else {
    // Todas las notas spawneadas — esperar a que termine la última
    var endIn = schedule[schedule.length - 1].hitTime + cfg.hitWindowMs + 500 - elapsed;
    endTimer = setTimeout(endGame, Math.max(500, endIn));
  }
}

function onKey(e) {
  if (state !== 'playing') return;
  var k = e.key.toUpperCase();
  if (k !== 'F' && k !== 'J') return;
  var lane = k === 'F' ? 'L' : 'R';
  var $kc = k === 'F' ? $keyLeft : $keyRight;
  $kc.classList.add('flash');
  setTimeout(function () { $kc.classList.remove('flash'); }, 90);

  var now = performance.now();
  // Detección de doble-tecleo en el mismo lane (perseveración motora)
  if (now - lastPressByLane[lane] < DOUBLE_PRESS_MS) {
    doublePresses++;
  }
  lastPressByLane[lane] = now;

  var elapsed = now - startMs;
  var best = null;
  var bestDiff = Infinity;
  notes.forEach(function (n) {
    if (n.resolved || n.lane !== lane) return;
    var d = Math.abs(n.hitTime - elapsed);
    if (d < bestDiff) { bestDiff = d; best = n; }
  });

  if (best && bestDiff <= cfg.hitWindowMs) {
    // HIT
    best.resolved = true;
    hits++;
    if (window.Granja && window.Granja.sound) window.Granja.sound.pio();
    timingErrorsMs.push(Math.round(bestDiff));
    best.el.classList.add('hit');
    // calcular hit-y (donde está la nota ahora) para la animación
    var hitY = parseFloat(getComputedStyle(best.el).getPropertyValue('--end-y')) || 500;
    best.el.style.setProperty('--hit-y', hitY + 'px');
    showFloat(best.el, 'ok', 'OK');
    setTimeout(function () { if (best.el.parentNode) best.el.parentNode.removeChild(best.el); }, 200);
    notes = notes.filter(function (x) { return x.id !== best.id; });
  } else {
    // tecla apretada sin nota en ventana — extra press
    extraPresses++;
  }
  updateHud();
}

function showFloat(noteEl, kind, text) {
  var lane = noteEl.parentElement;
  if (!lane) return;
  var fb = document.createElement('div');
  fb.className = 'flash-fb ' + (kind === 'ok' ? 'ok' : 'bad');
  fb.textContent = text;
  fb.style.left = '50%';
  fb.style.transform = 'translateX(-50%)';
  fb.style.bottom = '170px';
  lane.appendChild(fb);
  setTimeout(function () { if (fb.parentNode) fb.parentNode.removeChild(fb); }, 600);
}

function updateHud() {
  $hits.textContent = String(hits);
  if (state === 'playing') {
    var elapsed = (performance.now() - startMs) / 1000;
    var total = schedule.length > 0
      ? (schedule[schedule.length - 1].hitTime + cfg.hitWindowMs) / 1000
      : 30;
    var left = Math.max(0, Math.round(total - elapsed));
    $time.textContent = left + 's';
  }
}

function startGame() {
  state = 'playing';
  hits = misses = extraPresses = doublePresses = 0;
  lastPressByLane = { L: -Infinity, R: -Infinity };
  timingErrorsMs.length = 0;
  notes = [];
  spawnIdx = 0;
  schedule = genSchedule();
  startMs = performance.now();
  $startOv.classList.add('hidden');
  $endOv.classList.add('hidden');
  document.addEventListener('keydown', onKey);
  hudTimer = setInterval(updateHud, 300);
  scheduleSpawning();
}

function endGame() {
  state = 'finished';
  if (spawnTimer) clearTimeout(spawnTimer);
  if (endTimer) clearTimeout(endTimer);
  if (hudTimer) clearInterval(hudTimer);
  document.removeEventListener('keydown', onKey);
  notes.forEach(function (n) { if (n.el.parentNode) n.el.parentNode.removeChild(n.el); });
  notes = [];

  var total = schedule.length;
  var accuracy = total > 0 ? hits / total : 0;
  var avgTimingErr = timingErrorsMs.length > 0
    ? Math.round(timingErrorsMs.reduce(function (a,b) { return a+b; }, 0) / timingErrorsMs.length)
    : null;
  var durationSec = Math.round((schedule[schedule.length-1].hitTime + cfg.hitWindowMs) / 1000);

  /** @type {GameMetrics} */
  var metrics = {
    accuracy: accuracy,
    avgReactionMs: avgTimingErr, // en ritmo, "reaction" = error temporal absoluto
    // Commission = tecleos al aire + perseveración por doble-tecleo en mismo lane
    errors: { omission: misses, commission: extraPresses + doublePresses },
    level: difficulty,
    durationSec: durationSec,
    raw: {
      hits: hits, misses: misses,
      extraPresses: extraPresses,
      doublePresses: doublePresses,
      noteCount: total,
      bpm: cfg.bpm,
      hitWindowMs: cfg.hitWindowMs,
      pattern: cfg.patternKind,
      chordRate: cfg.chordRate,
    },
  };
  reportResult(metrics);
  showEnd(metrics);
}

function reportResult(m) {
  var result = { type: 'gameFinished', gameId: 'ritmo', metrics: m };
  try { if (window.parent !== window) window.parent.postMessage(result, '*'); } catch (_e) {}
  try { localStorage.setItem('lastGameResult', JSON.stringify(result)); } catch (_e) {}
}

function showEnd(m) {
  var accPct = Math.round(m.accuracy * 100);
  $metricsBox.innerHTML =
    '<div class="metric"><div class="metric__value">' + hits + ' / ' + schedule.length + '</div><div class="metric__label">Notas atrapadas</div></div>' +
    '<div class="metric"><div class="metric__value">' + accPct + '%</div><div class="metric__label">Precisión</div></div>' +
    '<div class="metric"><div class="metric__value">' + (m.avgReactionMs != null ? m.avgReactionMs + ' ms' : '—') + '</div><div class="metric__label">Error temporal medio</div></div>' +
    '<div class="metric"><div class="metric__value">' + extraPresses + '</div><div class="metric__label">Tecleos al aire</div></div>';
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
  if (spawnTimer) clearTimeout(spawnTimer);
  if (endTimer) clearTimeout(endTimer);
  if (hudTimer) clearInterval(hudTimer);
});
