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
  y: "#ffd34a",        // amarillo claro (cuerpo)
  Y: "#e8a820",        // amarillo oscuro (sombra del cuerpo)
  o: "#f08a1a",        // naranja (pico, patas)
  O: "#c46d10",        // naranja oscuro (sombra pico/patas)
  r: "#e85d5d",        // rojo (cresta)
  R: "#b04040",        // rojo oscuro (sombra cresta)
  k: "#222",           // negro (pupila)
  w: "#fff",           // blanco (sclera)
  s: "rgba(0,0,0,0.18)", // sombra suave
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

/**
 * Dibuja un frame del pollito en (cx, cy) (centro), con scale y facing.
 * scaleX/scaleY adicionales aplican squash/stretch (mismo sistema que antes).
 */
export function drawPollitoSprite(ctx, cx, cy, frameName, scale = 3, facing = 1, scaleX = 1, scaleY = 1) {
  const cache = prerender("pollito", POLLITO);
  const img = cache[frameName] || cache.idle;
  const size = POLLITO.size;
  const w = size * scale * scaleX;
  const h = size * scale * scaleY;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(cx, cy);
  if (facing === -1) ctx.scale(-1, 1);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
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
