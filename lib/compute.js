// @ts-check
/**
 * Cómputos puros sobre el estado: areaScores por día/semana, tendencias,
 * agregados para dashboards. SIN side effects, SIN tocar localStorage.
 *
 * Expone window.Granja.compute.
 * Depende de: window.Granja.registry (para mapear gameId → areas).
 */
(function () {
  'use strict';

  /** @typedef {import('./types.js').GameSession} GameSession */
  /** @typedef {import('./types.js').TherapyArea} TherapyArea */

  /** @type {TherapyArea[]} */
  var AREAS = ['fono', 'psicoped', 'psicomot', 'to', 'mate', 'lengua', 'ciencias', 'geo'];

  /**
   * @param {Date} d
   * @returns {string} YYYY-MM-DD local
   */
  function toDateKey(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  /**
   * Score 0-100 de una sesión individual, ponderando accuracy y velocidad de reacción.
   * Si el juego reporta accuracy=null (auto-rated / no medible objetivamente),
   * devuelve null — la sesión NO contribuye a area scores. Sirve para que el
   * trabalenguas (auto-rated) cuente como práctica pero no como precisión.
   * @param {GameSession} session
   * @returns {number | null}
   */
  function sessionScore(session) {
    var acc = session.metrics.accuracy;
    if (acc == null) return null;
    var rt = session.metrics.avgReactionMs;
    if (rt == null) return Math.round(acc * 100);
    // Normalizar rt: 200ms = 1.0, 1500ms = 0.0
    var rtNorm = Math.max(0, Math.min(1, (1500 - rt) / 1300));
    var score = (acc * 0.7) + (rtNorm * 0.3);
    return Math.round(score * 100);
  }

  /**
   * Areas que entrenó una sesión, según el registry.
   * @param {GameSession} session
   * @returns {TherapyArea[]}
   */
  function sessionAreas(session) {
    var registry = window.Granja && window.Granja.registry;
    if (!registry) return [];
    var game = registry.getById(session.gameId);
    return game ? game.areas : [];
  }

  /**
   * Promedio por área de un set de sesiones. Cada sesión contribuye a cada una
   * de sus áreas (juegos multi-tag suman a todas).
   * @param {GameSession[]} sessions
   * @returns {Record<TherapyArea, number | null>}
   */
  function areaScores(sessions) {
    /** @type {Record<string, {sum:number, n:number}>} */
    var acc = { fono: {sum:0,n:0}, psicoped: {sum:0,n:0}, psicomot: {sum:0,n:0}, to: {sum:0,n:0}, mate: {sum:0,n:0}, lengua: {sum:0,n:0}, ciencias: {sum:0,n:0}, geo: {sum:0,n:0} };
    sessions.forEach(function (s) {
      var score = sessionScore(s);
      if (score == null) return; // trabalenguas u otros auto-rated no aportan a score
      var areas = sessionAreas(s);
      areas.forEach(function (a) {
        acc[a].sum += score;
        acc[a].n += 1;
      });
    });
    /** @type {Record<TherapyArea, number | null>} */
    var out = { fono: null, psicoped: null, psicomot: null, to: null, mate: null, lengua: null, ciencias: null, geo: null };
    AREAS.forEach(function (a) {
      out[a] = acc[a].n > 0 ? Math.round(acc[a].sum / acc[a].n) : null;
    });
    return out;
  }

  /**
   * Resumen de un día.
   * @param {string} dateKey YYYY-MM-DD
   * @param {GameSession[]} allSessions
   * @returns {{ date: string, sessionCount: number, totalSec: number, areaScores: Record<TherapyArea, number|null>, gameIds: string[] }}
   */
  function dailySummary(dateKey, allSessions) {
    var todays = allSessions.filter(function (s) {
      return toDateKey(new Date(s.date)) === dateKey;
    });
    var totalSec = todays.reduce(function (a, s) { return a + (s.metrics.durationSec || 0); }, 0);
    return {
      date: dateKey,
      sessionCount: todays.length,
      totalSec: totalSec,
      areaScores: areaScores(todays),
      gameIds: todays.map(function (s) { return s.gameId; }),
    };
  }

  /**
   * Serie por área sobre los últimos `daysBack` días.
   * Devuelve un array de {date, scores}.
   * @param {GameSession[]} allSessions
   * @param {number} daysBack
   * @param {Date} [until]
   * @returns {Array<{date: string, scores: Record<TherapyArea, number|null>}>}
   */
  function timeSeries(allSessions, daysBack, until) {
    var endDate = until || new Date();
    /** @type {Array<{date: string, scores: Record<TherapyArea, number|null>}>} */
    var series = [];
    for (var i = daysBack - 1; i >= 0; i--) {
      var d = new Date(endDate);
      d.setDate(d.getDate() - i);
      var key = toDateKey(d);
      series.push({ date: key, scores: areaScores(allSessions.filter(function (s) {
        return toDateKey(new Date(s.date)) === key;
      })) });
    }
    return series;
  }

  /**
   * Tendencia: compara últimos N días vs los N anteriores.
   * @param {GameSession[]} allSessions
   * @param {number} window  Ej: 7 para "esta semana vs anterior"
   * @returns {Record<TherapyArea, { recent: number|null, prior: number|null, deltaPct: number|null }>}
   */
  function trend(allSessions, window) {
    var now = new Date();
    var midCut = new Date(now);
    midCut.setDate(midCut.getDate() - window);
    var earlyCut = new Date(now);
    earlyCut.setDate(earlyCut.getDate() - 2 * window);

    var recent = allSessions.filter(function (s) {
      var t = new Date(s.date).getTime();
      return t > midCut.getTime() && t <= now.getTime();
    });
    var prior = allSessions.filter(function (s) {
      var t = new Date(s.date).getTime();
      return t > earlyCut.getTime() && t <= midCut.getTime();
    });

    var rScores = areaScores(recent);
    var pScores = areaScores(prior);

    /** @type {any} */
    var out = {};
    AREAS.forEach(function (a) {
      var r = rScores[a], p = pScores[a];
      var delta = (r != null && p != null && p > 0)
        ? Math.round(((r - p) / p) * 100)
        : null;
      out[a] = { recent: r, prior: p, deltaPct: delta };
    });
    return out;
  }

  /**
   * Lista plana por juego: cuántas veces jugado, último score, último diff.
   * @param {GameSession[]} allSessions
   * @returns {Array<{ gameId: string, count: number, lastDate: string|null, lastScore: number|null, lastDifficulty: number|null }>}
   */
  function gamesSummary(allSessions) {
    /** @type {Record<string, GameSession[]>} */
    var byId = {};
    allSessions.forEach(function (s) {
      if (!byId[s.gameId]) byId[s.gameId] = [];
      byId[s.gameId].push(s);
    });
    return Object.keys(byId).map(function (id) {
      var arr = byId[id];
      arr.sort(function (a, b) { return new Date(a.date).getTime() - new Date(b.date).getTime(); });
      var last = arr[arr.length - 1];
      return {
        gameId: id,
        count: arr.length,
        lastDate: last.date,
        lastScore: sessionScore(last),
        lastDifficulty: last.difficulty,
      };
    });
  }

  /** @type {any} */
  var w = window;
  w.Granja = w.Granja || {};
  w.Granja.compute = {
    sessionScore: sessionScore,
    sessionAreas: sessionAreas,
    areaScores: areaScores,
    dailySummary: dailySummary,
    timeSeries: timeSeries,
    trend: trend,
    gamesSummary: gamesSummary,
    toDateKey: toDateKey,
  };
})();
