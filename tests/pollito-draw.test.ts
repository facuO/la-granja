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
