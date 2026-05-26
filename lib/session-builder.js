// @ts-check
/**
 * Selector de la sesión del día: 4 juegos del catálogo siguiendo reglas:
 * - 1 por área (rotando entre las disponibles)
 * - No repetir si es posible un juego de ayer
 * - Dificultad sugerida basada en últimas 3 sesiones (mediana ajustada por accuracy)
 *
 * Expone window.Granja.builder.
 * Depende de: window.Granja.registry, window.Granja.store.
 */
(function () {
  'use strict';

  /** @typedef {import('./types.js').AppState} AppState */
  /** @typedef {import('./types.js').GameModule} GameModule */
  /** @typedef {import('./types.js').TherapyArea} TherapyArea */
  /** @typedef {import('./types.js').GameSession} GameSession */

  /** @type {TherapyArea[]} */
  var AREAS = ['fono', 'psicoped', 'psicomot', 'to', 'mate', 'lengua', 'ciencias', 'geo'];

  // Una sesión diaria son 4 juegos. Con 8 áreas, se rotan: las áreas que
  // se jugaron ayer pasan al final de la lista de prioridad.
  var GAMES_PER_SESSION = 4;

  // Juegos que usan micrófono y producción vocal continua — el fono validator
  // marcó que juntar 3 en una sesión satura atencional/vocalmente.
  var VOICE_GAMES = ['trabalenguas', 'palabras-al-vuelo', 'categorias'];
  var MAX_VOICE_PER_SESSION = 2;

  /**
   * @typedef {object} PlannedGame
   * @property {GameModule} game
   * @property {1|2|3|4|5} difficulty
   */

  /**
   * @param {AppState} state
   * @param {string} gameId
   * @returns {number} timestamp de la última sesión de ese juego (0 si nunca)
   */
  function lastPlayedTs(state, gameId) {
    for (var i = state.sessions.length - 1; i >= 0; i--) {
      if (state.sessions[i].gameId === gameId) {
        return new Date(state.sessions[i].date).getTime();
      }
    }
    return 0;
  }

  /**
   * Dificultad sugerida para un juego, en base a sus últimas 3 sesiones.
   * Mediana ajustada: si accuracy promedio < 0.5 → -1; si > 0.85 → +1.
   * Si nunca se jugó, devuelve el default del registry.
   *
   * @param {AppState} state
   * @param {GameModule} game
   * @returns {1|2|3|4|5}
   */
  function suggestedDifficulty(state, game) {
    var recent = [];
    for (var i = state.sessions.length - 1; i >= 0 && recent.length < 3; i--) {
      if (state.sessions[i].gameId === game.id) recent.push(state.sessions[i]);
    }
    if (recent.length === 0) return game.difficulty;

    var diffs = recent.map(function (s) { return s.difficulty; }).sort(function (a, b) { return a - b; });
    var median = diffs[Math.floor(diffs.length / 2)];

    var avgAcc = recent.reduce(function (a, s) { return a + (s.metrics.accuracy || 0); }, 0) / recent.length;

    var adj = median;
    if (avgAcc < 0.5) adj = median - 1;
    else if (avgAcc > 0.85) adj = median + 1;
    if (adj < 1) adj = 1;
    if (adj > 5) adj = 5;
    return /** @type {1|2|3|4|5} */ (adj);
  }

  /**
   * Arma la sesión del día. Con 6 áreas y 4 juegos por sesión, rota las áreas
   * priorizando las que NO se trabajaron ayer.
   * @param {Date} [today]
   * @returns {PlannedGame[]}
   */
  function buildDailySession(today) {
    var registry = window.Granja.registry;
    var store = window.Granja.store;
    var state = store.getState();
    var now = today || new Date();

    // IDs y áreas jugadas ayer (para rotar)
    var yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    var yesterdayKey = store.toDateKey(yesterday);
    var yesterdaySessions = state.sessions.filter(function (s) {
      return store.toDateKey(new Date(s.date)) === yesterdayKey;
    });
    var yesterdayIds = yesterdaySessions.map(function (s) { return s.gameId; });
    /** @type {Set<string>} */
    var yesterdayAreas = new Set();
    yesterdaySessions.forEach(function (s) {
      var g = registry.getById(s.gameId);
      if (g) g.areas.forEach(function (a) { yesterdayAreas.add(a); });
    });

    // Ordenar áreas: las que NO se jugaron ayer van primero
    var orderedAreas = AREAS.slice().sort(function (a, b) {
      var aPlayed = yesterdayAreas.has(a) ? 1 : 0;
      var bPlayed = yesterdayAreas.has(b) ? 1 : 0;
      return aPlayed - bPlayed;
    });

    /** @type {PlannedGame[]} */
    var picks = [];
    /** @type {Set<string>} */
    var alreadyPicked = new Set();

    orderedAreas.forEach(function (area) {
      if (picks.length >= GAMES_PER_SESSION) return;
      var pool = registry.getByArea(area).filter(function (g) { return !alreadyPicked.has(g.id); });
      if (pool.length === 0) return;

      var fresh = pool.filter(function (g) { return yesterdayIds.indexOf(g.id) < 0; });
      var candidates = fresh.length > 0 ? fresh : pool;

      candidates.sort(function (a, b) {
        return lastPlayedTs(state, a.id) - lastPlayedTs(state, b.id);
      });

      var chosen = candidates[0];
      picks.push({ game: chosen, difficulty: suggestedDifficulty(state, chosen) });
      alreadyPicked.add(chosen.id);
    });

    // Fallback si quedaron <4 (áreas con pool agotado)
    if (picks.length < GAMES_PER_SESSION) {
      var remaining = registry.games.filter(function (g) { return !alreadyPicked.has(g.id); });
      remaining.sort(function (a, b) {
        return lastPlayedTs(state, a.id) - lastPlayedTs(state, b.id);
      });
      while (picks.length < GAMES_PER_SESSION && remaining.length > 0) {
        var g = remaining.shift();
        picks.push({ game: g, difficulty: suggestedDifficulty(state, g) });
        alreadyPicked.add(g.id);
      }
    }

    // Guard fonoaudiológico: no más de 2 juegos de voz por sesión.
    var voiceCount = picks.filter(function (p) { return VOICE_GAMES.indexOf(p.game.id) >= 0; }).length;
    while (voiceCount > MAX_VOICE_PER_SESSION) {
      // Reemplazar el último voice pick por un no-voice no-jugado.
      var lastVoiceIdx = -1;
      for (var i = picks.length - 1; i >= 0; i--) {
        if (VOICE_GAMES.indexOf(picks[i].game.id) >= 0) { lastVoiceIdx = i; break; }
      }
      if (lastVoiceIdx < 0) break;
      var replaceCandidates = registry.games.filter(function (g) {
        return !alreadyPicked.has(g.id) && VOICE_GAMES.indexOf(g.id) < 0;
      });
      if (replaceCandidates.length === 0) break;
      replaceCandidates.sort(function (a, b) {
        return lastPlayedTs(state, a.id) - lastPlayedTs(state, b.id);
      });
      var newGame = replaceCandidates[0];
      alreadyPicked.delete(picks[lastVoiceIdx].game.id);
      picks[lastVoiceIdx] = { game: newGame, difficulty: suggestedDifficulty(state, newGame) };
      alreadyPicked.add(newGame.id);
      voiceCount--;
    }

    return picks;
  }

  /** @type {any} */
  var w = window;
  w.Granja = w.Granja || {};
  w.Granja.builder = {
    buildDailySession: buildDailySession,
    suggestedDifficulty: suggestedDifficulty,
  };
})();
