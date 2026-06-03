import { describe, it, expect } from "vitest";

describe("juego-pollito-art module", () => {
  it("exports PALETTE with expected color keys", async () => {
    const mod = await import("../public/js/juego-pollito-art.js");
    expect(mod.PALETTE).toBeDefined();
    expect(typeof mod.PALETTE.outline).toBe("string");
    expect(typeof mod.PALETTE.yellowLight).toBe("string");
    expect(typeof mod.PALETTE.yellowDark).toBe("string");
    expect(typeof mod.PALETTE.brownMid).toBe("string");
    expect(typeof mod.PALETTE.greenMid).toBe("string");
    expect(typeof mod.PALETTE.redLight).toBe("string");
    expect(typeof mod.PALETTE.white).toBe("string");
    for (const [key, val] of Object.entries(mod.PALETTE)) {
      expect(val, `${key} should be hex`).toMatch(/^#[0-9a-fA-F]{3,8}$|^rgba\(/);
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
