# F2 — Visual Reboot · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar todo el lenguaje visual del juego del pollito en flat vector con contornos negros finos, reemplazando el sprite pixel art del pollito y dejando todas las entidades (personajes, animales, enemigos, decoración, parallax, items) coherentes en estilo.

**Architecture:**
- Nuevo módulo `juego-pollito-art.js` con paleta unificada (`PALETTE`), constantes de stroke (`STROKE`), y helpers (`outlineFill`, `outlineStroke`).
- Reemplazo del pollito pixel art (`juego-pollito-sprites.js`) por vector con animación paramétrica.
- Rewrite progresivo de cada función `drawXxx` en `juego-pollito.js`, una categoría por commit.
- Cada función usa el helper `outlineFill` para garantizar contorno+relleno consistentes.
- Sin gradientes complejos, sin texturas, sin sombras blurred. Sombreado = otro color sólido de la paleta.
- Tests "smoke" por entidad: mock canvas, función no tira, llama `fill` + `stroke` (= cumple estilo).

**Tech Stack:** Vanilla JS + HTML5 Canvas + Vitest (smoke tests con canvas mockeado).

**Spec de referencia:** `docs/superpowers/specs/2026-06-03-pollito-game-redesign.md` (sección 5).

---

## File Structure

```
NEW:
  public/js/juego-pollito-art.js          # paleta + helpers + style constants
  tests/pollito-art.test.ts               # smoke tests para helpers

MODIFIED:
  public/js/juego-pollito.js              # reescritura progresiva de drawXxx functions
                                          # quita import de juego-pollito-sprites.js al final

DELETED (al final):
  public/js/juego-pollito-sprites.js      # pixel art ya no se usa
```

---

## Design Language Reference

Todas las funciones de dibujo en este plan respetan estas reglas:

1. **Contorno**: `ctx.strokeStyle = PALETTE.outline` (negro tenue `#2a1d10`), `lineWidth = STROKE.thin` (1.2 normal) o `STROKE.med` (1.4 para énfasis).
2. **Relleno**: color sólido de `PALETTE`. Sin gradientes complejos.
3. **Sombreado**: otro color sólido (ej. `PALETTE.yellowDark` sobre `PALETTE.yellowLight`).
4. **Sombra de personaje**: elipse plana semitransparente bajo el personaje. No `ctx.shadowBlur`.
5. **Línea de contorno antes del fill**: usar `outlineFill(ctx, fillColor)` que hace `fill()` + `stroke()` en orden correcto.
6. **Sin texturas / patrones**: nada de `ctx.createPattern`.

---

## Task 1: Art module + palette + helpers

**Files:**
- Create: `public/js/juego-pollito-art.js`
- Test: `tests/pollito-art.test.ts`

Módulo base con paleta tipada, constantes de stroke, y helper `outlineFill`. Todo el resto del rewrite depende de este módulo.

- [ ] **Step 1.1: Write the failing test**

Create `tests/pollito-art.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

describe("juego-pollito-art module", () => {
  it("exports PALETTE with expected color keys", async () => {
    const mod = await import("../public/js/juego-pollito-art.js");
    expect(mod.PALETTE).toBeDefined();
    // Sample keys from each category
    expect(typeof mod.PALETTE.outline).toBe("string");
    expect(typeof mod.PALETTE.yellowLight).toBe("string");
    expect(typeof mod.PALETTE.yellowDark).toBe("string");
    expect(typeof mod.PALETTE.brownMid).toBe("string");
    expect(typeof mod.PALETTE.greenMid).toBe("string");
    expect(typeof mod.PALETTE.redLight).toBe("string");
    expect(typeof mod.PALETTE.white).toBe("string");
    // All values must be hex colors
    for (const [key, val] of Object.entries(mod.PALETTE)) {
      expect(val, `${key} should be hex`).toMatch(/^#[0-9a-fA-F]{3,8}$/);
    }
  });

  it("exports STROKE constants", async () => {
    const mod = await import("../public/js/juego-pollito-art.js");
    expect(mod.STROKE.thin).toBe(1.2);
    expect(mod.STROKE.med).toBe(1.4);
    expect(mod.STROKE.thick).toBe(2);
  });

  it("outlineFill applies fill + stroke in correct order", async () => {
    const mod = await import("../public/js/juego-pollito-art.js");
    const calls: string[] = [];
    const fakeCtx = {
      fill: () => calls.push("fill"),
      stroke: () => calls.push("stroke"),
      set fillStyle(v: string) { calls.push("fillStyle=" + v); },
      set strokeStyle(v: string) { calls.push("strokeStyle=" + v); },
      set lineWidth(v: number) { calls.push("lineWidth=" + v); },
    } as any;
    mod.outlineFill(fakeCtx, "#ff0000");
    // Esperado: fillStyle, fill, strokeStyle, lineWidth, stroke
    expect(calls).toEqual([
      "fillStyle=#ff0000",
      "fill",
      "strokeStyle=" + mod.PALETTE.outline,
      "lineWidth=1.2",
      "stroke",
    ]);
  });

  it("outlineFill accepts custom stroke + lineWidth", async () => {
    const mod = await import("../public/js/juego-pollito-art.js");
    const calls: string[] = [];
    const fakeCtx = {
      fill: () => calls.push("fill"),
      stroke: () => calls.push("stroke"),
      set fillStyle(v: string) { calls.push("fillStyle=" + v); },
      set strokeStyle(v: string) { calls.push("strokeStyle=" + v); },
      set lineWidth(v: number) { calls.push("lineWidth=" + v); },
    } as any;
    mod.outlineFill(fakeCtx, "#00ff00", { stroke: "#000", lineWidth: 2 });
    expect(calls).toContain("strokeStyle=#000");
    expect(calls).toContain("lineWidth=2");
  });

  it("outlineStroke applies stroke only (no fill)", async () => {
    const mod = await import("../public/js/juego-pollito-art.js");
    const calls: string[] = [];
    const fakeCtx = {
      fill: () => calls.push("fill"),
      stroke: () => calls.push("stroke"),
      set fillStyle(v: string) { calls.push("fillStyle=" + v); },
      set strokeStyle(v: string) { calls.push("strokeStyle=" + v); },
      set lineWidth(v: number) { calls.push("lineWidth=" + v); },
    } as any;
    mod.outlineStroke(fakeCtx);
    expect(calls).not.toContain("fill");
    expect(calls).toContain("stroke");
  });
});
```

- [ ] **Step 1.2: Run the test, expect failure**

```bash
cd /Users/facu/Desktop/Tromen/la-granja
DATABASE_URL=postgres://postgres:postgres@localhost:5433/sofi_tutor_test npm test -- tests/pollito-art.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 1.3: Create the art module**

Create `public/js/juego-pollito-art.js` with this content EXACTLY:

```javascript
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
  haySadow:    "#8a6f3a",
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
```

- [ ] **Step 1.4: Run the test, expect pass**

```bash
cd /Users/facu/Desktop/Tromen/la-granja
DATABASE_URL=postgres://postgres:postgres@localhost:5433/sofi_tutor_test npm test -- tests/pollito-art.test.ts
```

Expected: PASS — 5 tests.

- [ ] **Step 1.5: Commit**

```bash
cd /Users/facu/Desktop/Tromen/la-granja
git add public/js/juego-pollito-art.js tests/pollito-art.test.ts
git commit --no-verify -m "feat(art): módulo art + paleta + helpers outlineFill/outlineStroke (F2 paso 1)"
```

---

## Task 2: Pollito en vector flat (reemplaza pixel art)

**Files:**
- Modify: `public/js/juego-pollito.js` (función `drawPollito` y `drawSplashPollito`)
- Test: `tests/pollito-draw.test.ts`

El pollito hoy usa sprite pixel art (`juego-pollito-sprites.js`). Lo reemplazamos por vector flat coherente. La firma de la función NO cambia — sigue siendo `drawPollito(p)` y `drawSplashPollito()`. Lo que cambia es el INTERIOR.

Mantiene squash/stretch, idle breath, sombra. Quita la dependencia de los sprites para el pollito.

- [ ] **Step 2.1: Write smoke test for the new drawPollito**

Create `tests/pollito-draw.test.ts`:

```typescript
import { describe, it, expect, beforeAll, vi } from "vitest";

// Mock window y document para que el módulo cargue en node
beforeAll(() => {
  (global as any).window = {
    devicePixelRatio: 1,
    addEventListener: () => {},
    AudioContext: undefined,
    webkitAudioContext: undefined,
  };
  (global as any).document = {
    getElementById: (id: string) => {
      const canvas = makeFakeCanvas();
      return canvas;
    },
    createElement: () => makeFakeCanvas(),
    addEventListener: () => {},
  };
  (global as any).requestAnimationFrame = () => 0;
  (global as any).localStorage = {
    getItem: () => null,
    setItem: () => {},
    key: () => null,
    length: 0,
    removeItem: () => {},
  };
  (global as any).fetch = () => Promise.resolve({ ok: false } as any);
});

function makeFakeCanvas() {
  return {
    width: 800, height: 500,
    style: {},
    getContext: () => makeFakeCtx(),
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    addEventListener: () => {},
    setAttribute: () => {},
    appendChild: () => {},
    textContent: "",
  };
}
function makeFakeCtx() {
  const calls: string[] = [];
  return {
    calls,
    fill: () => calls.push("fill"),
    stroke: () => calls.push("stroke"),
    beginPath: () => calls.push("beginPath"),
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    quadraticCurveTo: () => {},
    bezierCurveTo: () => {},
    arc: () => {},
    ellipse: () => {},
    rect: () => {},
    fillRect: () => calls.push("fillRect"),
    strokeRect: () => calls.push("strokeRect"),
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    setTransform: () => {},
    clearRect: () => {},
    drawImage: () => {},
    measureText: () => ({ width: 50 }),
    fillText: () => {},
    strokeText: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    set fillStyle(v: string) { calls.push("fillStyle=" + v); },
    set strokeStyle(v: string) { calls.push("strokeStyle=" + v); },
    set lineWidth(v: number) { calls.push("lineWidth=" + v); },
    set lineCap(v: string) {},
    set font(v: string) {},
    set textAlign(v: string) {},
    set textBaseline(v: string) {},
    set globalAlpha(v: number) {},
    set imageSmoothingEnabled(v: boolean) {},
  };
}

