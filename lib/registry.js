// @ts-check
/**
 * Catálogo de juegos. Cada entrada describe un juego que vive en games/<id>/.
 * Expone window.Granja.registry (Array<GameModule>) + helpers.
 */
(function () {
  'use strict';

  /** @typedef {import('./types.js').GameModule} GameModule */

  /** @type {GameModule[]} */
  var games = [
    {
      id: 'atrapa-pollitos',
      name: 'Atrapa-pollitos',
      description: 'Pollitos caen a izquierda o derecha. F mano izquierda, J mano derecha.',
      areas: ['psicomot'],
      difficulty: 2,
      estimatedSec: 90,
      path: 'games/atrapa-pollitos/index.html',
    },
    {
      id: 'memoria-pares',
      name: 'Memoria de pares',
      description: 'Encontrá los pares de animales dados vuelta.',
      areas: ['psicoped'],
      difficulty: 2,
      estimatedSec: 120,
      path: 'games/memoria-pares/index.html',
    },
    {
      id: 'trabalenguas',
      name: 'Trabalenguas',
      description: 'Repetí un trabalenguas y escuchate.',
      areas: ['fono'],
      difficulty: 2,
      estimatedSec: 90,
      path: 'games/trabalenguas/index.html',
    },
    {
      id: 'clicks-precisos',
      name: 'Clicks precisos',
      description: 'Tocá los blancos chicos antes de que desaparezcan.',
      areas: ['to'],
      difficulty: 2,
      estimatedSec: 90,
      path: 'games/clicks-precisos/index.html',
    },
    {
      id: 'stop-go',
      name: 'Stop & Go',
      description: 'Atrapá pollitos con Espacio. ¡No apretés cuando aparezca el zorro!',
      areas: ['psicoped'],
      difficulty: 2,
      estimatedSec: 90,
      path: 'games/stop-go/index.html',
    },
    {
      id: 'mate-rapidas',
      name: 'Granos al corral',
      description: 'Resolvé operaciones rápidas antes de que se acabe el tiempo.',
      areas: ['mate'],
      difficulty: 2,
      estimatedSec: 90,
      path: 'games/mate-rapidas/index.html',
    },
    {
      id: 'cuantos-pollitos',
      name: '¿Cuántos pollitos?',
      description: 'Aparecen unos pollitos por unos segundos. ¿Cuántos viste?',
      areas: ['mate'],
      difficulty: 2,
      estimatedSec: 90,
      path: 'games/cuantos-pollitos/index.html',
    },
    {
      id: 'palabra-intrusa',
      name: 'Palabra intrusa',
      description: 'De cuatro palabras, una no encaja con las otras. Encontrala.',
      areas: ['lengua'],
      difficulty: 2,
      estimatedSec: 90,
      path: 'games/palabra-intrusa/index.html',
    },
    {
      id: 'letras-revueltas',
      name: 'Letras revueltas',
      description: 'Las letras están desordenadas. Armá la palabra en orden.',
      areas: ['lengua'],
      difficulty: 2,
      estimatedSec: 120,
      path: 'games/letras-revueltas/index.html',
    },
    {
      id: 'palabras-al-vuelo',
      name: 'Palabras al vuelo',
      description: 'Decí cuántas palabras puedas que empiecen con una letra.',
      areas: ['fono'],
      difficulty: 2,
      estimatedSec: 60,
      path: 'games/palabras-al-vuelo/index.html',
    },
    {
      id: 'categorias',
      name: 'Categorías',
      description: 'Decí cosas que entren en una categoría. Las categorías se ponen más difíciles.',
      areas: ['fono', 'psicoped'],
      difficulty: 2,
      estimatedSec: 75,
      path: 'games/categorias/index.html',
    },
    {
      id: 'n-back',
      name: 'Memoria activa',
      description: 'Apretá Espacio cuando el pollito sea igual al de hace 2 turnos.',
      areas: ['psicoped'],
      difficulty: 2,
      estimatedSec: 90,
      path: 'games/n-back/index.html',
    },
    {
      id: 'cruzados',
      name: 'Cruzados',
      description: 'Aparece a la derecha → apretá izquierda. Aparece a la izquierda → apretá derecha.',
      areas: ['psicomot'],
      difficulty: 2,
      estimatedSec: 90,
      path: 'games/cruzados/index.html',
    },
    {
      id: 'ritmo',
      name: 'Ritmo',
      description: 'Las notas bajan por dos carriles. Apretá F o J cuando lleguen a la línea.',
      areas: ['psicomot', 'psicoped'],
      difficulty: 2,
      estimatedSec: 75,
      path: 'games/ritmo/index.html',
    },
    {
      id: 'trazado-preciso',
      name: 'Trazado preciso',
      description: 'Seguí la línea con el mouse sin salirte del camino.',
      areas: ['to'],
      difficulty: 2,
      estimatedSec: 90,
      path: 'games/trazado-preciso/index.html',
    },
    {
      id: 'rimas',
      name: 'Rimas',
      description: 'De cuatro palabras, elegí la que rima con la palabra objetivo.',
      areas: ['fono', 'lengua'],
      difficulty: 2,
      estimatedSec: 90,
      path: 'games/rimas/index.html',
    },
    {
      id: 'secuencias-numericas',
      name: 'Secuencias numéricas',
      description: 'Completá el número que falta en la secuencia.',
      areas: ['mate'],
      difficulty: 2,
      estimatedSec: 90,
      path: 'games/secuencias-numericas/index.html',
    },
    {
      id: 'adivina-animal',
      name: 'Adivina el animal',
      description: 'Una pregunta sobre animales y cuatro fotos. ¿Cuál es?',
      areas: ['ciencias'],
      difficulty: 2,
      estimatedSec: 90,
      path: 'games/adivina-animal/index.html',
    },
    {
      id: 'capitales-argentinas',
      name: 'Capitales argentinas',
      description: 'Te muestro una provincia, vos elegís cuál es su capital.',
      areas: ['geo'],
      difficulty: 2,
      estimatedSec: 90,
      path: 'games/capitales-argentinas/index.html',
    },
  ];

  /**
   * @param {string} id
   * @returns {GameModule | undefined}
   */
  function getById(id) {
    return games.find(function (g) { return g.id === id; });
  }

  /**
   * @param {import('./types.js').TherapyArea} area
   * @returns {GameModule[]}
   */
  function getByArea(area) {
    return games.filter(function (g) { return g.areas.indexOf(area) >= 0; });
  }

  /** @type {any} */
  var w = window;
  w.Granja = w.Granja || {};
  w.Granja.registry = {
    games: games,
    getById: getById,
    getByArea: getByArea,
  };
})();
