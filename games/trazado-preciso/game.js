// @ts-check
/** @typedef {import('../../lib/types.js').GameMetrics} GameMetrics */

/**
 * Trazado preciso: seguí una curva con el mouse sin salirte.
 *
 * Por dificultad:
 *  - tolerance: tolerancia en píxeles para considerar "dentro del camino".
 *  - curve: función paramétrica t∈[0,1] → {x, y} en coords del canvas.
 */
const W = 800, H = 380;  // tamaño nominal del canvas (escala responsiva por CSS)
const POINTS = 200;       // muestreo del trazo objetivo

const CURVES = {
  1: function (t) { return { x: 60 + t * (W - 120), y: H/2 + 24 * Math.sin(t * Math.PI * 2) }; },
  2: function (t) { return { x: 60 + t * (W - 120), y: H/2 + 80 * Math.sin(t * Math.PI * 2) }; },
  3: function (t) { return { x: 60 + t * (W - 120), y: H/2 + 110 * Math.sin(t * Math.PI * 4) }; },
  // Círculo arrancando a las 9 hs (180°) en sentido horario inverso → primer
  // movimiento descendente, no diagonal ambiguo.
  4: function (t) { var ang = Math.PI + t * Math.PI * 2; return { x: W/2 + 150 * Math.cos(ang), y: H/2 + 110 * Math.sin(ang) }; },
  // Espiral limpia (radio decreciente): predictible, exigente, sin cruces.
  // Reemplaza la Lissajous con retracción que cruzaba sobre sí misma y rompía
  // el cálculo de nearest-on-target.
  5: function (t) {
    var ang = t * Math.PI * 4;
    var rX = 160 - 90 * t;
    var rY = 120 - 70 * t;
    return { x: W/2 + rX * Math.cos(ang), y: H/2 + rY * Math.sin(ang) };
  },
};

// Tolerancias relajadas: 9px era impositivo con mouse de laptop vieja
// (jitter ±2-3 px típico). Piso 12px.
const TOLERANCE = { 1: 28, 2: 24, 3: 20, 4: 16, 5: 12 };

// Umbral para considerar que arrancó "desde A". 2.5× resultaba en muchos
// arranques fallidos en diff 5 — predictor de abandono.
const START_MULTIPLIER = 3.5;
const START_PX_FLOOR = 35;

const params = new URLSearchParams(location.search);
const rawDiff = parseInt(params.get('difficulty') || '3', 10);
const difficulty = [1,2,3,4,5].includes(rawDiff) ? rawDiff : 3;
const inSession = params.get('session') === '1';
const curveFn = CURVES[difficulty];
const tolerancePx = TOLERANCE[difficulty];

let state = 'idle'; // idle | tracing | done
let targetPoints = [];   // [{x, y, tParam}]
let drawing = false;
let lastMouse = null;
let pathStartedFromZone = false;
let distancesPx = [];
let withinSamples = 0;
let totalSamples = 0;
let maxDeviation = 0;
let maxTReached = 0;
let lastT = 0;             // último t encontrado — para búsqueda local de nearest
let overshootCount = 0;    // cantidad de veces que salió de la tolerancia
let wasWithin = true;      // estado anterior para detectar salidas
let pathLengthInside = 0;  // suma de longitud de segmentos dentro de tolerancia
let pathLengthTotal = 0;   // longitud total trazada
let startMs = 0;

const $canvasWrap = document.getElementById('canvasWrap');
const $bg = /** @type {HTMLCanvasElement} */ (document.getElementById('bg'));
const $user = /** @type {HTMLCanvasElement} */ (document.getElementById('user'));
const $bgCtx = $bg.getContext('2d');
const $userCtx = $user.getContext('2d');
const $hint = document.getElementById('hint');
const $resetBtn = document.getElementById('resetBtn');
const $finishBtn = document.getElementById('finishBtn');
const $startOv = document.getElementById('startOverlay');
const $endOv = document.getElementById('endOverlay');
const $startBtn = document.getElementById('startBtn');
const $playAgain = document.getElementById('playAgainBtn');
const $metricsBox = document.getElementById('metricsBox');

