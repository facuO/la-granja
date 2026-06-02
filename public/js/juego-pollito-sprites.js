// Sistema de sprites pixel art para el juego del pollito.
//
// Sprites definidos como arrays de strings (1 char = 1 pixel) + palette.
// drawSprite() renderiza con scale + facing + squash/stretch + sin smoothing.
//
// Empezamos con el pollito (personaje principal). Animaciones:
//  - idle:    frame quieto (con respiración sutil vía squash externo)
//  - walk1:   pata izquierda adelante
//  - walk2:   pata derecha adelante
//  - jump:    cuerpo extendido, alas abiertas
//  - fall:    cuerpo recogido, ojos sorprendidos
//  - victory: cuerpo saltando, ojos cerrados ^_^

const PALETTE = {
  ".": null,           // transparente
  y: "#ffd34a",        // amarillo claro (cuerpo del pollito)
  Y: "#e8a820",        // amarillo oscuro (sombra del cuerpo)
  o: "#f08a1a",        // naranja (pico, patas)
  O: "#c46d10",        // naranja oscuro (sombra)
  r: "#e85d5d",        // rojo (cresta)
  R: "#b04040",        // rojo oscuro (sombra cresta)
  k: "#222",           // negro
  w: "#fff",           // blanco
  // Zorro
  f: "#d97a3e",        // naranja zorro
  F: "#a85510",        // marrón zorro (sombra)
  z: "#5b3a1a",        // marrón muy oscuro (patas, cola tip)
  // Compartidos
  Z: "#88aacc",        // celeste (Zzz del sleep)
  G: "#fff8b0",        // amarillo dorado huevo especial
  H: "#d6c084",        // beige (highlight egg)
};

// Side-profile facing RIGHT (16x16). Para facing -1, drawSprite hace scale(-1, 1).
const POLLITO = {
  size: 16,
  frames: {
    idle: [
      "................",
      "....rrr.........",
      "...rrrrr........",
      "...yyyyyy.......",
      "..yyyyyyyy......",
      "..yyykwwy.......",
      "..yyykwyy.......",
      ".yyyyyyyyoo.....",
      ".yyyyyyyyooo....",
      ".yyyyyyyyy......",
      ".yYYYYyyyy......",
      ".yyYYyyyy.......",
      "..yyyyyy........",
      "...yyyy.........",
      "...o..o.........",
      "...o..o.........",
    ],
    walk1: [
      "................",
      "....rrr.........",
      "...rrrrr........",
      "...yyyyyy.......",
      "..yyyyyyyy......",
      "..yyykwwy.......",
      "..yyykwyy.......",
      ".yyyyyyyyoo.....",
      ".yyyyyyyyooo....",
      ".yyyyyyyyy......",
      ".yYYYYYyyy......",
      ".yyYYyyy........",
      "..yyyyyy........",
      "...yyyy.........",
      "..o....o........",
      "..o....o........",
    ],
    walk2: [
      "................",
      "....rrr.........",
      "...rrrrr........",
      "...yyyyyy.......",
      "..yyyyyyyy......",
      "..yyykwwy.......",
      "..yyykwyy.......",
      ".yyyyyyyyoo.....",
      ".yyyyyyyyooo....",
      ".yyyyyyyyy......",
      ".yYYYyyyy.......",
      ".yYYYYyyyy......",
      "..yyyyyy........",
      "...yyyy.........",
      "....oo..........",
      "....oo..........",
    ],
    jump: [
      "................",
      "....rrr.........",
      "...rrrrr........",
      "...yyyyyy.......",
      "..yyyyyyyy......",
      "..yyykwwy.......",
      "..yyykwyy.......",
      ".yyyyyyyyoo.....",
      ".yyyyyyyyooo....",
      "yyyyyyyyyy......",  // alas extendidas
      "yYYYYYYYyy......",
      "yYYYyyyy........",
      ".yyyyyy.........",
      "..yyyy..........",
      "...o..o.........",
      "................",
    ],
    fall: [
      "................",
      "....rrr.........",
      "...rrrrr........",
      "...yyyyyy.......",
      "..yyyyyyyy......",
      "..yywwwwy.......",   // ojos sorprendidos
      "..yywwwwy.......",
      ".yyyyyyyyoo.....",
      ".yyyyyyyyooo....",
      ".yyyyyyyyy......",
      ".yYYYYyyy.......",
      ".yyYYyyy........",
      "..yyyyy.........",
      "..yyyy..........",
      "..o....o........",
      "..o....o........",
    ],
    victory: [
      "................",
      "....rrrr........",
      "...rrrrrr.......",
      "...yyyyyyy......",
      "..yyyyyyyyy.....",
      "..yyywyyyy......",   // ojo cerrado (línea)
      "..yyyyyyyy......",
      ".yyyyyyyyyo.....",
      ".yyyyyyyyooo....",
      "yyyyyyyyyy......",
      "yYYYYYYYyy......",   // alas abiertas
      "yYYYyyyy........",
      ".yyyyyy.........",
      "..yyyy..........",
      "..oo..oo........",
      "................",
    ],
  },
};

