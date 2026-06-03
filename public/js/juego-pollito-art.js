// Paleta, helpers y constantes de estilo para el juego del pollito.
//
// Filosofía: flat vector con contornos negros finos. Sin gradientes complejos,
// sin texturas. Sombreado = otro color sólido de la paleta.
//
// Todo dibujo debe pasar por outlineFill o outlineStroke. Esto garantiza
// consistencia visual: cualquier figura tiene fill + contorno o solo contorno.

export const PALETTE = {
  // Contorno y neutrales
  outline:    "#2a1d10",
  black:      "#222",
  white:      "#ffffff",
  whiteSoft:  "#fff7d1",

  // Amarillos (pollitos, picos)
  yellowLight: "#ffd34a",
  yellowDark:  "#e8a820",
  yellowDeep:  "#c46d10",
  yellowSoft:  "#fff4c0",

  // Naranjas
  orange:     "#f08a1a",
  orangeDark: "#c46d10",

  // Rojos (cresta, banderín)
  redLight: "#e85d5d",
  redDark:  "#b04040",

  // Marrones (madera, tierra)
  brownLight: "#a87447",
  brownMid:   "#8b5a2b",
  brownDark:  "#5b3a1a",
  brownDeep:  "#3a2a1a",

  // Verdes (pasto, copas)
  greenLight: "#8aa64d",
  greenMid:   "#6cb35e",
  greenDark:  "#4f8c46",
  greenDeep:  "#3a6b3a",

  // Azules (cielo, agua)
  blueLight: "#a8d8f0",
  blueMid:   "#5fb4e0",
  blueDark:  "#3d8db0",

  // Animales
  cowWhite:    "#ffffff",
  cowSpots:    "#222222",
  pinkSnout:   "#f8c2c8",
  sheepWool:   "#ffffff",
  sheepFace:   "#3a3026",
  horseBody:   "#8a5a30",
  horseDark:   "#3a2010",
  pigPink:     "#f5b8b0",
  pigDark:     "#d68a82",
  goatGrey:    "#cfc7b4",
  goatDark:    "#7a705a",
  catOrange:   "#e89048",
  catStripes:  "#a85a20",

  // Enemigos
  foxOrange:   "#d97a3e",
  foxDark:     "#a85510",
  crowBlack:   "#28201a",
  crowSheen:   "#4a3c30",
  frogGreen:   "#6caa3a",
  frogDark:    "#3a6020",
  mouseGrey:   "#88807a",
  mouseLight:  "#b8b0a8",

  // Decoración
  hayYellow:   "#d6a04a",
  hayShadow:   "#8a6f3a",
  wheatGold:   "#e8b850",
  flowerRed:   "#e85d5d",
  flowerYellow:"#ffd34a",
  flowerPurple:"#d989ff",
  sunflowerCenter: "#5b3a1a",

  // Sky helpers
  sun:         "#ffd76b",
  sunHalo:     "#fff5b8",

  // Sombra
  shadow: "rgba(0,0,0,0.22)",
};

export const STROKE = {
  thin:  1.2,
  med:   1.4,
  thick: 2,
};

/**
 * Aplica fill + stroke al path actual del contexto.
 * Uso después de armar el path con beginPath/moveTo/etc.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} fill - color de relleno (de PALETTE)
 * @param {object} opts - { stroke?: string, lineWidth?: number }
 */
export function outlineFill(ctx, fill, opts = {}) {
  const stroke = opts.stroke || PALETTE.outline;
  const lineWidth = opts.lineWidth || STROKE.thin;
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

/**
 * Aplica solo stroke (sin fill) al path actual.
 * Útil para detalles tipo plumitas, pelos, manchas finas.
 */
export function outlineStroke(ctx, opts = {}) {
  const stroke = opts.stroke || PALETTE.outline;
  const lineWidth = opts.lineWidth || STROKE.thin;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

/**
 * Dibuja una sombra elíptica plana bajo un personaje en (cx, groundY).
 * Sin shadowBlur (incumple el design language).
 */
export function drawShadow(ctx, cx, groundY, radiusX, opts = {}) {
  const radiusY = opts.radiusY || 3;
  ctx.fillStyle = PALETTE.shadow;
  ctx.beginPath();
  ctx.ellipse(cx, groundY + 1, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();
}
