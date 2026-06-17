// @ts-check
// Tipos compartidos del proyecto. Importables vía:
//   /** @type {import('../../lib/types.js').GameMetrics} */

/**
 * @typedef {'fono' | 'psicoped' | 'psicomot' | 'to' | 'mate' | 'lengua' | 'ciencias' | 'geo'} TherapyArea
 */

/**
 * Métricas que cada juego reporta al terminar.
 * @typedef {object} GameMetrics
 * @property {number} accuracy           - 0..1
 * @property {number|null} avgReactionMs - null si no aplica al juego
 * @property {{omission: number, commission: number}} errors
 * @property {1|2|3|4|5} level
 * @property {number} durationSec
 * @property {Record<string, unknown>} raw - datos crudos específicos del juego
 */

/**
 * Una sesión = un juego jugado.
 * @typedef {object} GameSession
 * @property {string} id        - uuid
 * @property {string} date      - ISO datetime
 * @property {string} gameId
 * @property {1|2|3|4|5} difficulty
 * @property {GameMetrics} metrics
 */

/**
 * Stage del pollito en el corral.
 * @typedef {'huevo' | 'pollito' | 'gallina' | 'gallo'} PollitoStage
 */

/**
 * Color del pollito.
 * @typedef {'amarillo' | 'marron' | 'blanco' | 'negro'} PollitoColor
 */

/**
 * @typedef {object} Pollito
 * @property {string} id
 * @property {string} name
 * @property {PollitoColor} color
 * @property {string} birthDate
 * @property {PollitoStage} stage
 */

/**
 * @typedef {object} CorralState
 * @property {number} eggs
 * @property {Pollito[]} pollitos
 * @property {number} streak
 * @property {number} longestStreak
 * @property {string|null} lastSessionDate
 */

/**
 * @typedef {object} DailySummary
 * @property {string} date                              - YYYY-MM-DD
 * @property {string[]} sessionIds
 * @property {number} totalMinutes
 * @property {Record<TherapyArea, number>} areaScores   - 0..100
 * @property {number} eggsEarned
 */

/**
 * @typedef {object} AppSettings
 * @property {boolean} soundEnabled
 * @property {string} [sofiAvatar]
 */

/**
 * Estado raíz persistido en localStorage.
 * @typedef {object} AppState
 * @property {1} schemaVersion
 * @property {GameSession[]} sessions
 * @property {DailySummary[]} dailySummaries
 * @property {CorralState} corral
 * @property {AppSettings} settings
 */

/**
 * Entrada en el registry de juegos del catálogo.
 * @typedef {object} GameModule
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {TherapyArea[]} areas
 * @property {1|2|3|4|5} difficulty
 * @property {number} estimatedSec
 * @property {string} path                              - ruta al index.html del juego
 */

/**
 * Mensaje que un juego envía al shell padre al terminar.
 * @typedef {object} GameFinishedMessage
 * @property {'gameFinished'} type
 * @property {string} gameId
 * @property {GameMetrics} metrics
 */

export {};
