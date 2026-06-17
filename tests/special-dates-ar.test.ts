import { describe, it, expect } from "vitest";
import { getSeason, getSpecialDate, isThirdSundayOfAugust } from "../src/server/services/special-dates-ar.js";

describe("getSeason (es-AR, hemisferio sur)", () => {
  it("diciembre / enero / febrero → verano", () => {
    expect(getSeason(new Date(2026, 11, 1))).toBe("verano");
    expect(getSeason(new Date(2026, 0, 15))).toBe("verano");
    expect(getSeason(new Date(2026, 1, 28))).toBe("verano");
  });
  it("marzo / abril / mayo → otono", () => {
    expect(getSeason(new Date(2026, 2, 15))).toBe("otono");
    expect(getSeason(new Date(2026, 3, 7))).toBe("otono");
    expect(getSeason(new Date(2026, 4, 25))).toBe("otono");
  });
  it("junio / julio / agosto → invierno", () => {
    expect(getSeason(new Date(2026, 5, 21))).toBe("invierno");
    expect(getSeason(new Date(2026, 6, 9))).toBe("invierno");
    expect(getSeason(new Date(2026, 7, 17))).toBe("invierno");
  });
  it("septiembre / octubre / noviembre → primavera", () => {
    expect(getSeason(new Date(2026, 8, 21))).toBe("primavera");
    expect(getSeason(new Date(2026, 9, 12))).toBe("primavera");
    expect(getSeason(new Date(2026, 10, 20))).toBe("primavera");
  });
});

describe("getSpecialDate (es-AR + Sofi)", () => {
  it("cumple de Sofi 7 abril → evento sofi-bday", () => {
    const r = getSpecialDate(new Date(2026, 3, 7));
    expect(r?.id).toBe("cumple-sofi");
    expect(r?.banner).toContain("Sofi");
  });
  it("25 mayo → revolución", () => {
    const r = getSpecialDate(new Date(2026, 4, 25));
    expect(r?.id).toBe("revolucion-mayo");
  });
  it("9 julio → independencia", () => {
    const r = getSpecialDate(new Date(2026, 6, 9))!;
    expect(r.id).toBe("independencia");
  });
  it("25 diciembre → navidad", () => {
    const r = getSpecialDate(new Date(2026, 11, 25))!;
    expect(r.id).toBe("navidad");
  });
  it("21 septiembre → primavera", () => {
    const r = getSpecialDate(new Date(2026, 8, 21))!;
    expect(r.id).toBe("primavera");
  });
  it("1 enero → ano nuevo", () => {
    const r = getSpecialDate(new Date(2026, 0, 1))!;
    expect(r.id).toBe("ano-nuevo");
  });
  it("6 enero → reyes", () => {
    const r = getSpecialDate(new Date(2026, 0, 6))!;
    expect(r.id).toBe("reyes");
  });
  it("día normal sin evento → null", () => {
    expect(getSpecialDate(new Date(2026, 5, 15))).toBeNull();
    expect(getSpecialDate(new Date(2026, 1, 10))).toBeNull();
  });
  it("24 marzo (Memoria) NO se decora", () => {
    expect(getSpecialDate(new Date(2026, 2, 24))).toBeNull();
  });
  it("2 abril (Malvinas) NO se decora", () => {
    expect(getSpecialDate(new Date(2026, 3, 2))).toBeNull();
  });
});

describe("isThirdSundayOfAugust + Día del Niño", () => {
  it("3er domingo de agosto 2026 = 16/8 → true", () => {
    expect(isThirdSundayOfAugust(new Date(2026, 7, 16))).toBe(true);
  });
  it("3er domingo de agosto 2027 = 15/8 → true", () => {
    expect(isThirdSundayOfAugust(new Date(2027, 7, 15))).toBe(true);
  });
  it("otro domingo de agosto (1er) → false", () => {
    expect(isThirdSundayOfAugust(new Date(2026, 7, 2))).toBe(false);
  });
  it("16/8/2026 dispara Día del Niño en getSpecialDate", () => {
    const r = getSpecialDate(new Date(2026, 7, 16));
    expect(r?.id).toBe("dia-nino");
  });
});