function initCanvas() {
  // Resize por device pixel ratio para nitidez
  var ratio = window.devicePixelRatio || 1;
  // Limitar el ratio para no quemar GPU vieja
  if (ratio > 1.5) ratio = 1.5;
  $bg.width = W * ratio;
  $bg.height = H * ratio;
  $user.width = W * ratio;
  $user.height = H * ratio;
  $bg.style.height = 'auto';
  $user.style.height = 'auto';
  $bgCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
  $userCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
  $canvasWrap.style.aspectRatio = (W / H).toFixed(3);
}

function buildTargetPoints() {
  targetPoints = [];
  for (var i = 0; i <= POINTS; i++) {
    var t = i / POINTS;
    var p = curveFn(t);
    targetPoints.push({ x: p.x, y: p.y, t: t });
  }
}

function drawTarget() {
  $bgCtx.clearRect(0, 0, W, H);
  // Borde de tolerancia (sombra)
  $bgCtx.strokeStyle = 'rgba(149, 180, 106, 0.20)';
  $bgCtx.lineWidth = tolerancePx * 2;
  $bgCtx.lineCap = 'round';
  $bgCtx.lineJoin = 'round';
  $bgCtx.beginPath();
  targetPoints.forEach(function (p, i) {
    if (i === 0) $bgCtx.moveTo(p.x, p.y);
    else $bgCtx.lineTo(p.x, p.y);
  });
  $bgCtx.stroke();

  // Línea central
  $bgCtx.strokeStyle = '#8A6B4F';
  $bgCtx.lineWidth = 3;
  $bgCtx.setLineDash([8, 6]);
  $bgCtx.beginPath();
  targetPoints.forEach(function (p, i) {
    if (i === 0) $bgCtx.moveTo(p.x, p.y);
    else $bgCtx.lineTo(p.x, p.y);
  });
  $bgCtx.stroke();
  $bgCtx.setLineDash([]);

  // Punto de inicio (verde)
  $bgCtx.fillStyle = '#6C8B4A';
  $bgCtx.beginPath();
  $bgCtx.arc(targetPoints[0].x, targetPoints[0].y, 10, 0, Math.PI * 2);
  $bgCtx.fill();
  $bgCtx.fillStyle = '#FFFFFF';
  $bgCtx.font = 'bold 12px system-ui';
  $bgCtx.textAlign = 'center';
  $bgCtx.textBaseline = 'middle';
  $bgCtx.fillText('A', targetPoints[0].x, targetPoints[0].y);

  // Punto final (terracota)
  var last = targetPoints[targetPoints.length - 1];
  $bgCtx.fillStyle = '#D97757';
  $bgCtx.beginPath();
  $bgCtx.arc(last.x, last.y, 10, 0, Math.PI * 2);
  $bgCtx.fill();
  $bgCtx.fillStyle = '#FFFFFF';
  $bgCtx.fillText('B', last.x, last.y);
}

function clearUser() {
  $userCtx.clearRect(0, 0, W, H);
  distancesPx = [];
  withinSamples = 0;
  totalSamples = 0;
  maxDeviation = 0;
  maxTReached = 0;
  lastT = 0;
  overshootCount = 0;
  wasWithin = true;
  pathLengthInside = 0;
  pathLengthTotal = 0;
  lastMouse = null;
  drawing = false;
  pathStartedFromZone = false;
}

/**
 * Encuentra el punto del trazo objetivo más cercano a (x, y). Búsqueda LOCAL:
 * sólo considera puntos cuyo t esté en [lastT, lastT + 0.15] para que t sea
 * monótono no decreciente. Si Sofi corta por fuera y un punto del final queda
 * geométricamente más cerca, no salta hacia él.
 *
 * @param {number} x
 * @param {number} y
 * @param {boolean} forceGlobal usar búsqueda global (sólo al arrancar)
 */
