// @ts-check
/* eslint-disable no-var */
/**
 * Store de "La granja de Sofi".
 * Persistencia: localStorage. Esquema versionado para migrar a Supabase en Phase 3.
 *
 * Uso desde HTML (shell):
 *   <script src="lib/store.js"></script>
 *   <script>
 *     const state = Granja.store.getState();
 *     Granja.store.consumeLastGameResult();
 *   </script>
 *
 * Los juegos (games/<id>/index.html) NO cargan este archivo: escriben directo a
 * localStorage.lastGameResult y el shell lo ingiere al volver al home.
 */

(function () {
  'use strict';

  /** @typedef {import('./types.js').AppState} AppState */
  /** @typedef {import('./types.js').GameSession} GameSession */
  /** @typedef {import('./types.js').GameMetrics} GameMetrics */
  /** @typedef {import('./types.js').CorralState} CorralState */
  /** @typedef {import('./types.js').GameFinishedMessage} GameFinishedMessage */

  var STORAGE_KEY    = 'granja-state-v1';
  var LAST_RESULT_KEY = 'lastGameResult';
  var SCHEMA_VERSION = 1;

  /** @type {Array<(state: AppState) => void>} */
  var listeners = [];

  /** @returns {AppState} */
  function defaultState() {
    return {
      schemaVersion: 1,
      sessions: [],
      dailySummaries: [],
      corral: {
        eggs: 0,
        pollitos: [],
        streak: 0,
        longestStreak: 0,
        lastSessionDate: null,
      },
      settings: { soundEnabled: true, musicEnabled: false },
    };
  }

  /**
   * Migra estado de una versión anterior a la actual.
   * Por ahora no-op (v1 es la inicial), pero deja el hook listo para futuras.
   * @param {any} oldState
   * @param {number} _fromVersion
   * @returns {AppState}
   */
  function migrate(oldState, _fromVersion) {
    var base = defaultState();
    return Object.assign({}, base, oldState, { schemaVersion: SCHEMA_VERSION });
  }

  /** @returns {AppState} */
  function getState() {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    try {
      var parsed = JSON.parse(raw);
      if (parsed.schemaVersion !== SCHEMA_VERSION) {
        var migrated = migrate(parsed, parsed.schemaVersion || 0);
        saveState(migrated, false);
        return migrated;
      }
      return parsed;
    } catch (_e) {
      // localStorage corrupto: reseteo a default (no destructivo para usuario nuevo)
      return defaultState();
    }
  }

  /**
   * @param {AppState} state
   * @param {boolean} [emit=true]
   */
  function saveState(state, emit) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_e) { /* storage lleno */ }
    if (emit !== false) {
      for (var i = 0; i < listeners.length; i++) {
        try { listeners[i](state); } catch (_e) {}
      }
    }
  }

  /**
   * @param {Date} d
   * @returns {string} YYYY-MM-DD en hora local
   */
  function toDateKey(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  /**
   * Diferencia en días entre dos date-keys (YYYY-MM-DD), interpretadas como hora local.
   * @param {string} fromKey
   * @param {string} toKey
   * @returns {number}
   */
  function daysBetween(fromKey, toKey) {
    var a = new Date(fromKey + 'T00:00:00');
    var b = new Date(toKey + 'T00:00:00');
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  }

  /**
   * Actualiza streak en función del último día con sesión.
   * @param {CorralState} corral
   * @param {string} todayKey
   */
  function updateStreak(corral, todayKey) {
    if (corral.lastSessionDate === null) {
      corral.streak = 1;
      corral.lastSessionDate = todayKey;
      corral.longestStreak = Math.max(corral.longestStreak, 1);
      return;
    }
    if (corral.lastSessionDate === todayKey) return; // ya contado hoy
    var gap = daysBetween(corral.lastSessionDate, todayKey);
    if (gap === 1) {
      corral.streak += 1;
    } else if (gap > 1) {
      corral.streak = 1; // racha rota; la gallina "se va a dormir"
    } else {
      // gap negativo (reloj cambiado, etc.) — no tocamos
    }
    corral.lastSessionDate = todayKey;
    corral.longestStreak = Math.max(corral.longestStreak, corral.streak);
  }

  /**
   * Registra una sesión jugada.
   * @param {string} gameId
   * @param {1|2|3|4|5} difficulty
   * @param {GameMetrics} metrics
   * @returns {GameSession}
   */
  function addSession(gameId, difficulty, metrics) {
    var state = getState();
    var now = new Date();
    var id = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'sess_' + now.getTime() + '_' + Math.random().toString(36).slice(2, 8);

    /** @type {GameSession} */
    var session = {
      id: id,
      date: now.toISOString(),
      gameId: gameId,
      difficulty: difficulty,
      metrics: metrics,
    };
    state.sessions.push(session);

    var todayKey = toDateKey(now);
    updateStreak(state.corral, todayKey);

    saveState(state);
    return session;
  }

  /**
   * Lee `lastGameResult` (escrito por un juego standalone), lo ingiere como sesión
   * y limpia la key. Retorna el resultado consumido para que la UI lo use (toast, etc.)
   * o `null` si no había nada.
   * @returns {GameFinishedMessage | null}
   */
  function consumeLastGameResult() {
    var raw = localStorage.getItem(LAST_RESULT_KEY);
    if (!raw) return null;
    /** @type {GameFinishedMessage | null} */
    var parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (_e) {
      localStorage.removeItem(LAST_RESULT_KEY);
      return null;
    }
    if (!parsed || parsed.type !== 'gameFinished' || !parsed.gameId || !parsed.metrics) {
      localStorage.removeItem(LAST_RESULT_KEY);
      return null;
    }
    var diff = parsed.metrics.level || 3;
    addSession(parsed.gameId, /** @type {1|2|3|4|5} */ (diff), parsed.metrics);
    localStorage.removeItem(LAST_RESULT_KEY);
    return parsed;
  }

  /**
   * Sesiones jugadas en un día (default: hoy).
   * @param {Date} [date]
   * @returns {GameSession[]}
   */
  function getSessionsForDate(date) {
    var d = date || new Date();
    var key = toDateKey(d);
    return getState().sessions.filter(function (s) {
      return toDateKey(new Date(s.date)) === key;
    });
  }

  /**
   * Últimas N sesiones de un juego (para sugerir dificultad).
   * @param {string} gameId
   * @param {number} n
   * @returns {GameSession[]}
   */
  function getRecentSessionsForGame(gameId, n) {
    var sessions = getState().sessions;
    var filtered = [];
    for (var i = sessions.length - 1; i >= 0 && filtered.length < n; i--) {
      if (sessions[i].gameId === gameId) filtered.push(sessions[i]);
    }
    return filtered;
  }

  /**
   * Suscribirse a cambios del estado (mismo tab). Para sincronizar entre tabs,
   * escuchar también `window.addEventListener('storage', ...)`.
   * @param {(state: AppState) => void} fn
   * @returns {() => void} unsubscribe
   */
  function subscribe(fn) {
    listeners.push(fn);
    return function () {
      var idx = listeners.indexOf(fn);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }

  /** Borra todo el estado. Para debug/reset. */
  function reset() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LAST_RESULT_KEY);
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](defaultState()); } catch (_e) {}
    }
  }

  /* ───────── Lógica del corral ───────── */

  var POLLITO_NAMES = [
    'Pelusa', 'Manchita', 'Pico', 'Plumita', 'Nube',
    'Solcito', 'Lunita', 'Capitán', 'Rayitos', 'Maíz',
    'Maní', 'Toto', 'Tito', 'Estrella', 'Canela',
    'Galleta', 'Naranja', 'Cielo', 'Coqueta', 'Trotón',
  ];

  /** @type {Array<'amarillo'|'marron'|'blanco'|'negro'>} */
  var POLLITO_COLORS = ['amarillo', 'marron', 'blanco', 'negro'];

  /**
   * Elige un nombre que no esté en uso. Si todos están tomados, agrega sufijo numérico.
   * @param {string[]} taken
   * @returns {string}
   */
  function pickName(taken) {
    var available = POLLITO_NAMES.filter(function (n) { return taken.indexOf(n) < 0; });
    if (available.length > 0) {
      return available[Math.floor(Math.random() * available.length)];
    }
    var base = POLLITO_NAMES[Math.floor(Math.random() * POLLITO_NAMES.length)];
    return base + ' ' + (Math.floor(Math.random() * 90) + 10);
  }

  /**
   * Crea un nuevo pollito recién eclosionado.
   * @param {string[]} takenNames
   * @returns {import('./types.js').Pollito}
   */
  function createPollito(takenNames) {
    return {
      id: (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      name: pickName(takenNames),
      color: POLLITO_COLORS[Math.floor(Math.random() * POLLITO_COLORS.length)],
      birthDate: new Date().toISOString(),
      stage: 'pollito',
    };
  }

  /**
   * Aplica eclosiones y promociones según el estado actual de sesiones.
   * Pollitos con ≥10 sesiones desde su nacimiento → gallinas.
   * @param {import('./types.js').AppState} state
   */
  function applyProgression(state) {
    state.corral.pollitos.forEach(function (p) {
      if (p.stage !== 'pollito') return;
      var birthMs = new Date(p.birthDate).getTime();
      var sessionsAfter = state.sessions.filter(function (s) {
        return new Date(s.date).getTime() >= birthMs;
      }).length;
      if (sessionsAfter >= 10) p.stage = 'gallina';
    });
  }

  /**
   * Resultado de cerrar una sesión diaria.
   * @typedef {object} DailyClose
   * @property {number} eggsEarned
   * @property {import('./types.js').Pollito[]} hatched
   * @property {Array<{id: string, name: string}>} promotedToGallina
   */

  /**
   * Cierra la sesión diaria (4 juegos completados). Otorga +1 huevo, eclosiona
   * pollitos si se acumularon 5+, y promociona pollitos que llegaron a 10 sesiones.
   * @returns {DailyClose}
   */
  function completeDailySession() {
    var state = getState();
    var earned = 1;
    state.corral.eggs += earned;

    /** @type {import('./types.js').Pollito[]} */
    var hatched = [];
    while (state.corral.eggs >= 5) {
      state.corral.eggs -= 5;
      var taken = state.corral.pollitos.map(function (p) { return p.name; });
      var nuevo = createPollito(taken);
      state.corral.pollitos.push(nuevo);
      hatched.push(nuevo);
    }

    var beforeStages = {};
    state.corral.pollitos.forEach(function (p) { beforeStages[p.id] = p.stage; });

    applyProgression(state);

    /** @type {Array<{id: string, name: string}>} */
    var promoted = [];
    state.corral.pollitos.forEach(function (p) {
      if (beforeStages[p.id] === 'pollito' && p.stage === 'gallina') {
        promoted.push({ id: p.id, name: p.name });
      }
    });

    saveState(state);

    return { eggsEarned: earned, hatched: hatched, promotedToGallina: promoted };
  }

  /**
   * Renombra un pollito (Sofi le pone nombre).
   * @param {string} pollitoId
   * @param {string} newName
   */
  function renamePollito(pollitoId, newName) {
    var state = getState();
    var p = state.corral.pollitos.find(function (x) { return x.id === pollitoId; });
    if (!p) return;
    p.name = newName.slice(0, 24).trim() || p.name;
    saveState(state);
  }

  /**
   * Setea una preferencia de settings (soundEnabled, musicEnabled, etc.)
   * @param {string} key
   * @param {boolean | string | number} value
   */
  function setSetting(key, value) {
    var state = getState();
    state.settings[key] = value;
    saveState(state);
  }

  // Exponer
  /** @type {any} */
  var w = window;
  w.Granja = w.Granja || {};
  w.Granja.store = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    getState: getState,
    addSession: addSession,
    completeDailySession: completeDailySession,
    renamePollito: renamePollito,
    setSetting: setSetting,
    consumeLastGameResult: consumeLastGameResult,
    getSessionsForDate: getSessionsForDate,
    getRecentSessionsForGame: getRecentSessionsForGame,
    subscribe: subscribe,
    toDateKey: toDateKey,
    reset: reset,
  };
})();
