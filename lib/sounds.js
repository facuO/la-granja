// @ts-check
/**
 * Sonidos sintetizados con Web Audio API. Sin assets — todo se genera con
 * osciladores. Funciona en file:// en Firefox y Chromium tras gesto de usuario.
 *
 * Expone window.Granja.sound.{pio, cacareo}.
 */
(function () {
  'use strict';

  /** @type {AudioContext | null} */
  var audioCtx = null;

  function getCtx() {
    if (audioCtx) {
      // Por autoplay policy, el contexto suele crearse "suspended" hasta el
      // primer gesto del usuario. resume() es no-op si ya está running.
      if (audioCtx.state === 'suspended') {
        try { audioCtx.resume(); } catch (_e) {}
      }
      return audioCtx;
    }
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try {
      audioCtx = new Ctor();
      if (audioCtx.state === 'suspended') {
        try { audioCtx.resume(); } catch (_e) {}
      }
    } catch (_e) { return null; }
    return audioCtx;
  }

  /**
   * @param {number} freq      Frecuencia inicial en Hz
   * @param {number} durMs     Duración en ms
   * @param {object} [opts]
   * @param {number} [opts.endFreq]  Si está, sweep exponencial hasta ahí
   * @param {OscillatorType} [opts.type]    Forma de onda (sine/triangle/square/sawtooth)
   * @param {number} [opts.volume]   0-1
   * @param {number} [opts.delayMs]  Atrasar el ataque
   */
  function tone(freq, durMs, opts) {
    var ctx = getCtx();
    if (!ctx) return;
    opts = opts || {};
    var t0 = ctx.currentTime + (opts.delayMs || 0) / 1000;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.endFreq) {
      osc.frequency.exponentialRampToValueAtTime(opts.endFreq, t0 + durMs / 1000);
    }
    var vol = opts.volume != null ? opts.volume : 0.15;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + durMs / 1000 + 0.05);
  }

  /** Pío cortito: chirp ascendente sutil para feedback de acierto. */
  function pio() {
    tone(900, 90, { endFreq: 1700, type: 'sine', volume: 0.10 });
  }

  /** Cacareo: secuencia de notas que evoca gallina contenta. */
  function cacareo() {
    var seq = [
      { f: 700, d: 110, delay: 0,   vol: 0.10 },
      { f: 620, d: 90,  delay: 130, vol: 0.10 },
      { f: 850, d: 80,  delay: 240, vol: 0.10 },
      { f: 550, d: 220, delay: 340, vol: 0.10 },
    ];
    seq.forEach(function (n) {
      tone(n.f, n.d, { type: 'triangle', volume: n.vol, delayMs: n.delay });
    });
  }

  /** Lee setting soundEnabled del store; si está desactivado, no suena. */
  function isEnabled() {
    try {
      var s = window.Granja && window.Granja.store && window.Granja.store.getState();
      return !s || s.settings.soundEnabled !== false;
    } catch (_e) { return true; }
  }

  /* ─── Música procedural: Sa Ta Na Ma (Kirtan Kriya) ───
   * Patrón clásico SA-TA-NA-MA = Mi-Re-Do-Re (3-2-1-2 del C mayor), repetido
   * sin variación. Tempo meditativo: 1 sílaba por segundo. Síntesis vocal
   * (fundamental + 2 armónicos + vibrato sutil) para acercar la textura a
   * voz humana en vez de sintetizador chillón. Drone profundo de Do2+Do3
   * como anclaje armónico (el "tampura" simulado de tradición indostánica).
   *
   * Loop de 16s = 4 ciclos completos. Volumen muy bajo (~0.02-0.045) — ambient
   * que no compite con el pío ni distrae. Sólo en el shell, nunca en juegos.
   */
  var SATANAMA_MELODY = [];
  (function buildMelody() {
    var SYL_MS = 1000;       // 1 sílaba por segundo (tempo meditativo)
    var NOTE_DUR = 920;      // duración de la nota (queda 80ms de "silencio")
    var notes = [
      { syl: 'Sa', f: 329.63 }, // E4
      { syl: 'Ta', f: 293.66 }, // D4
      { syl: 'Na', f: 261.63 }, // C4
      { syl: 'Ma', f: 293.66 }, // D4
    ];
    for (var cycle = 0; cycle < 4; cycle++) {
      for (var i = 0; i < notes.length; i++) {
        SATANAMA_MELODY.push({
          syl: notes[i].syl,
          f: notes[i].f,
          d: NOTE_DUR,
          t: (cycle * notes.length + i) * SYL_MS,
        });
      }
    }
  })();
  var MUSIC_LOOP_MS = 16000;
  // Drone Do2 + Do3 sostenido — anclaje tampura
  var DRONE_FUND = 65.41;   // C2
  var DRONE_OCT  = 130.81;  // C3

  /** @type {Array<number>} */
  var musicTimers = [];
  /** @type {number | null} */
  var musicLoopTimer = null;
  var musicIsPlaying = false;

  // Audio file: "Para brisa(s) - aire de chacarera" — Mariana Pavan y Lucas
  // Desposito, CC BY-NC-SA 3.0. Aire de chacarera, instrumental, más campestre
  // y argentino que el sintetizador. Si el archivo no carga o falla, cae al
  // sintetizador procedural (que sigue siendo Sa Ta Na Ma, como respaldo
  // mientras no haya internet o el MP3 no esté sincronizado).
  // El path es relativo a la página del shell (index.html, etc.).
  var MUSIC_FILE = 'shared/sounds/chacarera.mp3';
  /** @type {HTMLAudioElement | null} */
  var musicAudio = null;
  var musicFileFailed = false;

  /**
   * Nota tipo voz: fundamental + 2 armónicos + vibrato sutil en la fundamental.
   * Da una textura más cálida y vocal que el `tone()` simple.
   * @param {number} freq
   * @param {number} durMs
   * @param {{volume?: number, delayMs?: number}} [opts]
   */
  function vocalNote(freq, durMs, opts) {
    var ctx = getCtx();
    if (!ctx) return;
    opts = opts || {};
    var t0 = ctx.currentTime + (opts.delayMs || 0) / 1000;
    var dur = durMs / 1000;
    var vol = opts.volume != null ? opts.volume : 0.045;

    function harmonic(mult, volMult, withVibrato) {
      var osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * mult, t0);
      var g = ctx.createGain();
      var v = vol * volMult;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(v, t0 + 0.10);       // attack lento (voz)
      g.gain.setValueAtTime(v, t0 + dur * 0.70);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);   // release suave
      osc.connect(g).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.1);

      if (withVibrato) {
        var lfo = ctx.createOscillator();
        lfo.frequency.value = 5; // 5 Hz vibrato típico de voz
        var lfoGain = ctx.createGain();
        lfoGain.gain.value = freq * mult * 0.005; // ±0.5% pitch variation
        lfo.connect(lfoGain).connect(osc.frequency);
        lfo.start(t0 + 0.20); // vibrato arranca tras el attack
        lfo.stop(t0 + dur);
      }
    }

    harmonic(1, 1.00, true);  // fundamental con vibrato
    harmonic(2, 0.32, false); // 2do armónico (warmth)
    harmonic(3, 0.12, false); // 3er armónico
  }

  /** Drone "tampura" — Do2 + Do3 sostenidos, fade lento. */
  function drone(durMs) {
    var ctx = getCtx();
    if (!ctx) return;
    var t0 = ctx.currentTime;
    var dur = durMs / 1000;

    function sustained(freq, peakVol) {
      var osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peakVol, t0 + 1.5); // fade in 1.5s
      g.gain.setValueAtTime(peakVol, t0 + dur - 1.5);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);  // fade out 1.5s
      osc.connect(g).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.1);
    }

    sustained(DRONE_FUND, 0.022); // Do2 anclaje
    sustained(DRONE_OCT,  0.014); // Do3 calidez
  }

  function scheduleMusicLoop() {
    if (!musicIsPlaying) return;
    drone(MUSIC_LOOP_MS - 50);
    SATANAMA_MELODY.forEach(function (n) {
      var t = setTimeout(function () {
        if (!musicIsPlaying) return;
        vocalNote(n.f, n.d, { volume: 0.045 });
      }, n.t);
      musicTimers.push(t);
    });
    musicLoopTimer = setTimeout(scheduleMusicLoop, MUSIC_LOOP_MS);
  }

  function startMusic() {
    if (musicIsPlaying) return;
    musicIsPlaying = true;

    // Path 1: intentar archivo MP3 (Chantalananda - Sa Ta Na Ma).
    if (!musicFileFailed) {
      if (!musicAudio) {
        musicAudio = new Audio(MUSIC_FILE);
        musicAudio.loop = true;
        musicAudio.volume = 0.30;  // bg discreto
        musicAudio.addEventListener('error', function () {
          musicFileFailed = true;
          musicAudio = null;
          // Si seguimos queriendo música, caer a procedural
          if (musicIsPlaying) startProceduralMusic();
        });
      }
      var playPromise = musicAudio.play();
      if (playPromise && playPromise.catch) {
        playPromise.catch(function () {
          // Bloqueado por autoplay policy o error de carga → procedural
          if (musicIsPlaying) startProceduralMusic();
        });
      }
      return;
    }

    // Path 2: fallback procedural
    startProceduralMusic();
  }

  function startProceduralMusic() {
    var ctx = getCtx();
    if (!ctx) return;
    scheduleMusicLoop();
  }

  function stopMusic() {
    musicIsPlaying = false;
    if (musicAudio) {
      try { musicAudio.pause(); musicAudio.currentTime = 0; } catch (_e) {}
    }
    if (musicLoopTimer) { clearTimeout(musicLoopTimer); musicLoopTimer = null; }
    musicTimers.forEach(function (t) { clearTimeout(t); });
    musicTimers = [];
  }

  /** Lee setting musicEnabled del store; default false (no arrancar sin pedido). */
  function musicWanted() {
    try {
      var s = window.Granja && window.Granja.store && window.Granja.store.getState();
      return s && s.settings.musicEnabled === true;
    } catch (_e) { return false; }
  }

  /**
   * Llamar en cada página del shell. Si la música está habilitada en settings,
   * registra un listener one-shot para arrancar la música tras el primer click
   * del usuario (autoplay policy). Si no está habilitada, no hace nada.
   */
  function armMusicOnFirstClick() {
    if (!musicWanted()) return;
    var armed = false;
    function once() {
      if (armed) return;
      armed = true;
      startMusic();
      document.removeEventListener('click', once);
      document.removeEventListener('keydown', once);
    }
    document.addEventListener('click', once);
    document.addEventListener('keydown', once);
  }

  // Limpiar música al cambiar de página
  window.addEventListener('pagehide', stopMusic);
  window.addEventListener('beforeunload', stopMusic);

  /** @type {any} */
  var w = window;
  w.Granja = w.Granja || {};
  w.Granja.sound = {
    pio: function () { if (isEnabled()) pio(); },
    cacareo: function () { if (isEnabled()) cacareo(); },
    startMusic: startMusic,
    stopMusic: stopMusic,
    isMusicPlaying: function () { return musicIsPlaying; },
    armMusicOnFirstClick: armMusicOnFirstClick,
  };
})();