function nearestOnTarget(x, y, forceGlobal) {
  var minD = Infinity;
  var minT = lastT;
  var startIdx, endIdx;
  if (forceGlobal) {
    startIdx = 0;
    endIdx = targetPoints.length;
  } else {
    startIdx = Math.floor(lastT * targetPoints.length);
    var window = 0.15;
    endIdx = Math.min(targetPoints.length, Math.ceil((lastT + window) * targetPoints.length));
  }
  for (var i = startIdx; i < endIdx; i++) {
    var dx = targetPoints[i].x - x;
    var dy = targetPoints[i].y - y;
    var d = Math.sqrt(dx*dx + dy*dy);
    if (d < minD) { minD = d; minT = targetPoints[i].t; }
  }
  return { distance: minD, t: minT };
}

function clientToCanvas(e) {
  var rect = $user.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (W / rect.width),
    y: (e.clientY - rect.top) * (H / rect.height),
  };
}

function onDown(e) {
  if (state === 'done') return;
  e.preventDefault();
  var p = clientToCanvas(e);
  // Si arranca lejos del punto A, no iniciar trazo. Umbral más generoso.
  var startThreshold = Math.max(START_PX_FLOOR, tolerancePx * START_MULTIPLIER);
  var startDist = Math.sqrt(Math.pow(p.x - targetPoints[0].x, 2) + Math.pow(p.y - targetPoints[0].y, 2));
  if (startDist > startThreshold) {
    $hint.textContent = 'Empezá desde el punto verde "A".';
    return;
  }
  drawing = true;
  pathStartedFromZone = true;
  lastMouse = p;
  lastT = 0;
  startMs = performance.now();
  state = 'tracing';
  $hint.textContent = 'Seguí la línea hasta el punto B.';
}

function onMove(e) {
  if (!drawing) return;
  var p = clientToCanvas(e);
  // Búsqueda LOCAL para que t sea monótono (no saltar a otra rama de la curva)
  var near = nearestOnTarget(p.x, p.y, false);
  distancesPx.push(near.distance);
  totalSamples++;
  var inside = near.distance <= tolerancePx;
  if (inside) withinSamples++;
  if (near.distance > maxDeviation) maxDeviation = near.distance;
  if (near.t > maxTReached) maxTReached = near.t;
  lastT = near.t;

  // Contar overshoots: transiciones de dentro→fuera
  if (wasWithin && !inside) overshootCount++;
  wasWithin = inside;

  // Longitud de segmento — para pathAccuracyPct
  var segLen = Math.sqrt(Math.pow(p.x - lastMouse.x, 2) + Math.pow(p.y - lastMouse.y, 2));
  pathLengthTotal += segLen;
  if (inside) pathLengthInside += segLen;

  $userCtx.strokeStyle = inside ? '#6C8B4A' : '#D97757';
  $userCtx.lineWidth = 4;
  $userCtx.lineCap = 'round';
  $userCtx.beginPath();
  $userCtx.moveTo(lastMouse.x, lastMouse.y);
  $userCtx.lineTo(p.x, p.y);
  $userCtx.stroke();
  lastMouse = p;
}

function onUp() {
  if (!drawing) return;
  drawing = false;
  // Verificar si llegó cerca del final
  if (maxTReached >= 0.92) {
    $hint.textContent = 'Llegaste. Tocá "Listo" para terminar, o "Borrar y volver a empezar" para repetir.';
  } else {
    $hint.textContent = 'Te quedó cerca. Si querés probar de nuevo, tocá borrar.';
  }
  $finishBtn.disabled = false;
}

function resetTrace() {
  clearUser();
  state = 'idle';
  $hint.textContent = 'Empezá desde el punto verde "A" y seguí la línea hasta "B".';
  $finishBtn.disabled = true;
}