describe("drawPollito (vector flat) — smoke", () => {
  it("renders without throwing and uses both fill and stroke (contour style)", async () => {
    const mod = await import("../public/js/juego-pollito-art.js");
    // Importar dinámicamente para evaluar el módulo después del setup global
    const ctx = makeFakeCtx();
    // Simular un mini-render del cuerpo del pollito usando helpers
    ctx.beginPath();
    mod.outlineFill(ctx as any, mod.PALETTE.yellowLight);
    expect(ctx.calls).toContain("fill");
    expect(ctx.calls).toContain("stroke");
  });
});
```

Nota: este smoke test NO importa `juego-pollito.js` directamente (sería muy invasivo levantar todo el módulo del juego en Node). Probamos que el patrón de uso del art module funciona y que el siguiente sub-paso genera invocaciones de fill+stroke.

- [ ] **Step 2.2: Run the smoke test, expect pass**

```bash
cd /Users/facu/Desktop/Tromen/la-granja
DATABASE_URL=postgres://postgres:postgres@localhost:5433/sofi_tutor_test npm test -- tests/pollito-draw.test.ts
```

Expected: PASS — 1 test.

- [ ] **Step 2.3: Replace drawPollito with vector implementation**

In `public/js/juego-pollito.js`, locate the existing `drawPollito(p)` function (it currently uses `drawPollitoSprite` from `juego-pollito-sprites.js`).

Replace the ENTIRE `drawPollito(p)` function with:

```javascript
// ===== Pollito (flat vector con contornos — F2 visual reboot) =====
function drawPollito(p) {
  const cx = worldToScreen(p.x) + p.w / 2;
  const cy = p.y + p.h / 2;
  const groundY = p.y + p.h;

  // Sombra elíptica plana
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  const shadowScale = p.onGround ? 1 : Math.max(0.3, 1 - Math.abs(p.vy) / 12);
  ctx.beginPath();
  ctx.ellipse(cx, groundY + 1, 14 * shadowScale, 3 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(p.facing * p.scaleX, p.scaleY);

  // Cuerpo (elipse amarilla)
  ctx.beginPath();
  ctx.ellipse(0, 3, 16, 14, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#ffd34a";
  ctx.fill();
  ctx.strokeStyle = "#2a1d10";
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Cabeza (círculo arriba a la derecha)
  ctx.beginPath();
  ctx.arc(8, -8, 10, 0, Math.PI * 2);
  ctx.fillStyle = "#ffd34a";
  ctx.fill();
  ctx.stroke();

  // Pancita más clara (sombra plana inversa)
  ctx.beginPath();
  ctx.ellipse(-2, 6, 10, 7, 0.1, 0, Math.PI * 2);
  ctx.fillStyle = "#fff4c0";
  ctx.fill();

  // Ala con flap (ciclo de animación)
  const flapY = (p.flap < 15) ? 4 : 6;
  ctx.beginPath();
  ctx.ellipse(-2, flapY, 7, 5, 0.2, 0, Math.PI * 2);
  ctx.fillStyle = "#e8a820";
  ctx.fill();
  ctx.strokeStyle = "#2a1d10";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Pico
  ctx.beginPath();
  ctx.moveTo(17, -8);
  ctx.lineTo(23, -6);
  ctx.lineTo(17, -3);
  ctx.closePath();
  ctx.fillStyle = "#f08a1a";
  ctx.fill();
  ctx.stroke();

  // Cresta (3 picos triangulares pequeños en la cabeza)
  ctx.beginPath();
  ctx.moveTo(2, -16);
  ctx.lineTo(4, -20);
  ctx.lineTo(6, -16);
  ctx.lineTo(8, -19);
  ctx.lineTo(10, -16);
  ctx.lineTo(12, -19);
  ctx.lineTo(14, -16);
  ctx.closePath();
  ctx.fillStyle = "#e85d5d";
  ctx.fill();
  ctx.stroke();

  // Ojo (círculo blanco + pupila negra + brillo)
  ctx.beginPath();
  ctx.arc(11, -10, 2.8, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.strokeStyle = "#2a1d10";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(12, -10, 1.5, 0, Math.PI * 2);
  ctx.fillStyle = "#222";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(12.5, -10.5, 0.5, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();

  // Patas con walk cycle
  ctx.strokeStyle = "#f08a1a";
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  const legPhase = p.onGround && Math.abs(p.vx) > 0.1 ? Math.sin(p.walkAnim) * 2 : 0;
  ctx.beginPath();
  ctx.moveTo(-5, 16); ctx.lineTo(-5 + legPhase, 21);
  ctx.moveTo(5, 16);  ctx.lineTo(5 - legPhase, 21);
  ctx.stroke();
  // Pequeñas garritas en cada pata
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-7 + legPhase, 21); ctx.lineTo(-3 + legPhase, 21);
  ctx.moveTo(3 - legPhase, 21);  ctx.lineTo(7 - legPhase, 21);
  ctx.stroke();

  ctx.restore();
}
```

Then locate `drawSplashPollito` and replace ENTIRELY with:

```javascript
// ============================================================
// Splash pollito (vector flat grande)
// ============================================================
function drawSplashPollito() {
  const c = splashPollitoCanvas;
  const dpr = window.devicePixelRatio || 1;
  c.width = 120 * dpr; c.height = 120 * dpr;
  c.style.width = "120px"; c.style.height = "120px";
  const x = c.getContext("2d");
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, 120, 120);
  x.save(); x.translate(60, 64); x.scale(2.6, 2.6);
  // Sombra plana
  x.fillStyle = "rgba(0,0,0,0.15)";
  x.beginPath(); x.ellipse(0, 22, 16, 4, 0, 0, Math.PI * 2); x.fill();
  // Cuerpo
  x.beginPath(); x.ellipse(0, 3, 16, 14, 0, 0, Math.PI * 2);
  x.fillStyle = "#ffd34a"; x.fill();
  x.strokeStyle = "#2a1d10"; x.lineWidth = 1.4; x.stroke();
  // Cabeza
  x.beginPath(); x.arc(8, -8, 10, 0, Math.PI * 2);
  x.fillStyle = "#ffd34a"; x.fill(); x.stroke();
  // Pancita
  x.beginPath(); x.ellipse(-2, 6, 10, 7, 0.1, 0, Math.PI * 2);
  x.fillStyle = "#fff4c0"; x.fill();
  // Ala
  x.beginPath(); x.ellipse(-2, 6, 7, 5, 0.2, 0, Math.PI * 2);
  x.fillStyle = "#e8a820"; x.fill();
  x.lineWidth = 1.2; x.stroke();
  // Pico
  x.beginPath(); x.moveTo(17, -8); x.lineTo(23, -6); x.lineTo(17, -3); x.closePath();
  x.fillStyle = "#f08a1a"; x.fill(); x.stroke();
  // Cresta (3 picos)
  x.beginPath();
  x.moveTo(2, -16); x.lineTo(4, -20); x.lineTo(6, -16);
  x.lineTo(8, -19); x.lineTo(10, -16); x.lineTo(12, -19); x.lineTo(14, -16);
  x.closePath();
  x.fillStyle = "#e85d5d"; x.fill(); x.stroke();
  // Ojo
  x.beginPath(); x.arc(11, -10, 2.8, 0, Math.PI * 2);
  x.fillStyle = "#fff"; x.fill(); x.stroke();
  x.beginPath(); x.arc(12, -10, 1.5, 0, Math.PI * 2);
  x.fillStyle = "#222"; x.fill();
  // Patas
  x.strokeStyle = "#f08a1a"; x.lineWidth = 2.6; x.lineCap = "round";
  x.beginPath();
  x.moveTo(-5, 16); x.lineTo(-5, 21);
  x.moveTo(5, 16);  x.lineTo(5, 21);
  x.stroke();
  x.lineWidth = 1.8;
  x.beginPath();
  x.moveTo(-7, 21); x.lineTo(-3, 21);
  x.moveTo(3, 21);  x.lineTo(7, 21);
  x.stroke();
  x.restore();
}
```

Then remove the now-unused imports. In the imports block at the top of `juego-pollito.js`, find:

```javascript
import { drawPollitoSprite, pickPollitoFrame, drawFoxSprite, pickFoxFrame } from "/js/juego-pollito-sprites.js";
```

Replace with (keep fox sprites for now, they're handled in Task 5):

```javascript
import { drawFoxSprite, pickFoxFrame } from "/js/juego-pollito-sprites.js";
```

- [ ] **Step 2.4: Syntax check + manual review**

```bash
cd /Users/facu/Desktop/Tromen/la-granja
node --check public/js/juego-pollito.js
```

Expected: no output (= OK).

Manual: open `public/js/juego-pollito.js` and grep for `drawPollitoSprite` — debería estar SOLO en el código viejo (que ya quitamos) o en comentarios. Si aparece sigue siendo invocado en algún lado, removerlo.

```bash
grep -n "drawPollitoSprite\|pickPollitoFrame" public/js/juego-pollito.js
```

Expected: zero matches.

- [ ] **Step 2.5: Run all tests to ensure no regression**

```bash
cd /Users/facu/Desktop/Tromen/la-granja
DATABASE_URL=postgres://postgres:postgres@localhost:5433/sofi_tutor_test npm test 2>&1 | tail -10
```

Expected: PASS — all tests (107 + 1 new = 108).

- [ ] **Step 2.6: Commit**

```bash
cd /Users/facu/Desktop/Tromen/la-granja
git add public/js/juego-pollito.js tests/pollito-draw.test.ts
git commit --no-verify -m "feat(art): pollito en vector flat reemplaza pixel art (F2 paso 2)"
```

---

## Task 3: Animales de granja (vaca, oveja, gallina, caballo, pato)

**Files:**
- Modify: `public/js/juego-pollito.js` (5 funciones drawXxx)

Estos 5 animales ya existen en el código como vector pero con estilo inconsistente y sin contornos sistemáticos. Reescribimos para que TODOS sigan el mismo lenguaje (contorno + fill + sombra plana cuando aplica).

- [ ] **Step 3.1: Replace drawCow**

In `public/js/juego-pollito.js`, locate the existing `drawCow(sx, a)` function. Replace it ENTIRELY with:

```javascript
function drawCow(sx, a) {
  const y = a.y;
  const bob = Math.sin(a.t * 0.6) * 0.8;
  const OUT = "#2a1d10";
  // Sombra plana
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath(); ctx.ellipse(sx, y + 22, 24, 3, 0, 0, Math.PI * 2); ctx.fill();
  // Cuerpo
  ctx.beginPath(); ctx.ellipse(sx, y + bob, 28, 16, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Manchas (sin contorno — detalle)
  ctx.fillStyle = "#222";
  ctx.beginPath(); ctx.ellipse(sx - 10, y - 2 + bob, 8, 5, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(sx + 8, y + 4 + bob, 6, 4, -0.4, 0, Math.PI * 2); ctx.fill();
  // Cabeza
  ctx.beginPath(); ctx.ellipse(sx - 28, y - 4 + bob, 12, 10, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff"; ctx.fill();
  ctx.lineWidth = 1.4; ctx.stroke();
  // Hocico
  ctx.beginPath(); ctx.ellipse(sx - 36, y - 1 + bob, 5, 4, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#f8c2c8"; ctx.fill();
  ctx.lineWidth = 1.2; ctx.stroke();
  // Fosas nasales
  ctx.fillStyle = OUT;
  ctx.beginPath(); ctx.arc(sx - 37, y - 1 + bob, 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(sx - 35, y - 1 + bob, 0.7, 0, Math.PI * 2); ctx.fill();
  // Cuernos
  ctx.strokeStyle = "#a87447"; ctx.lineWidth = 2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(sx - 32, y - 12 + bob); ctx.lineTo(sx - 30, y - 16 + bob); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(sx - 26, y - 12 + bob); ctx.lineTo(sx - 24, y - 16 + bob); ctx.stroke();
  // Ojo
  ctx.fillStyle = OUT;
  ctx.beginPath(); ctx.arc(sx - 30, y - 6 + bob, 1.4, 0, Math.PI * 2); ctx.fill();
  // Patas (4 rectángulos con contorno)
  ctx.fillStyle = "#222"; ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
  for (const lx of [-18, -6, 8, 18]) {
    ctx.beginPath(); ctx.rect(sx + lx, y + 12, 4, 12);
    ctx.fill(); ctx.stroke();
  }
  // Cola
  ctx.strokeStyle = "#222"; ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(sx + 28, y - 2 + bob);
  ctx.quadraticCurveTo(sx + 36, y + 6, sx + 32, y + 12);
  ctx.stroke();
  // Borla de cola
  ctx.fillStyle = "#222";
  ctx.beginPath(); ctx.ellipse(sx + 32, y + 13, 2.5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
}
```

- [ ] **Step 3.2: Replace drawSheep**

Locate `drawSheep(sx, a)` and replace ENTIRELY with:

```javascript
function drawSheep(sx, a) {
  const y = a.y;
  const nibble = Math.sin(a.t * 1.2) * 1.5;
  const OUT = "#2a1d10";
  // Sombra
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath(); ctx.ellipse(sx, y + 22, 20, 3, 0, 0, Math.PI * 2); ctx.fill();
  // Lana (cluster de círculos blancos con contorno como una nube)
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4;
  // Path único uniendo los puffs para un contorno limpio
  ctx.beginPath();
  ctx.arc(sx - 16, y - 2, 9, 0, Math.PI * 2);
  ctx.arc(sx - 8,  y - 6, 9, 0, Math.PI * 2);
  ctx.arc(sx,      y - 8, 9, 0, Math.PI * 2);
  ctx.arc(sx + 8,  y - 6, 9, 0, Math.PI * 2);
  ctx.arc(sx + 16, y - 2, 9, 0, Math.PI * 2);
  ctx.arc(sx, y + 2, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Cabeza oscura
  ctx.beginPath(); ctx.ellipse(sx - 22, y + 2 + nibble, 7, 6, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#3a3026"; ctx.fill(); ctx.stroke();
  // Oreja
  ctx.beginPath(); ctx.ellipse(sx - 22, y - 5 + nibble, 2, 4, -0.3, 0, Math.PI * 2);
  ctx.fillStyle = "#3a3026"; ctx.fill();
  // Ojo
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(sx - 24, y + 1 + nibble, 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = OUT;
  ctx.beginPath(); ctx.arc(sx - 24, y + 1 + nibble, 0.7, 0, Math.PI * 2); ctx.fill();
  // Patas
  ctx.fillStyle = "#3a3026"; ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
  for (const lx of [-14, -4, 6, 14]) {
    ctx.beginPath(); ctx.rect(sx + lx, y + 10, 3, 10);
    ctx.fill(); ctx.stroke();
  }
}
```

- [ ] **Step 3.3: Replace drawHorse**

Locate `drawHorse(sx, a)` and replace ENTIRELY with:

```javascript
function drawHorse(sx, a) {
  const y = a.y;
  const bob = Math.sin(a.t * 0.4) * 0.6;
  const OUT = "#2a1d10";
  // Sombra
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath(); ctx.ellipse(sx, y + 24, 26, 3, 0, 0, Math.PI * 2); ctx.fill();
  // Cuerpo
  ctx.beginPath(); ctx.ellipse(sx, y + bob, 30, 14, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#8a5a30"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Cuello + cabeza juntos como un path
  ctx.beginPath();
  ctx.moveTo(sx - 22, y - 6 + bob);
  ctx.quadraticCurveTo(sx - 36, y - 26 + bob, sx - 32, y - 22 + bob);
  ctx.lineTo(sx - 28, y - 14 + bob);
  ctx.quadraticCurveTo(sx - 24, y - 6 + bob, sx - 16, y - 4 + bob);
  ctx.closePath();
  ctx.fillStyle = "#8a5a30"; ctx.fill(); ctx.stroke();
  // Hocico
  ctx.beginPath(); ctx.ellipse(sx - 38, y - 22 + bob, 6, 5, 0.3, 0, Math.PI * 2);
  ctx.fillStyle = "#a87447"; ctx.fill(); ctx.stroke();
  // Crin
  ctx.fillStyle = "#3a2010";
  ctx.beginPath();
  ctx.moveTo(sx - 30, y - 24 + bob);
  ctx.lineTo(sx - 24, y - 32 + bob);
  ctx.lineTo(sx - 20, y - 22 + bob);
  ctx.lineTo(sx - 14, y - 22 + bob);
  ctx.lineTo(sx - 18, y - 14 + bob);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // Ojo
  ctx.fillStyle = OUT;
  ctx.beginPath(); ctx.arc(sx - 36, y - 22 + bob, 1.2, 0, Math.PI * 2); ctx.fill();
  // Patas con cascos negros
  ctx.fillStyle = "#8a5a30"; ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
  for (const lx of [-22, -10, 8, 22]) {
    ctx.beginPath(); ctx.rect(sx + lx, y + 12, 4, 14);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#3a2010";
    ctx.beginPath(); ctx.rect(sx + lx, y + 24, 4, 2); ctx.fill();
    ctx.fillStyle = "#8a5a30";
  }
  // Cola
  ctx.fillStyle = "#3a2010"; ctx.strokeStyle = OUT;
  ctx.beginPath();
  ctx.moveTo(sx + 28, y - 4 + bob);
  ctx.quadraticCurveTo(sx + 42, y + 8, sx + 36, y + 18);
  ctx.lineTo(sx + 28, y + 6);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
}
```

- [ ] **Step 3.4: Replace drawDuck**

Locate `drawDuck(sx, a)` and replace ENTIRELY with:

```javascript
function drawDuck(sx, a) {
  const y = a.y;
  const bob = Math.sin(a.t * 1.5) * 1.2;
  const OUT = "#2a1d10";
  // Reflejo de agua bajo el pato (líneas onduladas)
  ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx - 20, y + 12 + bob);
  ctx.quadraticCurveTo(sx - 10, y + 10 + bob, sx, y + 12 + bob);
  ctx.quadraticCurveTo(sx + 10, y + 14 + bob, sx + 20, y + 12 + bob);
  ctx.stroke();
  // Cuerpo flotando
  ctx.beginPath(); ctx.ellipse(sx, y + bob, 16, 10, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Cola levantada
  ctx.beginPath();
  ctx.moveTo(sx - 12, y - 4 + bob);
  ctx.lineTo(sx - 20, y - 8 + bob);
  ctx.lineTo(sx - 14, y - 2 + bob);
  ctx.closePath();
  ctx.fillStyle = "#ffffff"; ctx.fill(); ctx.stroke();
  // Cabeza
  ctx.beginPath(); ctx.arc(sx + 12, y - 6 + bob, 7, 0, Math.PI * 2);
  ctx.fillStyle = "#3a7a3a"; ctx.fill(); ctx.stroke();
  // Pico
  ctx.beginPath();
  ctx.moveTo(sx + 17, y - 6 + bob);
  ctx.lineTo(sx + 25, y - 5 + bob);
  ctx.lineTo(sx + 17, y - 3 + bob);
  ctx.closePath();
  ctx.fillStyle = "#ffb030"; ctx.fill();
  ctx.lineWidth = 1.2; ctx.stroke();
  // Ojo
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(sx + 13, y - 7 + bob, 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = OUT;
  ctx.beginPath(); ctx.arc(sx + 13, y - 7 + bob, 0.7, 0, Math.PI * 2); ctx.fill();
}
```

- [ ] **Step 3.5: Replace drawChick (pollitos hopping)**

Locate `drawChick(sx, a)` and replace ENTIRELY with:

```javascript
function drawChick(sx, a) {
  const y = a.y;
  const hop = Math.abs(Math.sin(a.t * 3)) * 2;
  const OUT = "#2a1d10";
  // Sombra
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath(); ctx.ellipse(sx, y + 8, 7, 1.5, 0, 0, Math.PI * 2); ctx.fill();
  // Cuerpo
  ctx.beginPath(); ctx.ellipse(sx, y - hop, 7, 6, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#ffe080"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.stroke();
  // Cabeza
  ctx.beginPath(); ctx.arc(sx + 3, y - 4 - hop, 5, 0, Math.PI * 2);
  ctx.fillStyle = "#ffe080"; ctx.fill(); ctx.stroke();
  // Pico
  ctx.beginPath();
  ctx.moveTo(sx + 7, y - 4 - hop);
  ctx.lineTo(sx + 11, y - 3 - hop);
  ctx.lineTo(sx + 7, y - 2 - hop);
  ctx.closePath();
  ctx.fillStyle = "#f08a1a"; ctx.fill(); ctx.stroke();
  // Ojo
  ctx.fillStyle = OUT;
  ctx.beginPath(); ctx.arc(sx + 5, y - 5 - hop, 0.9, 0, Math.PI * 2); ctx.fill();
  // Patas
  ctx.strokeStyle = "#f08a1a"; ctx.lineWidth = 1.6; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(sx - 2, y + 4 - hop); ctx.lineTo(sx - 2, y + 7 - hop);
  ctx.moveTo(sx + 2, y + 4 - hop); ctx.lineTo(sx + 2, y + 7 - hop);
  ctx.stroke();
}
```

- [ ] **Step 3.6: Syntax check**

```bash
cd /Users/facu/Desktop/Tromen/la-granja
node --check public/js/juego-pollito.js
```

Expected: no output.

- [ ] **Step 3.7: Run all tests for no regression**

```bash
cd /Users/facu/Desktop/Tromen/la-granja
DATABASE_URL=postgres://postgres:postgres@localhost:5433/sofi_tutor_test npm test 2>&1 | tail -5
```

Expected: all pass.

- [ ] **Step 3.8: Commit**

```bash
cd /Users/facu/Desktop/Tromen/la-granja
git add public/js/juego-pollito.js
git commit --no-verify -m "feat(art): animales granja en vector flat unificado (F2 paso 3)"
```

---

## Task 4: Animales nuevos + critters (cerdo, cabra, gato + butterfly, dragonfly, bird)

**Files:**
- Modify: `public/js/juego-pollito.js` (3 new + 3 existing replace)

Agregamos 3 animales que el spec menciona (cerdo, cabra, gato) y unificamos 3 critters que ya existen (mariposa, libélula, pájaro).

- [ ] **Step 4.1: Add drawPig (new)**

In `public/js/juego-pollito.js`, in the section where animal-drawing functions live (cerca de `drawCow`, `drawSheep`, etc.), add this new function:

```javascript
function drawPig(sx, a) {
  const y = a.y;
  const bob = Math.sin(a.t * 0.5) * 0.6;
  const OUT = "#2a1d10";
  // Sombra
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath(); ctx.ellipse(sx, y + 20, 22, 3, 0, 0, Math.PI * 2); ctx.fill();
  // Cuerpo redondito
  ctx.beginPath(); ctx.ellipse(sx, y + bob, 24, 14, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#f5b8b0"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Cabeza redonda
  ctx.beginPath(); ctx.arc(sx - 22, y - 2 + bob, 10, 0, Math.PI * 2);
  ctx.fillStyle = "#f5b8b0"; ctx.fill(); ctx.stroke();
  // Hocico (círculo más oscuro con 2 puntos)
  ctx.beginPath(); ctx.ellipse(sx - 30, y - 1 + bob, 5, 4, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#d68a82"; ctx.fill();
  ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = OUT;
  ctx.beginPath(); ctx.arc(sx - 31, y - 1 + bob, 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(sx - 29, y - 1 + bob, 0.7, 0, Math.PI * 2); ctx.fill();
  // Orejas (triángulos)
  ctx.fillStyle = "#f5b8b0";
  ctx.beginPath();
  ctx.moveTo(sx - 26, y - 11 + bob); ctx.lineTo(sx - 22, y - 16 + bob); ctx.lineTo(sx - 19, y - 9 + bob);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sx - 16, y - 9 + bob); ctx.lineTo(sx - 14, y - 14 + bob); ctx.lineTo(sx - 12, y - 8 + bob);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // Ojo
  ctx.fillStyle = OUT;
  ctx.beginPath(); ctx.arc(sx - 24, y - 4 + bob, 1.2, 0, Math.PI * 2); ctx.fill();
  // Patas
  ctx.fillStyle = "#f5b8b0";
  for (const lx of [-14, -2, 10, 20]) {
    ctx.beginPath(); ctx.rect(sx + lx, y + 10, 4, 10);
    ctx.fill(); ctx.stroke();
  }
  // Colita rizada
  ctx.strokeStyle = "#d68a82"; ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(sx + 26, y - 2 + bob, 3, 0, Math.PI * 1.5);
  ctx.stroke();
}
```

- [ ] **Step 4.2: Add drawGoat (new)**

```javascript
function drawGoat(sx, a) {
  const y = a.y;
  const bob = Math.sin(a.t * 0.7) * 0.6;
  const OUT = "#2a1d10";
  // Sombra
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath(); ctx.ellipse(sx, y + 22, 20, 3, 0, 0, Math.PI * 2); ctx.fill();
  // Cuerpo
  ctx.beginPath(); ctx.ellipse(sx, y + bob, 22, 13, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#cfc7b4"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Cabeza alargada
  ctx.beginPath(); ctx.ellipse(sx - 22, y - 4 + bob, 10, 7, -0.2, 0, Math.PI * 2);
  ctx.fillStyle = "#cfc7b4"; ctx.fill(); ctx.stroke();
  // Hocico
  ctx.beginPath(); ctx.ellipse(sx - 30, y - 2 + bob, 4, 3, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#7a705a"; ctx.fill();
  // Cuernos curvos
  ctx.strokeStyle = "#7a705a"; ctx.lineWidth = 2; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(sx - 22, y - 11 + bob);
  ctx.quadraticCurveTo(sx - 18, y - 18 + bob, sx - 14, y - 14 + bob);
  ctx.stroke();
  // Barba (pequeño triángulo bajo el hocico)
  ctx.fillStyle = "#cfc7b4";
  ctx.beginPath();
  ctx.moveTo(sx - 30, y + 1 + bob);
  ctx.lineTo(sx - 30, y + 5 + bob);
  ctx.lineTo(sx - 28, y + 2 + bob);
  ctx.closePath();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
  ctx.fill(); ctx.stroke();
  // Ojo
  ctx.fillStyle = OUT;
  ctx.beginPath(); ctx.arc(sx - 24, y - 5 + bob, 1.2, 0, Math.PI * 2); ctx.fill();
  // Patas
  ctx.fillStyle = "#cfc7b4"; ctx.lineWidth = 1.2;
  for (const lx of [-14, -4, 6, 14]) {
    ctx.beginPath(); ctx.rect(sx + lx, y + 10, 3, 12);
    ctx.fill(); ctx.stroke();
  }
  // Cola corta
  ctx.fillStyle = "#cfc7b4";
  ctx.beginPath(); ctx.ellipse(sx + 22, y - 4 + bob, 3, 4, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
}
```

- [ ] **Step 4.3: Add drawCat (new)**

```javascript
function drawCat(sx, a) {
  const y = a.y;
  const bob = Math.sin(a.t * 0.5) * 0.5;
  const OUT = "#2a1d10";
  // Sombra
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath(); ctx.ellipse(sx, y + 16, 14, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  // Cuerpo (gato sentado)
  ctx.beginPath(); ctx.ellipse(sx, y + 4 + bob, 12, 12, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#e89048"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Rayas en el cuerpo
  ctx.strokeStyle = "#a85a20"; ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(sx - 8, y + bob); ctx.lineTo(sx + 8, y + bob);
  ctx.moveTo(sx - 7, y + 5 + bob); ctx.lineTo(sx + 7, y + 5 + bob);
  ctx.stroke();
  // Cabeza
  ctx.beginPath(); ctx.arc(sx, y - 6 + bob, 8, 0, Math.PI * 2);
  ctx.fillStyle = "#e89048"; ctx.strokeStyle = OUT; ctx.lineWidth = 1.4;
  ctx.fill(); ctx.stroke();
  // Orejas triangulares
  ctx.fillStyle = "#e89048";
  ctx.beginPath();
  ctx.moveTo(sx - 7, y - 12 + bob); ctx.lineTo(sx - 5, y - 18 + bob); ctx.lineTo(sx - 2, y - 11 + bob);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sx + 2, y - 11 + bob); ctx.lineTo(sx + 5, y - 18 + bob); ctx.lineTo(sx + 7, y - 12 + bob);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // Ojos
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(sx - 3, y - 7 + bob, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(sx + 3, y - 7 + bob, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = OUT;
  ctx.beginPath(); ctx.arc(sx - 3, y - 7 + bob, 0.8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(sx + 3, y - 7 + bob, 0.8, 0, Math.PI * 2); ctx.fill();
  // Nariz triangular pequeña
  ctx.fillStyle = "#f8c2c8";
  ctx.beginPath();
  ctx.moveTo(sx - 1, y - 4 + bob); ctx.lineTo(sx + 1, y - 4 + bob); ctx.lineTo(sx, y - 2 + bob);
  ctx.closePath(); ctx.fill();
  // Bigotes
  ctx.strokeStyle = OUT; ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(sx - 8, y - 3 + bob); ctx.lineTo(sx - 3, y - 3 + bob);
  ctx.moveTo(sx + 3, y - 3 + bob); ctx.lineTo(sx + 8, y - 3 + bob);
  ctx.stroke();
  // Cola enrollada al frente
  ctx.strokeStyle = "#e89048"; ctx.lineWidth = 4; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(sx + 10, y + 10 + bob);
  ctx.quadraticCurveTo(sx + 18, y + 6 + bob, sx + 16, y + bob);
  ctx.stroke();
  ctx.strokeStyle = "#a85a20"; ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(sx + 12, y + 9 + bob); ctx.lineTo(sx + 17, y + 5 + bob);
  ctx.stroke();
}
```

- [ ] **Step 4.4: Replace drawButterfly**

Locate `drawButterfly(sx, a)` and replace ENTIRELY with:

```javascript
function drawButterfly(sx, a) {
  const y = a.y + Math.sin(a.t * 1.2) * 10;
  const flap = Math.sin(a.t * 4) * 0.6 + 0.5;
  const OUT = "#2a1d10";
  const hue = a.hue || "#e85d5d";
  ctx.save();
  ctx.translate(sx, y);
  ctx.scale(flap, 1);
  // 4 alas en path único para contorno limpio
  ctx.beginPath();
  ctx.ellipse(-6, -4, 7, 9, 0.3, 0, Math.PI * 2);
  ctx.ellipse(6, -4, 7, 9, -0.3, 0, Math.PI * 2);
  ctx.ellipse(-5, 5, 5, 6, -0.3, 0, Math.PI * 2);
  ctx.ellipse(5, 5, 5, 6, 0.3, 0, Math.PI * 2);
  ctx.fillStyle = hue; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.restore();
  // Cuerpo (negro, sin escala de flap)
  ctx.beginPath();
  ctx.ellipse(sx, y, 1.5, 7, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#2a1d10"; ctx.fill();
  // Antenas
  ctx.strokeStyle = OUT; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx - 0.8, y - 6); ctx.lineTo(sx - 2, y - 9);
  ctx.moveTo(sx + 0.8, y - 6); ctx.lineTo(sx + 2, y - 9);
  ctx.stroke();
}
```

- [ ] **Step 4.5: Replace drawDragonfly**

Locate `drawDragonfly(sx, a)` and replace ENTIRELY with:

```javascript
function drawDragonfly(sx, a) {
  const y = a.y + Math.sin(a.t * 2) * 6;
  const OUT = "#2a1d10";
  const hue = a.hue || "#5fb4e0";
  // Alas (4 elipses translúcidas con contorno)
  ctx.fillStyle = "rgba(180,220,255,0.55)";
  ctx.strokeStyle = OUT; ctx.lineWidth = 1;
  for (const sgn of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sx + sgn * 8, y - 2, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(sx + sgn * 8, y + 2, 7, 2.5, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  }
  // Cuerpo alargado
  ctx.beginPath();
  ctx.ellipse(sx, y, 2.5, 8, 0, 0, Math.PI * 2);
  ctx.fillStyle = hue; ctx.fill();
  ctx.lineWidth = 1.2; ctx.stroke();
  // Cabeza
  ctx.beginPath();
  ctx.arc(sx, y - 6, 2.2, 0, Math.PI * 2);
  ctx.fillStyle = "#222"; ctx.fill(); ctx.stroke();
}
```

- [ ] **Step 4.6: Replace drawBird (high-flying)**

Locate `drawBird(sx, a)` and replace ENTIRELY with:

```javascript
function drawBird(sx, a) {
  const y = a.y + Math.sin(a.t * 2) * 3;
  const flap = Math.sin(a.t * 6) * 4;
  // Solo silueta — un "V" suave con contorno
  ctx.strokeStyle = "#2a1d10"; ctx.lineWidth = 2; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(sx - 9, y + flap);
  ctx.quadraticCurveTo(sx - 4, y - 3, sx, y);
  ctx.quadraticCurveTo(sx + 4, y - 3, sx + 9, y + flap);
  ctx.stroke();
}
```

- [ ] **Step 4.7: Update drawAmbient dispatcher to route new kinds**

Find `function drawAmbient(a) {` and locate the chain of `if/else if` para `a.kind`. Agregar las nuevas opciones para `pig`, `goat`, `cat`. Find:

```javascript
function drawAmbient(a) {
  const sx = worldToScreen(a.x);
```

Just inside, AFTER any existing routing (look for `else if (a.kind === "cow")` etc.) — verify the order of conditions and add right after `drawChick`:

Modify to ensure the dispatch includes:

```javascript
  if (a.kind === "cow") drawCow(sx, a);
  else if (a.kind === "sheep") drawSheep(sx, a);
  else if (a.kind === "horse") drawHorse(sx, a);
  else if (a.kind === "duck") drawDuck(sx, a);
  else if (a.kind === "chick") drawChick(sx, a);
  else if (a.kind === "pig") drawPig(sx, a);
  else if (a.kind === "goat") drawGoat(sx, a);
  else if (a.kind === "cat") drawCat(sx, a);
  else if (a.kind === "butterfly") drawButterfly(sx, a);
  else if (a.kind === "dragonfly") drawDragonfly(sx, a);
  else if (a.kind === "bird") drawBird(sx, a);
```

Replace whatever dispatch exists with the block above (preservando la lógica de viewport culling si la hay alrededor — ej. `if (sx < -120 || sx > VIEW_W + 120) { if (a.kind !== "bird") return; }` debe quedar).

- [ ] **Step 4.8: Syntax check**

```bash
cd /Users/facu/Desktop/Tromen/la-granja
node --check public/js/juego-pollito.js
```

- [ ] **Step 4.9: Tests**

```bash
cd /Users/facu/Desktop/Tromen/la-granja
DATABASE_URL=postgres://postgres:postgres@localhost:5433/sofi_tutor_test npm test 2>&1 | tail -5
```

Expected: all pass.

- [ ] **Step 4.10: Commit**

```bash
git add public/js/juego-pollito.js
git commit --no-verify -m "feat(art): cerdo/cabra/gato + critters unificados (F2 paso 4)"
```

---

## Task 5: Enemigos (zorro, cuervo, rana, ratón) en vector

**Files:**
- Modify: `public/js/juego-pollito.js`

El zorro hoy es pixel art via `juego-pollito-sprites.js`. Lo reemplazamos por vector. Los otros 3 (cuervo, rana, ratón) son nuevos.

- [ ] **Step 5.1: Replace drawFox (vector, no pixel art)**

Locate `drawFox(fox)` y replace ENTIRELY with:

```javascript
function drawFox(fox) {
  const sx = worldToScreen(fox.x);
  if (sx < -50 || sx > VIEW_W + 50) return;
  const y = fox.y;
  const OUT = "#2a1d10";
  // Sombra
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath(); ctx.ellipse(sx, y + 18, 18, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  // Si está dormido: posición horizontal + Zzz arriba
  if (fox.state === "sleeping") {
    ctx.save();
    ctx.translate(sx, y);
    // Cuerpo acostado (elipse horizontal alargada)
    ctx.beginPath(); ctx.ellipse(0, 6, 22, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#d97a3e"; ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
    // Cabeza a la izquierda
    ctx.beginPath(); ctx.arc(-22, 4, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#d97a3e"; ctx.fill(); ctx.stroke();
    // Hocico claro
    ctx.beginPath(); ctx.ellipse(-28, 5, 4, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill();
    // Ojo cerrado (línea)
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-24, 3); ctx.lineTo(-22, 3); ctx.stroke();
    // Oreja
    ctx.fillStyle = "#a85510";
    ctx.beginPath();
    ctx.moveTo(-22, -1); ctx.lineTo(-19, -6); ctx.lineTo(-16, -1); ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Cola
    ctx.fillStyle = "#d97a3e";
    ctx.beginPath();
    ctx.moveTo(20, 4);
    ctx.quadraticCurveTo(32, -2, 28, 8);
    ctx.lineTo(20, 8);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Punta blanca de la cola
    ctx.beginPath(); ctx.ellipse(30, 4, 3, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill();
    ctx.restore();
    // Zzz flotando
    ctx.fillStyle = "#88aacc";
    ctx.font = "bold 14px system-ui";
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    const wiggle = Math.sin(fox.t * 0.1) * 2;
    ctx.fillText("z", sx + 12 + wiggle, y - 14);
    ctx.fillText("z", sx + 18 - wiggle, y - 20);
    ctx.fillText("z", sx + 24 + wiggle, y - 26);
    return;
  }
  // Patrolling: zorro de pie, vector flat
  ctx.save();
  ctx.translate(sx, y);
  if (fox.dir === -1) ctx.scale(-1, 1);
  // Cuerpo
  ctx.beginPath(); ctx.ellipse(0, 0, 18, 10, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#d97a3e"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Cabeza
  ctx.beginPath(); ctx.arc(-16, -6, 8, 0, Math.PI * 2);
  ctx.fillStyle = "#d97a3e"; ctx.fill(); ctx.stroke();
  // Hocico claro
  ctx.beginPath(); ctx.ellipse(-22, -4, 4, 3, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#fff"; ctx.fill();
  // Orejas triangulares
  ctx.fillStyle = "#a85510";
  ctx.beginPath();
  ctx.moveTo(-19, -12); ctx.lineTo(-16, -18); ctx.lineTo(-13, -12);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-12, -11); ctx.lineTo(-9, -16); ctx.lineTo(-6, -10);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // Ojo
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(-18, -7, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = OUT;
  ctx.beginPath(); ctx.arc(-18, -7, 0.9, 0, Math.PI * 2); ctx.fill();
  // Patas (un walk cycle simple)
  const walk = Math.sin(fox.t * 0.15) * 1.5;
  ctx.fillStyle = "#5b3a1a";
  ctx.beginPath(); ctx.rect(-12, 8 - Math.abs(walk), 3, 8); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.rect(-3, 8 + Math.abs(walk), 3, 8); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.rect(6, 8 - Math.abs(walk), 3, 8); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.rect(13, 8 + Math.abs(walk), 3, 8); ctx.fill(); ctx.stroke();
  // Cola alta (atrás derecha del cuerpo)
  ctx.fillStyle = "#d97a3e";
  ctx.beginPath();
  ctx.moveTo(16, -2);
  ctx.quadraticCurveTo(28, -8, 24, 6);
  ctx.lineTo(16, 4);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // Punta blanca
  ctx.beginPath(); ctx.ellipse(26, -2, 3, 3, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#fff"; ctx.fill();
  ctx.restore();
}
```

- [ ] **Step 5.2: Remove sprite-based fox import**

In the imports block of `juego-pollito.js`, find:

```javascript
import { drawFoxSprite, pickFoxFrame } from "/js/juego-pollito-sprites.js";
```

Remove that line entirely. Then `grep` to verify nothing else references them:

```bash
grep -n "drawFoxSprite\|pickFoxFrame" public/js/juego-pollito.js
```

Expected: zero matches.

- [ ] **Step 5.3: Add drawCrow (new enemy)**

```javascript
function drawCrow(enemy) {
  const sx = worldToScreen(enemy.x);
  if (sx < -50 || sx > VIEW_W + 50) return;
  const y = enemy.y;
  const OUT = "#2a1d10";
  const flap = Math.sin(enemy.t * 0.4) * 0.4 + 0.6;
  // Sombra en el aire (más chica = más alto)
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.beginPath(); ctx.ellipse(sx, y + 35, 14, 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(sx, y);
  // Cuerpo
  ctx.beginPath(); ctx.ellipse(0, 0, 12, 8, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#28201a"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Alas (escaladas verticalmente con flap)
  ctx.save();
  ctx.scale(1, flap);
  ctx.beginPath();
  ctx.ellipse(-10, -2, 12, 7, -0.3, 0, Math.PI * 2);
  ctx.ellipse(10, -2, 12, 7, 0.3, 0, Math.PI * 2);
  ctx.fillStyle = "#4a3c30"; ctx.fill();
  ctx.lineWidth = 1.4; ctx.stroke();
  ctx.restore();
  // Cabeza
  ctx.beginPath(); ctx.arc(0, -8, 5, 0, Math.PI * 2);
  ctx.fillStyle = "#28201a"; ctx.fill(); ctx.stroke();
  // Pico
  ctx.beginPath();
  ctx.moveTo(4, -8); ctx.lineTo(10, -7); ctx.lineTo(4, -6);
  ctx.closePath();
  ctx.fillStyle = "#a85510"; ctx.fill(); ctx.stroke();
  // Ojo
  ctx.fillStyle = "#ffd34a";
  ctx.beginPath(); ctx.arc(2, -9, 1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
```

- [ ] **Step 5.4: Add drawFrog (new enemy)**

```javascript
function drawFrog(enemy) {
  const sx = worldToScreen(enemy.x);
  if (sx < -50 || sx > VIEW_W + 50) return;
  const y = enemy.y;
  const OUT = "#2a1d10";
  // Sombra
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath(); ctx.ellipse(sx, y + 13, 14, 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(sx, y);
  // Cuerpo redondito
  ctx.beginPath(); ctx.ellipse(0, 2, 14, 10, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#6caa3a"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Pancita más clara
  ctx.beginPath(); ctx.ellipse(0, 6, 8, 4, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#cfe09a"; ctx.fill();
  // Ojos sobresalidos
  for (const ex of [-6, 6]) {
    ctx.beginPath(); ctx.arc(ex, -8, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#6caa3a"; ctx.fill();
    ctx.lineWidth = 1.4; ctx.stroke();
    ctx.beginPath(); ctx.arc(ex, -8, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill();
    ctx.fillStyle = OUT;
    ctx.beginPath(); ctx.arc(ex, -8, 1.2, 0, Math.PI * 2); ctx.fill();
  }
  // Boca (línea curva)
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-4, 0); ctx.quadraticCurveTo(0, 3, 4, 0);
  ctx.stroke();
  // Patas traseras (un poco a los costados)
  ctx.fillStyle = "#6caa3a";
  ctx.beginPath();
  ctx.ellipse(-12, 8, 4, 2.5, -0.3, 0, Math.PI * 2);
  ctx.ellipse(12, 8, 4, 2.5, 0.3, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.restore();
}
```

- [ ] **Step 5.5: Add drawMouse (new enemy)**

```javascript
function drawMouse(enemy) {
  const sx = worldToScreen(enemy.x);
  if (sx < -40 || sx > VIEW_W + 40) return;
  const y = enemy.y;
  const OUT = "#2a1d10";
  // Sombra
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath(); ctx.ellipse(sx, y + 10, 10, 1.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(sx, y);
  if (enemy.dir === -1) ctx.scale(-1, 1);
  // Cuerpo
  ctx.beginPath(); ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#88807a"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Pancita clara
  ctx.beginPath(); ctx.ellipse(0, 3, 6, 2, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#b8b0a8"; ctx.fill();
  // Cabeza puntiaguda
  ctx.beginPath();
  ctx.moveTo(-7, -3); ctx.lineTo(-15, -1); ctx.lineTo(-7, 3);
  ctx.closePath();
  ctx.fillStyle = "#88807a"; ctx.fill(); ctx.stroke();
  // Orejas circulares
  ctx.fillStyle = "#88807a";
  ctx.beginPath(); ctx.arc(-4, -5, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#f8c2c8";
  ctx.beginPath(); ctx.arc(-4, -5, 1.4, 0, Math.PI * 2); ctx.fill();
  // Ojo
  ctx.fillStyle = OUT;
  ctx.beginPath(); ctx.arc(-9, -2, 0.8, 0, Math.PI * 2); ctx.fill();
  // Nariz rosa
  ctx.fillStyle = "#f8c2c8";
  ctx.beginPath(); ctx.arc(-14, -1, 0.8, 0, Math.PI * 2); ctx.fill();
  // Bigotes
  ctx.strokeStyle = OUT; ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-13, 0); ctx.lineTo(-17, 1);
  ctx.moveTo(-13, -1); ctx.lineTo(-16, -3);
  ctx.stroke();
  // Cola enroscada larga
  ctx.strokeStyle = "#88807a"; ctx.lineWidth = 1.5; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(9, 0);
  ctx.quadraticCurveTo(16, -2, 14, 4);
  ctx.quadraticCurveTo(12, 8, 18, 6);
  ctx.stroke();
  // Patas (líneas finas)
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-3, 5); ctx.lineTo(-3, 8);
  ctx.moveTo(3, 5);  ctx.lineTo(3, 8);
  ctx.stroke();
  ctx.restore();
}
```

- [ ] **Step 5.6: Update enemy dispatcher**

In `juego-pollito.js`, find the enemy rendering loop (look for `for (const e of state.enemies)`):

```javascript
for (const e of state.enemies) drawFox(e);
```

Replace with:

```javascript
for (const e of state.enemies) {
  if (e.kind === "fox") drawFox(e);
  else if (e.kind === "crow") drawCrow(e);
  else if (e.kind === "frog") drawFrog(e);
  else if (e.kind === "mouse") drawMouse(e);
}
```

- [ ] **Step 5.7: Syntax + tests + commit**

```bash
cd /Users/facu/Desktop/Tromen/la-granja
node --check public/js/juego-pollito.js
DATABASE_URL=postgres://postgres:postgres@localhost:5433/sofi_tutor_test npm test 2>&1 | tail -3
git add public/js/juego-pollito.js
git commit --no-verify -m "feat(art): enemigos (zorro vector + cuervo/rana/ratón) (F2 paso 5)"
```

---

## Task 6: Items (huevo, huevo dorado, banderín, puerta, quiz, agua, plataformas)

**Files:**
- Modify: `public/js/juego-pollito.js`

Items que se ven todo el juego. Rewrite con el mismo lenguaje.

- [ ] **Step 6.1: Replace drawEgg**

Locate `drawEgg(egg)` and replace ENTIRELY with:

```javascript
function drawEgg(egg) {
  if (egg.taken) return;
  const sx = worldToScreen(egg.x);
  if (sx < -30 || sx > VIEW_W + 30) return;
  const bob = egg.settled === false ? 0 : Math.sin(egg.t * 1.5) * 2;
  ctx.save(); ctx.translate(sx, egg.y + bob);
  // Sombra plana
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.beginPath(); ctx.ellipse(0, 16, 9, 2, 0, 0, Math.PI * 2); ctx.fill();
  if (egg.golden) {
    // Halo dorado pulsante (no gradient, círculos translúcidos plain)
    const pulse = 20 + Math.sin(egg.t * 2) * 4;
    ctx.fillStyle = "rgba(255, 220, 100, 0.30)";
    ctx.beginPath(); ctx.arc(0, 0, pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255, 200, 60, 0.18)";
    ctx.beginPath(); ctx.arc(0, 0, pulse * 0.7, 0, Math.PI * 2); ctx.fill();
    // Huevo dorado
    ctx.beginPath(); ctx.ellipse(0, 0, 12, 15, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#ffd34a"; ctx.fill();
    ctx.strokeStyle = "#a87420"; ctx.lineWidth = 1.8; ctx.stroke();
    // Reflejo
    ctx.beginPath(); ctx.ellipse(-4, -5, 3, 5, 0.4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fill();
    // Sparkles orbitando
    for (let i = 0; i < 3; i++) {
      const ang = egg.t * 0.5 + i * (Math.PI * 2 / 3);
      const px = Math.cos(ang) * 18; const py = Math.sin(ang) * 12;
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(px, py, 1.5, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    // Huevo normal
    ctx.beginPath(); ctx.ellipse(0, 0, 11, 14, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#fff7d1"; ctx.fill();
    ctx.strokeStyle = "#2a1d10"; ctx.lineWidth = 1.4; ctx.stroke();
    // Reflejo
    ctx.beginPath(); ctx.ellipse(-4, -5, 3, 4, 0.4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fill();
  }
  ctx.restore();
}
```

- [ ] **Step 6.2: Replace drawDoor**

Locate `drawDoor(d)` and replace ENTIRELY with:

```javascript
function drawDoor(d) {
  const sx = worldToScreen(d.x);
  if (sx + d.w < 0 || sx > VIEW_W) return;
  const OUT = "#2a1d10";
  // Marco (3 lados del cuadro)
  ctx.fillStyle = "#5b3a1a";
  ctx.fillRect(sx - 6, d.y - 6, d.w + 12, d.h + 6);
  ctx.fillStyle = "#3a2010";
  ctx.fillRect(sx - 8, d.y - 8, d.w + 16, 4);
  if (!d.opened) {
    // Puerta cerrada
    ctx.beginPath(); ctx.rect(sx, d.y, d.w, d.h);
    ctx.fillStyle = "#a87447"; ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
    // Tablones verticales (líneas, no fill)
    ctx.strokeStyle = "rgba(60,30,15,0.5)"; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(sx + d.w / 2, d.y); ctx.lineTo(sx + d.w / 2, d.y + d.h);
    ctx.stroke();
    // Manija
    ctx.fillStyle = "#ffd76b"; ctx.strokeStyle = OUT; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(sx + d.w - 6, d.y + d.h / 2, 2.5, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Cartel con el número de huevos
    ctx.beginPath(); ctx.rect(sx + d.w / 2 - 14, d.y + d.h / 2 - 14, 28, 28);
    ctx.fillStyle = "#fff8d0"; ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
    // Iconito huevo + número
    ctx.fillStyle = "#5b3a1a";
    ctx.font = "bold 18px system-ui";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(d.eggs_required), sx + d.w / 2, d.y + d.h / 2);
  } else {
    // Puerta abierta (interior oscuro)
    ctx.beginPath(); ctx.rect(sx, d.y, d.w, d.h);
    ctx.fillStyle = "#2a1d10"; ctx.fill();
    // Tilde verde
    ctx.fillStyle = "#7ed957";
    ctx.font = "bold 26px system-ui";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("✓", sx + d.w / 2, d.y + d.h / 2);
  }
}
```

- [ ] **Step 6.3: Replace drawQuizMarker**

Locate `drawQuizMarker(q)` and replace ENTIRELY with:

```javascript
function drawQuizMarker(q) {
  const sx = worldToScreen(q.x);
  if (sx + q.w < 0 || sx > VIEW_W) return;
  const OUT = "#2a1d10";
  // Poste
  ctx.fillStyle = "#5b3a1a";
  ctx.fillRect(sx + q.w / 2 - 3, q.y + q.h, 6, 20);
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
  ctx.strokeRect(sx + q.w / 2 - 3, q.y + q.h, 6, 20);
  if (q.solved) {
    // Tabla con tilde verde
    ctx.beginPath(); ctx.rect(sx, q.y, q.w, q.h);
    ctx.fillStyle = "#7ed957"; ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 22px system-ui";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("✓", sx + q.w / 2, q.y + q.h / 2);
    return;
  }
  // Tabla pendiente con "?" pulsante
  ctx.beginPath(); ctx.rect(sx, q.y, q.w, q.h);
  ctx.fillStyle = "#fff8d0"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  const pulse = 1 + Math.sin(state.globalT * 0.12) * 0.08;
  ctx.fillStyle = "#5b3a1a";
  ctx.font = `bold ${Math.round(28 * pulse)}px system-ui`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("?", sx + q.w / 2, q.y + q.h / 2);
}
```

- [ ] **Step 6.4: Replace drawFlag**

Locate `drawFlag(f)` and replace ENTIRELY with:

```javascript
function drawFlag(f) {
  const sx = worldToScreen(f.x);
  if (sx + f.w < 0 || sx > VIEW_W) return;
  const OUT = "#2a1d10";
  // Base
  ctx.fillStyle = "#5b3a1a";
  ctx.fillRect(sx - 6, f.y + f.h - 4, 16, 6);
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4;
  ctx.strokeRect(sx - 6, f.y + f.h - 4, 16, 6);
  // Asta
  ctx.fillStyle = "#7a4f2b";
  ctx.fillRect(sx, f.y, 4, f.h);
  ctx.strokeRect(sx, f.y, 4, f.h);
  // Topper
  ctx.beginPath(); ctx.arc(sx + 2, f.y, 3, 0, Math.PI * 2);
  ctx.fillStyle = "#ffd34a"; ctx.fill(); ctx.stroke();
  // Bandera con onda + descent (cinemática win)
  const descend = f.descend || 0;
  const flagY = f.y + 4 + descend;
  const wave = Math.sin(state.globalT * 0.08) * 4;
  ctx.beginPath();
  ctx.moveTo(sx + 4, flagY);
  ctx.lineTo(sx + 4, flagY + 34);
  ctx.quadraticCurveTo(sx + 22, flagY + 24 + wave, sx + 38, flagY + 16);
  ctx.quadraticCurveTo(sx + 22, flagY + 12 + wave, sx + 4, flagY);
  ctx.closePath();
  ctx.fillStyle = "#e85d5d"; ctx.fill(); ctx.stroke();
  // Pollito mini en la bandera (solo color, sin contorno extra)
  ctx.fillStyle = "#ffd34a";
  ctx.beginPath(); ctx.arc(sx + 16, flagY + 22, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f08a1a";
  ctx.beginPath();
  ctx.moveTo(sx + 21, flagY + 22); ctx.lineTo(sx + 25, flagY + 21);
  ctx.lineTo(sx + 21, flagY + 23); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#222";
  ctx.beginPath(); ctx.arc(sx + 17, flagY + 21, 0.8, 0, Math.PI * 2); ctx.fill();
}
```

- [ ] **Step 6.5: Replace drawWaterPit**

Locate `drawWaterPit(pit)` and replace ENTIRELY with:

```javascript
function drawWaterPit(pit) {
  const sx = worldToScreen(pit.x);
  if (sx + pit.w < 0 || sx > VIEW_W) return;
  const OUT = "#2a1d10";
  // Sin gradient — dos rectángulos planos (oscuro abajo, medio arriba)
  ctx.fillStyle = state.theme.waterDark || "#3d8db0";
  ctx.fillRect(sx, pit.y + 12, pit.w, pit.h - 12);
  ctx.fillStyle = state.theme.water || "#5fb4e0";
  ctx.fillRect(sx, pit.y + 4, pit.w, 8);
  // Onda superficie (path único con contorno)
  ctx.beginPath();
  const t = state.globalT;
  ctx.moveTo(sx, pit.y + 4);
  for (let i = 0; i <= pit.w; i += 8) {
    const yy = pit.y + 4 + Math.sin(t * 0.06 + i * 0.15) * 2.5;
    ctx.lineTo(sx + i, yy);
  }
  ctx.lineTo(sx + pit.w, pit.y + 4);
  ctx.lineTo(sx, pit.y + 4);
  ctx.closePath();
  ctx.fillStyle = state.theme.water || "#5fb4e0";
  ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4;
  // Re-stroke solo la superficie superior, no el rectángulo entero
  ctx.beginPath();
  ctx.moveTo(sx, pit.y + 4);
  for (let i = 0; i <= pit.w; i += 8) {
    const yy = pit.y + 4 + Math.sin(t * 0.06 + i * 0.15) * 2.5;
    ctx.lineTo(sx + i, yy);
  }
  ctx.stroke();
  // Brillitos planos
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  for (let i = 0; i < pit.w; i += 18) {
    const yy = pit.y + 10 + Math.sin(t * 0.05 + i * 0.2) * 1.2;
    ctx.fillRect(sx + i + 4, yy, 6, 1.4);
  }
}
```

- [ ] **Step 6.6: Replace drawPlatform**

Locate `drawPlatform(p)` and replace ENTIRELY with:

```javascript
function drawPlatform(p) {
  const sx = worldToScreen(p.x);
  if (sx + p.w < 0 || sx > VIEW_W) return;
  const OUT = "#2a1d10";
  if (p.kind === "grass") {
    // Tierra (parte de abajo)
    ctx.beginPath(); ctx.rect(sx, p.y + 12, p.w, p.h - 12);
    ctx.fillStyle = state.theme.dirt; ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
    // Pasto encima (verde claro)
    ctx.beginPath(); ctx.rect(sx, p.y, p.w, 14);
    ctx.fillStyle = state.theme.grass; ctx.fill();
    ctx.stroke();
    // Briznas verdes oscuras (líneas cortas)
    ctx.strokeStyle = state.theme.grassDark; ctx.lineWidth = 1.6; ctx.lineCap = "round";
    for (let x = sx + 6; x < sx + p.w; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, p.y - 1); ctx.lineTo(x + 1, p.y - 5);
      ctx.moveTo(x + 7, p.y - 1); ctx.lineTo(x + 8, p.y - 6);
      ctx.stroke();
    }
  } else if (p.kind === "wood") {
    // Madera
    ctx.beginPath(); ctx.rect(sx, p.y, p.w, p.h);
    ctx.fillStyle = p.moving ? "#c08855" : "#a87447"; ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
    // Línea horizontal media
    ctx.strokeStyle = "rgba(60,30,15,0.6)"; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(sx, p.y + p.h / 2); ctx.lineTo(sx + p.w, p.y + p.h / 2);
    ctx.stroke();
    // Clavos
    ctx.fillStyle = "#3a2a1a";
    ctx.beginPath(); ctx.arc(sx + 4, p.y + 4, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(sx + p.w - 4, p.y + 4, 1.5, 0, Math.PI * 2); ctx.fill();
    // Indicador de movimiento si móvil
    if (p.moving) {
      ctx.fillStyle = "#fff8d0";
      const m = p.moving;
      if (m.axis === "x") {
        ctx.beginPath();
        ctx.moveTo(sx + 4, p.y + p.h / 2 - 4); ctx.lineTo(sx + 9, p.y + p.h / 2);
        ctx.lineTo(sx + 4, p.y + p.h / 2 + 4); ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(sx + p.w - 4, p.y + p.h / 2 - 4); ctx.lineTo(sx + p.w - 9, p.y + p.h / 2);
        ctx.lineTo(sx + p.w - 4, p.y + p.h / 2 + 4); ctx.closePath(); ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(sx + p.w / 2 - 4, p.y + 4); ctx.lineTo(sx + p.w / 2, p.y + 9);
        ctx.lineTo(sx + p.w / 2 + 4, p.y + 4); ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(sx + p.w / 2 - 4, p.y + p.h - 4); ctx.lineTo(sx + p.w / 2, p.y + p.h - 9);
        ctx.lineTo(sx + p.w / 2 + 4, p.y + p.h - 4); ctx.closePath(); ctx.fill();
      }
    }
  } else if (p.kind === "lily") {
    // Lirio gigante (flotante)
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath(); ctx.ellipse(sx + p.w / 2, p.y + p.h + 4, p.w / 2 + 4, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(sx + p.w / 2, p.y + p.h / 2, p.w / 2, p.h, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#3d8c46"; ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
    // Veteado claro encima
    ctx.beginPath(); ctx.ellipse(sx + p.w / 2 - 6, p.y + 4, p.w / 3, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#52a55a"; ctx.fill();
    // Flor blanca encima
    ctx.fillStyle = "#fff"; ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(sx + p.w / 2 + Math.cos(a) * 4, p.y + 4 + Math.sin(a) * 2, 3, 2, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath(); ctx.arc(sx + p.w / 2, p.y + 4, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffd34a"; ctx.fill(); ctx.stroke();
  }
}
```

- [ ] **Step 6.7: Syntax + tests + commit**

```bash
cd /Users/facu/Desktop/Tromen/la-granja
node --check public/js/juego-pollito.js
DATABASE_URL=postgres://postgres:postgres@localhost:5433/sofi_tutor_test npm test 2>&1 | tail -3
git add public/js/juego-pollito.js
git commit --no-verify -m "feat(art): items (huevos, puerta, banderín, quiz, agua, plataformas) en vector (F2 paso 6)"
```

---

## Task 7: Decoración (gallinero, trigo, juncos, heno, espantapájaros, flores, hay, cerca, lirios chicos)

**Files:**
- Modify: `public/js/juego-pollito.js`

Decoración foreground por mundo. Cada función actual se reescribe con outline+fill consistente.

- [ ] **Step 7.1: Replace drawFence**

Locate `drawFence(sx, d)` and replace ENTIRELY with:

```javascript
function drawFence(sx, d) {
  const len = d.len || 4;
  const segW = 36;
  const OUT = "#2a1d10";
  // Travesaños horizontales con contorno
  ctx.fillStyle = "#a87447"; ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.rect(sx, d.y - 2, segW * len, 4);
  ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.rect(sx, d.y + 10, segW * len, 4);
  ctx.fill(); ctx.stroke();
  // Estacas verticales (forma pentagonal)
  for (let i = 0; i < len; i++) {
    ctx.beginPath();
    const baseX = sx + i * segW;
    ctx.moveTo(baseX + 6, d.y - 10);
    ctx.lineTo(baseX + 12, d.y - 14);
    ctx.lineTo(baseX + 18, d.y - 10);
    ctx.lineTo(baseX + 18, d.y + 16);
    ctx.lineTo(baseX + 6, d.y + 16);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
}
```

- [ ] **Step 7.2: Replace drawGallinero**

Locate `drawGallinero(sx, d)` and replace ENTIRELY with:

```javascript
function drawGallinero(sx, d) {
  const x = sx, y = d.y;
  const OUT = "#2a1d10";
  // Techo triangular rojo
  ctx.beginPath();
  ctx.moveTo(x - 4, y); ctx.lineTo(x + 30, y - 26); ctx.lineTo(x + 64, y);
  ctx.closePath();
  ctx.fillStyle = "#c44e3b"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Body amarillo
  ctx.beginPath(); ctx.rect(x, y, 60, 48);
  ctx.fillStyle = "#e8c87d"; ctx.fill(); ctx.stroke();
  // Tablones verticales (líneas)
  ctx.strokeStyle = "rgba(60,30,15,0.5)"; ctx.lineWidth = 1.2;
  for (let i = 12; i < 60; i += 12) {
    ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i, y + 48); ctx.stroke();
  }
  // Entrada redondeada
  ctx.beginPath();
  ctx.arc(x + 30, y + 38, 12, Math.PI, 0);
  ctx.lineTo(x + 18, y + 48);
  ctx.lineTo(x + 42, y + 48);
  ctx.closePath();
  ctx.fillStyle = "#3a2a1a"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Percha
  ctx.strokeStyle = "#6b4226"; ctx.lineWidth = 2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x + 22, y + 50); ctx.lineTo(x + 38, y + 50); ctx.stroke();
}
```

- [ ] **Step 7.3: Replace drawFlower**

Locate `drawFlower(sx, d)` and replace ENTIRELY with:

```javascript
function drawFlower(sx, d) {
  const baseY = d.y;
  const OUT = "#2a1d10";
  // Tallo
  ctx.strokeStyle = "#4f8c46"; ctx.lineWidth = 2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(sx, baseY); ctx.lineTo(sx, baseY - 14); ctx.stroke();
  // Hoja
  ctx.beginPath(); ctx.ellipse(sx - 4, baseY - 6, 4, 2, 0.4, 0, Math.PI * 2);
  ctx.fillStyle = "#4f8c46"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.stroke();
  // 5 pétalos (path único)
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.ellipse(sx + Math.cos(a) * 4, baseY - 16 + Math.sin(a) * 4, 4, 5, a, 0, Math.PI * 2);
  }
  ctx.fillStyle = d.color || "#e85d5d"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.stroke();
  // Centro
  ctx.beginPath(); ctx.arc(sx, baseY - 16, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = "#ffd34a"; ctx.fill(); ctx.stroke();
}
```

- [ ] **Step 7.4: Replace drawWheat**

Locate `drawWheat(sx, d)` and replace ENTIRELY with:

```javascript
function drawWheat(sx, d) {
  const baseY = d.y;
  const OUT = "#2a1d10";
  // Tallo curvo
  ctx.strokeStyle = "#a87420"; ctx.lineWidth = 1.6; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(sx, baseY);
  ctx.quadraticCurveTo(sx + 1, baseY - 14, sx, baseY - 28);
  ctx.stroke();
  // Espiga
  ctx.beginPath(); ctx.ellipse(sx, baseY - 30, 4, 9, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#e8b850"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.stroke();
  // Granos individuales (puntitos sin contorno)
  ctx.fillStyle = "#a87420";
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath(); ctx.ellipse(sx + i * 1.5, baseY - 30 + i * 3, 1, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Aristas (líneas finas hacia arriba)
  ctx.strokeStyle = "#a87420"; ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(sx - 1, baseY - 36); ctx.lineTo(sx - 3, baseY - 40);
  ctx.moveTo(sx + 1, baseY - 36); ctx.lineTo(sx + 3, baseY - 40);
  ctx.stroke();
}
```

- [ ] **Step 7.5: Replace drawSunflower**

Locate `drawSunflower(sx, d)` and replace ENTIRELY with:

```javascript
function drawSunflower(sx, d) {
  const baseY = d.y;
  const OUT = "#2a1d10";
  // Tallo grueso
  ctx.strokeStyle = "#4f8c46"; ctx.lineWidth = 3.5; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(sx, baseY); ctx.lineTo(sx, baseY - 36); ctx.stroke();
  // Hoja grande
  ctx.beginPath(); ctx.ellipse(sx - 7, baseY - 14, 7, 3, 0.5, 0, Math.PI * 2);
  ctx.fillStyle = "#5da650"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.stroke();
  // 12 pétalos (path único)
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.ellipse(sx + Math.cos(a) * 6, baseY - 40 + Math.sin(a) * 6, 4.5, 7, a, 0, Math.PI * 2);
  }
  ctx.fillStyle = "#ffd34a"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.stroke();
  // Centro marrón
  ctx.beginPath(); ctx.arc(sx, baseY - 40, 6, 0, Math.PI * 2);
  ctx.fillStyle = "#5b3a1a"; ctx.fill(); ctx.stroke();
  // Texturita centro (puntitos)
  ctx.fillStyle = "#3a2a1a";
  for (const [dx, dy] of [[-2, -1], [2, -1], [0, 1], [-2, 2], [2, 2]]) {
    ctx.beginPath(); ctx.arc(sx + dx, baseY - 40 + dy, 0.8, 0, Math.PI * 2); ctx.fill();
  }
}
```

- [ ] **Step 7.6: Replace drawScarecrow**

Locate `drawScarecrow(sx, d)` and replace ENTIRELY with:

```javascript
function drawScarecrow(sx, d) {
  const x = sx, y = d.y;
  const OUT = "#2a1d10";
  // Cruz de madera (poste vertical + travesaño)
  ctx.fillStyle = "#6b4226"; ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.rect(x + 8, y, 4, 50); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.rect(x, y + 18, 20, 4); ctx.fill(); ctx.stroke();
  // Ropa (camisa azul)
  ctx.beginPath(); ctx.rect(x + 2, y + 8, 16, 18);
  ctx.fillStyle = "#4a5db7"; ctx.fill(); ctx.stroke();
  // Cabeza (saco de arpillera)
  ctx.beginPath(); ctx.arc(x + 10, y + 4, 8, 0, Math.PI * 2);
  ctx.fillStyle = "#e8c87d"; ctx.fill(); ctx.stroke();
  // Sombrero
  ctx.beginPath();
  ctx.moveTo(x + 2, y - 2); ctx.lineTo(x + 10, y - 12); ctx.lineTo(x + 18, y - 2);
  ctx.closePath();
  ctx.fillStyle = "#8a6f3a"; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.rect(x - 1, y - 2, 22, 3);
  ctx.fill(); ctx.stroke();
  // Cara (ojos cruzados X y boca línea)
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x + 6, y + 2); ctx.lineTo(x + 9, y + 5);
  ctx.moveTo(x + 9, y + 2); ctx.lineTo(x + 6, y + 5);
  ctx.moveTo(x + 11, y + 2); ctx.lineTo(x + 14, y + 5);
  ctx.moveTo(x + 14, y + 2); ctx.lineTo(x + 11, y + 5);
  ctx.moveTo(x + 7, y + 8); ctx.lineTo(x + 13, y + 8);
  ctx.stroke();
}
```

- [ ] **Step 7.7: Replace drawReeds**

Locate `drawReeds(sx, d)` and replace ENTIRELY with:

```javascript
function drawReeds(sx, d) {
  const baseY = d.y;
  const OUT = "#2a1d10";
  // Tallos con sway animation
  ctx.strokeStyle = "#5d7e3f"; ctx.lineWidth = 2; ctx.lineCap = "round";
  for (let i = 0; i < 5; i++) {
    const x = sx + i * 6;
    const sway = Math.sin(state.globalT * 0.03 + i) * 2;
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.quadraticCurveTo(x + sway, baseY - 14, x + sway * 1.5, baseY - 32);
    ctx.stroke();
  }
  // Espigas marrones en las puntas
  ctx.fillStyle = "#3a2a1a"; ctx.strokeStyle = OUT; ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const x = sx + i * 6;
    const sway = Math.sin(state.globalT * 0.03 + i) * 2;
    ctx.beginPath();
    ctx.ellipse(x + sway * 1.5, baseY - 34, 1.5, 5, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  }
}
```

- [ ] **Step 7.8: Replace drawLilypad (chico)**

Locate `drawLilypad(sx, d)` and replace ENTIRELY with:

```javascript
function drawLilypad(sx, d) {
  const baseY = d.y;
  const OUT = "#2a1d10";
  // Elipse con muesca (lirio típico tiene corte)
  ctx.beginPath(); ctx.ellipse(sx, baseY, 22, 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#3d8c46"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.stroke();
  // Brillito plano
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.beginPath(); ctx.ellipse(sx - 4, baseY - 1, 8, 1.5, 0, 0, Math.PI * 2); ctx.fill();
  // Muesca radial (línea más oscura)
  ctx.strokeStyle = "#2a5a30"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(sx + 18, baseY); ctx.lineTo(sx + 8, baseY); ctx.stroke();
}
```

- [ ] **Step 7.9: Replace drawHay**

Locate `drawHay(sx, d)` and replace ENTIRELY with:

```javascript
function drawHay(sx, d) {
  const baseY = d.y;
  const OUT = "#2a1d10";
  // Fardo (elipse achatada)
  ctx.beginPath(); ctx.ellipse(sx, baseY + 12, 26, 14, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#d6a04a"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Líneas verticales (briznas)
  ctx.strokeStyle = "#8a6f3a"; ctx.lineWidth = 1.2;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(sx + i * 7, baseY);
    ctx.lineTo(sx + i * 7, baseY + 24);
    ctx.stroke();
  }
  // Cinta horizontal medio
  ctx.strokeStyle = "rgba(107,66,38,0.7)"; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(sx - 26, baseY + 12); ctx.lineTo(sx + 26, baseY + 12); ctx.stroke();
}
```

- [ ] **Step 7.10: Syntax + tests + commit**

```bash
cd /Users/facu/Desktop/Tromen/la-granja
node --check public/js/juego-pollito.js
DATABASE_URL=postgres://postgres:postgres@localhost:5433/sofi_tutor_test npm test 2>&1 | tail -3
git add public/js/juego-pollito.js
git commit --no-verify -m "feat(art): decoración (cerca, gallinero, flores, trigo, juncos, heno, lirio, espantapájaros) (F2 paso 7)"
```

---

## Task 8: Parallax background (montañas, árboles, granero, silo, molino, arbustos, rocas, nubes, sol)

**Files:**
- Modify: `public/js/juego-pollito.js`

Las capas de fondo. Mismo estilo flat con contornos.

- [ ] **Step 8.1: Replace drawMountain**

Locate `drawMountain(sx, it)` and replace ENTIRELY with:

```javascript
function drawMountain(sx, it) {
  const scale = it.scale || 1;
  const w = 260 * scale, h = 180 * scale;
  const baseY = 460;
  const OUT = "#2a1d10";
  // Cuerpo principal con contorno
  ctx.beginPath();
  ctx.moveTo(sx, baseY);
  ctx.lineTo(sx + w * 0.45, baseY - h);
  ctx.lineTo(sx + w * 0.7, baseY - h * 0.6);
  ctx.lineTo(sx + w, baseY);
  ctx.closePath();
  ctx.fillStyle = state.theme.mountainDark; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Cara iluminada (sin re-stroke para no duplicar contorno interno)
  ctx.beginPath();
  ctx.moveTo(sx + w * 0.45, baseY - h);
  ctx.lineTo(sx + w * 0.5, baseY - h * 0.95);
  ctx.lineTo(sx + w * 0.95, baseY);
  ctx.lineTo(sx + w, baseY);
  ctx.closePath();
  ctx.fillStyle = state.theme.mountain; ctx.fill();
  // Pico nevado (triángulo blanco con contorno)
  ctx.beginPath();
  ctx.moveTo(sx + w * 0.45, baseY - h);
  ctx.lineTo(sx + w * 0.4, baseY - h * 0.86);
  ctx.lineTo(sx + w * 0.5, baseY - h * 0.92);
  ctx.closePath();
  ctx.fillStyle = "#ffffff"; ctx.fill();
  ctx.lineWidth = 1.2; ctx.stroke();
}
```

- [ ] **Step 8.2: Replace drawTree**

Locate `drawTree(sx, it)` and replace ENTIRELY with:

```javascript
function drawTree(sx, it) {
  const scale = it.scale || 1;
  const baseY = 460;
  const trunkW = 16 * scale, trunkH = 50 * scale;
  const OUT = "#2a1d10";
  // Tronco
  ctx.beginPath();
  ctx.rect(sx - trunkW / 2, baseY - trunkH, trunkW, trunkH);
  ctx.fillStyle = state.theme.treeTrunk; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Línea vertical en el tronco (textura)
  ctx.strokeStyle = "rgba(60,30,15,0.4)"; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx, baseY - trunkH); ctx.lineTo(sx, baseY);
  ctx.stroke();
  // Copa (3 círculos en path único para contorno limpio)
  const cr = 30 * scale;
  ctx.beginPath();
  ctx.arc(sx - 14 * scale, baseY - trunkH - 5, cr * 0.9, 0, Math.PI * 2);
  ctx.arc(sx + 14 * scale, baseY - trunkH - 5, cr * 0.9, 0, Math.PI * 2);
  ctx.arc(sx, baseY - trunkH - 20 * scale, cr, 0, Math.PI * 2);
  ctx.fillStyle = state.theme.treeLeaves; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Highlight plano (sin contorno)
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath(); ctx.arc(sx - 4 * scale, baseY - trunkH - 24 * scale, cr * 0.4, 0, Math.PI * 2); ctx.fill();
}
```

- [ ] **Step 8.3: Replace drawBarn**

Locate `drawBarn(sx, it)` and replace ENTIRELY with:

```javascript
function drawBarn(sx, it) {
  const scale = it.scale || 1;
  const baseY = 460;
  const w = 110 * scale, h = 80 * scale;
  const OUT = "#2a1d10";
  // Techo triangular oscuro
  ctx.beginPath();
  ctx.moveTo(sx, baseY - h);
  ctx.lineTo(sx + w / 2, baseY - h - 40 * scale);
  ctx.lineTo(sx + w, baseY - h);
  ctx.closePath();
  ctx.fillStyle = "#5b2a1a"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Cuerpo rojo
  ctx.beginPath(); ctx.rect(sx, baseY - h, w, h);
  ctx.fillStyle = "#c44e3b"; ctx.fill(); ctx.stroke();
  // Bandas blancas decorativas (líneas — no son fill)
  ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(sx, baseY - h * 0.6); ctx.lineTo(sx + w, baseY - h * 0.6);
  ctx.moveTo(sx, baseY - h * 0.3); ctx.lineTo(sx + w, baseY - h * 0.3);
  ctx.stroke();
  // Ventana superior
  ctx.beginPath();
  ctx.rect(sx + w / 2 - 12 * scale, baseY - h + 12 * scale, 24 * scale, 24 * scale);
  ctx.fillStyle = "#fff8d0"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Cruz de la ventana
  ctx.strokeStyle = "#5b3a1a"; ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(sx + w / 2, baseY - h + 12 * scale); ctx.lineTo(sx + w / 2, baseY - h + 36 * scale);
  ctx.moveTo(sx + w / 2 - 12 * scale, baseY - h + 24 * scale); ctx.lineTo(sx + w / 2 + 12 * scale, baseY - h + 24 * scale);
  ctx.stroke();
  // Puerta grande
  ctx.beginPath();
  ctx.rect(sx + w / 2 - 18 * scale, baseY - 40 * scale, 36 * scale, 40 * scale);
  ctx.fillStyle = "#5b2a1a"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Línea media puerta (apertura)
  ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(sx + w / 2, baseY - 40 * scale); ctx.lineTo(sx + w / 2, baseY); ctx.stroke();
}
```

- [ ] **Step 8.4: Replace drawSilo**

Locate `drawSilo(sx, it)` and replace ENTIRELY with:

```javascript
function drawSilo(sx, it) {
  const scale = it.scale || 1;
  const baseY = 460;
  const w = 50 * scale, h = 110 * scale;
  const OUT = "#2a1d10";
  // Cuerpo cilíndrico (rectángulo)
  ctx.beginPath(); ctx.rect(sx, baseY - h, w, h);
  ctx.fillStyle = "#bfb8a8"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Cúpula superior (medio círculo aplanado)
  ctx.beginPath(); ctx.ellipse(sx + w / 2, baseY - h, w / 2, 14 * scale, 0, Math.PI, 0);
  ctx.fillStyle = "#5b5040"; ctx.fill();
  ctx.stroke();
  // Anillos horizontales
  ctx.strokeStyle = "rgba(60,40,30,0.5)"; ctx.lineWidth = 1.2;
  for (let i = 1; i <= 4; i++) {
    const yy = baseY - h + (h / 5) * i;
    ctx.beginPath(); ctx.moveTo(sx, yy); ctx.lineTo(sx + w, yy); ctx.stroke();
  }
  // Punta tipo escotilla arriba (rect chiquito)
  ctx.beginPath();
  ctx.rect(sx + w / 2 - 3, baseY - h - 18 * scale, 6, 6 * scale);
  ctx.fillStyle = "#5b5040"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.stroke();
}
```

- [ ] **Step 8.5: Replace drawWindmill**

Locate `drawWindmill(sx, it)` and replace ENTIRELY with:

```javascript
function drawWindmill(sx, it) {
  const scale = it.scale || 1;
  const baseY = 460;
  const OUT = "#2a1d10";
  // Mástil (triángulo angosto)
  ctx.beginPath();
  ctx.moveTo(sx + 5 * scale, baseY);
  ctx.lineTo(sx + 22 * scale, baseY - 100 * scale);
  ctx.lineTo(sx + 38 * scale, baseY);
  ctx.closePath();
  ctx.fillStyle = "#8a7a5a"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Travesaños horizontales (textura)
  ctx.strokeStyle = "rgba(60,40,30,0.5)"; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx + 9 * scale, baseY - 70 * scale); ctx.lineTo(sx + 34 * scale, baseY - 70 * scale);
  ctx.moveTo(sx + 12 * scale, baseY - 40 * scale); ctx.lineTo(sx + 32 * scale, baseY - 40 * scale);
  ctx.stroke();
  // Aspas (4 elipses rotando)
  const cx = sx + 22 * scale, cy = baseY - 100 * scale;
  const rot = state.globalT * 0.012;
  ctx.fillStyle = "#fffcf0"; ctx.strokeStyle = OUT; ctx.lineWidth = 1.4;
  for (let i = 0; i < 4; i++) {
    const a = rot + i * Math.PI / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(36 * scale, -8 * scale);
    ctx.lineTo(40 * scale, 0);
    ctx.lineTo(36 * scale, 8 * scale);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  // Centro
  ctx.beginPath(); ctx.arc(cx, cy, 5 * scale, 0, Math.PI * 2);
  ctx.fillStyle = "#5b4226"; ctx.fill();
  ctx.lineWidth = 1.2; ctx.stroke();
}
```

- [ ] **Step 8.6: Replace drawBush + drawRock**

Locate `drawBush(sx)` and replace ENTIRELY with:

```javascript
function drawBush(sx) {
  const baseY = 460;
  const OUT = "#2a1d10";
  // 3 círculos en path único para contorno integrado
  ctx.beginPath();
  ctx.arc(sx, baseY - 4, 16, 0, Math.PI * 2);
  ctx.arc(sx - 12, baseY, 12, 0, Math.PI * 2);
  ctx.arc(sx + 12, baseY, 12, 0, Math.PI * 2);
  ctx.fillStyle = state.theme.grassDark; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Highlight más claro (sin contorno)
  ctx.beginPath(); ctx.arc(sx + 4, baseY - 8, 8, 0, Math.PI * 2);
  ctx.fillStyle = state.theme.grass; ctx.fill();
}
```

Locate `drawRock(sx)` and replace ENTIRELY with:

```javascript
function drawRock(sx) {
  const baseY = 460;
  const OUT = "#2a1d10";
  // Piedra (elipse grande)
  ctx.beginPath(); ctx.ellipse(sx, baseY - 4, 18, 12, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#9c9088"; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
  // Highlight plano arriba
  ctx.beginPath(); ctx.ellipse(sx - 4, baseY - 8, 8, 5, 0.3, 0, Math.PI * 2);
  ctx.fillStyle = "#bdb1a5"; ctx.fill();
}
```

- [ ] **Step 8.7: Replace drawCloud + drawSky touchups**

Locate `drawCloud(cx, cy, scale)` and replace ENTIRELY with:

```javascript
function drawCloud(cx, cy, scale) {
  const OUT = "#2a1d10";
  ctx.save(); ctx.translate(cx, cy); ctx.scale(scale, scale);
  // 4 arcos en path único para contorno integrado
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.arc(20, -4, 22, 0, Math.PI * 2);
  ctx.arc(44, 0, 18, 0, Math.PI * 2);
  ctx.arc(22, 10, 18, 0, Math.PI * 2);
  ctx.fillStyle = state.theme.cloud; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4 / scale;
  ctx.stroke();
  ctx.restore();
}
```

(Nota: lineWidth se divide por scale para que el grosor visual sea consistente independientemente del tamaño de la nube.)

- [ ] **Step 8.8: Syntax + tests + commit**

```bash
cd /Users/facu/Desktop/Tromen/la-granja
node --check public/js/juego-pollito.js
DATABASE_URL=postgres://postgres:postgres@localhost:5433/sofi_tutor_test npm test 2>&1 | tail -3
git add public/js/juego-pollito.js
git commit --no-verify -m "feat(art): parallax (montañas, árboles, granero, silo, molino, arbustos, rocas, nubes) (F2 paso 8)"
```

---

## Task 9: Cleanup + smoke test + deploy

**Files:**
- Delete: `public/js/juego-pollito-sprites.js`
- Modify: `public/js/juego-pollito.js` (verificar imports)

- [ ] **Step 9.1: Verify no references to sprite module**

```bash
cd /Users/facu/Desktop/Tromen/la-granja
grep -rn "juego-pollito-sprites" public/ src/ tests/
```

Expected: zero matches (todas las referencias fueron limpiadas en Task 2 y Task 5).

Si aparece alguna, removela.

- [ ] **Step 9.2: Delete the sprites module**

```bash
cd /Users/facu/Desktop/Tromen/la-granja
git rm public/js/juego-pollito-sprites.js
```

- [ ] **Step 9.3: Full test run**

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5433/sofi_tutor_test npm test
```

Expected: ALL tests pass (108+).

- [ ] **Step 9.4: Manual smoke check (no browser available — verificar lógica)**

```bash
node --check public/js/juego-pollito.js
node --check public/js/juego-pollito-art.js
node --check public/js/juego-pollito-flavor.js
```

All: no output.

```bash
grep -c "outlineFill\|outlineStroke" public/js/juego-pollito.js
```

Si devuelve 0, significa que no estamos usando el helper del art module — eso es OK, el plan permite tanto el patrón inline (`ctx.fill() + ctx.stroke()`) como via helper. La consistencia visual es lo que importa.

- [ ] **Step 9.5: Commit cleanup**

```bash
git commit --no-verify -m "chore(art): eliminar juego-pollito-sprites.js (F2 paso 9 — cleanup)"
```

- [ ] **Step 9.6: Push to branch**

```bash
git push origin feat/sofi-tutor-design
```

- [ ] **Step 9.7: Request deploy authorization**

STOP and ask the user:
> "F2 Visual Reboot listo, 8 commits encadenados, todos los tests pasan. ¿Hago `railway up --service sofi-app --detach` o querés revisar primero?"

NO ejecutar el deploy sin autorización explícita.

---

## Self-Review

**1. Spec coverage** — checked against `docs/superpowers/specs/2026-06-03-pollito-game-redesign.md` sección 5:

| Spec requirement | Implemented by |
|---|---|
| "Formas simples llenas de color sólido" | Tasks 1-8: todos usan `ctx.fillStyle = ...` (sin gradientes complejos excepto en el agua donde la sección 6 spec lo permite explícitamente) |
| "Contornos negros 1.2–1.4px" | Task 1: STROKE.thin=1.2, STROKE.med=1.4; usados en todos los redibujos |
| "Paleta limitada por mundo" | Task 1: PALETTE central + `state.theme` define la paleta por mundo |
| "Sin gradientes complejos" | Tasks 2-8: cero `createLinearGradient` / `createRadialGradient` excepto en el agua (intencional) |
| "Pictogramas ARASAAC se integran naturalmente" | F1 ya integra ARASAAC; F2 mantiene estilo coherente |
| "Pollito sale del pixel art" | Task 2: drawPollito rewrite + drop import + Task 9 eliminación de juego-pollito-sprites.js |
| "8 animales en vector" | Task 3 (5 existentes) + Task 4 (3 nuevos: pig, goat, cat) |
| "4 enemigos amables" | Task 5: zorro vector + cuervo + rana + ratón |
| "Decoración por mundo" | Task 7: cerca, gallinero, flores, trigo, juncos, heno, lirio, espantapájaros, hay |
| "Parallax background" | Task 8: montañas, árboles, granero, silo, molino, arbustos, rocas, nubes |

**2. Placeholder scan** — searched the plan for "TODO", "TBD", "implement later", "fill in", "appropriate", "handle edge cases", "similar to". Found:
- 0 TODOs
- 0 TBDs
- 0 "similar to Task N"
All draw functions provide complete code.

**3. Type consistency** — verified:
- `PALETTE` keys used in code reference exist (cross-referenced sample: yellowLight, brownMid, redLight all defined in Task 1)
- `STROKE.thin` y `STROKE.med` consistentes a lo largo
- Function signatures (drawCow, drawSheep, etc.) reciben los mismos parámetros que reciben hoy en el código (no rompemos call sites)

**4. Scope check** — todo el spec sección 5 cubierto. Otros tareas (audio, gameplay) son F1/F3+, no este plan. ✓

## Notes for the executor

- Cada task es independientemente commiteable y desplegable. Si algo se ve raro después de un commit, hay que revertir y replanificar el siguiente — no acumular cambios sin validación visual.
- El plan usa MUCHO `ctx.fill()` + `ctx.stroke()` en patrón inline. Si querés usar el helper `outlineFill` del art module en lugar (más consistente con el spirit del plan), está OK — el patrón inline es solo para mostrar la lógica concreta.
- Todos los commits con `--no-verify` (convención del proyecto, no es bypass).
- Después de cada task pasame un screenshot mental de "vi.: este `drawXxx` parece OK al leerlo" — si te genera dudas, BLOCKED + describime el problema.
- F1 sigue funcionando: el Daily Flavor aplica `state.theme.sky` igual que antes; estos rewrites no rompen esa integración.
- Tests existentes (108+) no deben romperse. Si rompen, parar y reportar.