// Zorro 16x16 — side-profile facing right
const FOX = {
  size: 16,
  frames: {
    walk1: [
      "................",
      ".f............f.",
      "ff............ff",   // orejas izq + cola der
      "fff..........fff",
      "fffff......fffff",
      "ffwwffffffffFfff",   // cara blanca + cuerpo
      "fkfwwfffffffFFff",   // ojo
      "ffwwfffffffffFf.",
      ".ffffffffffffff.",
      "..ff..fff.fff...",   // patas pos walk1
      "..ff..fff.fff...",
      "..zz..zzz.zzz...",
      "................",
      "................",
      "................",
      "................",
    ],
    walk2: [
      "................",
      ".f............f.",
      "ff............ff",
      "fff..........fff",
      "fffff......fffff",
      "ffwwffffffffFfff",
      "fkfwwfffffffFFff",
      "ffwwfffffffffFf.",
      ".ffffffffffffff.",
      "..fff.fff..fff..",   // patas pos walk2
      "..fff.fff..fff..",
      "..zzz.zzz..zzz..",
      "................",
      "................",
      "................",
      "................",
    ],
    sleep: [
      "................",
      ".......Z........",
      "......Z.........",
      ".....Z..........",
      "....Z...........",
      "...Z............",
      "................",
      "................",
      ".ffffffffffff...",   // body horizontal
      "fffwwffffffFff..",
      "ffwwwfffffFFFff.",   // mejilla blanca, ojo cerrado (- es línea k abajo)
      "fkkfffffffFFff..",   // ojo cerrado (línea)
      ".ffff.fffff.fff.",
      "..zz...zzz...zz.",
      "................",
      "................",
    ],
  },
};

// Offscreen canvas: pre-renderizamos cada frame para no recalcular cada draw
const SPRITE_CACHE = {};
function prerender(spriteId, sprite) {
  if (SPRITE_CACHE[spriteId]) return SPRITE_CACHE[spriteId];
  const cache = {};
  for (const [name, frame] of Object.entries(sprite.frames)) {
    const off = document.createElement("canvas");
    off.width = sprite.size;
    off.height = sprite.size;
    const c = off.getContext("2d");
    for (let row = 0; row < sprite.size; row++) {
      for (let col = 0; col < sprite.size; col++) {
        const ch = frame[row][col];
        const color = PALETTE[ch];
        if (!color) continue;
        c.fillStyle = color;
        c.fillRect(col, row, 1, 1);
      }
    }
    cache[name] = off;
  }
  SPRITE_CACHE[spriteId] = cache;
  return cache;
}

// Renderer genérico
function drawSpriteInternal(ctx, sprite, spriteId, cx, cy, frameName, scale, facing, scaleX, scaleY) {
  const cache = prerender(spriteId, sprite);
  const img = cache[frameName] || cache[Object.keys(cache)[0]];
  const size = sprite.size;
  const w = size * scale * scaleX;
  const h = size * scale * scaleY;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(cx, cy);
  if (facing === -1) ctx.scale(-1, 1);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

/** Dibuja un frame del pollito en (cx, cy). */
export function drawPollitoSprite(ctx, cx, cy, frameName, scale = 3, facing = 1, scaleX = 1, scaleY = 1) {
  drawSpriteInternal(ctx, POLLITO, "pollito", cx, cy, frameName, scale, facing, scaleX, scaleY);
}

/** Dibuja un frame del zorro en (cx, cy). */
export function drawFoxSprite(ctx, cx, cy, frameName, scale = 3, facing = 1) {
  drawSpriteInternal(ctx, FOX, "fox", cx, cy, frameName, scale, facing, 1, 1);
}

/** Determina qué frame del zorro mostrar según estado. */
export function pickFoxFrame(fox) {
  if (fox.state === "sleeping") return "sleep";
  // walk1/walk2 alternados según el tiempo
  return (Math.floor(fox.t / 12) % 2 === 0) ? "walk1" : "walk2";
}

/**
 * Determina qué frame mostrar según el estado del pollito y la escena.
 */
export function pickPollitoFrame(p, scene) {
  if (scene === "winning") return "victory";
  if (!p.onGround) return p.vy < 0 ? "jump" : "fall";
  if (Math.abs(p.vx) > 0.1) {
    // Alternar walk1/walk2 cada ~6 frames de walkAnim
    const phase = Math.floor((p.walkAnim || 0) / 4) % 2;
    return phase === 0 ? "walk1" : "walk2";
  }
  return "idle";
}