function finishGame() {
  state = 'done';
  // Accuracy basada en TRAYECTORIA (no en tiempo): % de la longitud trazada
  // que estuvo dentro de la tolerancia. Más justa que la versión temporal,
  // que castiga velocidad cuando la trayectoria es correcta.
  var pathAccuracy = pathLengthTotal > 0 ? pathLengthInside / pathLengthTotal : 0;
  var timeWithin = totalSamples > 0 ? withinSamples / totalSamples : 0;
  var avgDev = distancesPx.length > 0
    ? Math.round(distancesPx.reduce(function (a,b) { return a+b; }, 0) / distancesPx.length)
    : 0;
  var durationSec = startMs > 0 ? Math.round((performance.now() - startMs) / 1000) : 0;

  /** @type {GameMetrics} */
  var metrics = {
    accuracy: pathAccuracy,
    avgReactionMs: null,
    errors: { omission: 0, commission: 0 },
    level: difficulty,
    durationSec: durationSec,
    raw: {
      pathAccuracyPct: Math.round(pathAccuracy * 100),
      timeWithinPct: Math.round(timeWithin * 100),
      avgDeviationPx: avgDev,
      maxDeviationPx: Math.round(maxDeviation),
      tolerancePx: tolerancePx,
      completionPct: Math.round(maxTReached * 100),
      overshootCount: overshootCount,
      samples: totalSamples,
    },
  };
  reportResult(metrics);
  showEnd(metrics);
}

function reportResult(m) {
  var result = { type: 'gameFinished', gameId: 'trazado-preciso', metrics: m };
  try { if (window.parent !== window) window.parent.postMessage(result, '*'); } catch (_e) {}
  try { localStorage.setItem('lastGameResult', JSON.stringify(result)); } catch (_e) {}
}

function showEnd(m) {
  var accPct = Math.round(m.accuracy * 100);
  $metricsBox.innerHTML =
    '<div class="metric"><div class="metric__value">' + accPct + '%</div><div class="metric__label">Trayectoria dentro del camino</div></div>' +
    '<div class="metric"><div class="metric__value">' + m.raw.completionPct + '%</div><div class="metric__label">Recorrido completado</div></div>' +
    '<div class="metric"><div class="metric__value">' + m.raw.avgDeviationPx + 'px</div><div class="metric__label">Desvío promedio</div></div>' +
    '<div class="metric"><div class="metric__value">' + m.raw.overshootCount + '</div><div class="metric__label">Salidas del camino</div></div>';
  if (inSession) {
    var $actions = $endOv.querySelector('.overlay__actions');
    if ($actions) $actions.innerHTML = '<a class="btn btn--primary" href="../../session.html">Continuar sesión →</a>';
  }
  $endOv.classList.remove('hidden');
}

function startGame() {
  $startOv.classList.add('hidden');
  resetTrace();
  initCanvas();
  buildTargetPoints();
  drawTarget();
}

$startBtn.addEventListener('click', startGame);
$playAgain.addEventListener('click', function () {
  $endOv.classList.add('hidden');
  startGame();
});
$resetBtn.addEventListener('click', resetTrace);
$finishBtn.addEventListener('click', finishGame);

// Mouse / touch events sobre el canvas user (pointer-events: none) — agregamos a wrap
$canvasWrap.addEventListener('mousedown', onDown);
window.addEventListener('mousemove', onMove);
window.addEventListener('mouseup', onUp);
// Soporte touch básico
$canvasWrap.addEventListener('touchstart', function (e) { if (e.touches[0]) onDown(e.touches[0]); }, { passive: false });
window.addEventListener('touchmove', function (e) { if (drawing && e.touches[0]) { onMove(e.touches[0]); e.preventDefault(); } }, { passive: false });
window.addEventListener('touchend', onUp);

window.addEventListener('resize', function () {
  if (state !== 'idle' && targetPoints.length === 0) return;
  initCanvas();
  if (targetPoints.length > 0) drawTarget();
});
