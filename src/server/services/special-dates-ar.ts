/** Identificadores sin tildes ni eñes para usar como claves de objeto y comparaciones simples. */
export type Season = "verano" | "otono" | "invierno" | "primavera";

export type SpecialDate = {
  id: string;
  name: string;
  banner: string;
};

/**
 * Estación según mes (hemisferio sur, es-AR).
 * dic/ene/feb = verano, mar/abr/may = otoño, jun/jul/ago = invierno, sep/oct/nov = primavera
 */
export function getSeason(date: Date): Season {
  const m = date.getMonth(); // 0-indexed
  if (m === 11 || m === 0 || m === 1) return "verano";
  if (m >= 2 && m <= 4) return "otono";
  if (m >= 5 && m <= 7) return "invierno";
  return "primavera"; // 8, 9, 10
}

const STATIC_DATES: Record<string, SpecialDate> = {
  "01-01": { id: "ano-nuevo", name: "Año Nuevo", banner: "Feliz año nuevo." },
  "01-06": { id: "reyes", name: "Reyes", banner: "Hoy es el día de Reyes." },
  "04-07": { id: "cumple-sofi", name: "Cumple de Sofi", banner: "¡Feliz cumple, Sofi!" },
  "05-25": { id: "revolucion-mayo", name: "Revolución de Mayo", banner: "Hoy es el 25 de mayo." },
  "06-17": { id: "guemes", name: "Día de Güemes", banner: "Hoy es el día de Güemes." },
  "06-20": { id: "bandera", name: "Día de la Bandera", banner: "Hoy es el día de la bandera." },
  "07-09": { id: "independencia", name: "Día de la Independencia", banner: "Hoy es el día de la independencia." },
  "08-17": { id: "san-martin", name: "San Martín", banner: "Hoy es el día de San Martín." },
  "09-21": { id: "primavera", name: "Primavera", banner: "Empezó la primavera." },
  "10-12": { id: "diversidad", name: "Día del Respeto a la Diversidad", banner: "Hoy es el día del respeto a la diversidad." },
  "11-20": { id: "soberania", name: "Día de la Soberanía", banner: "Hoy es el día de la soberanía nacional." },
  "12-25": { id: "navidad", name: "Navidad", banner: "Feliz Navidad." },
};

/** El 3er domingo de agosto = Día del Niño en Argentina. */
export function isThirdSundayOfAugust(date: Date): boolean {
  if (date.getMonth() !== 7) return false; // 7 = agosto (0-indexed)
  if (date.getDay() !== 0) return false; // 0 = domingo
  const dom = date.getDate();
  return dom >= 15 && dom <= 21;
}

/**
 * Devuelve el SpecialDate para una fecha, o null si no hay evento.
 * Incluye cumple de Sofi hardcoded en 7 abril.
 *
 * IMPORTANTE: `date` debe construirse con `new Date()` o `new Date(y, m, d)` (timezone local).
 * NO pasar strings ISO `"YYYY-MM-DD"` directamente al constructor — esos se parsean como UTC
 * y en Argentina (UTC-3) shifta al día anterior, causando bugs sutiles.
 */
export function getSpecialDate(date: Date): SpecialDate | null {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const key = `${mm}-${dd}`;
  if (STATIC_DATES[key]) return STATIC_DATES[key];
  if (isThirdSundayOfAugust(date)) {
    return { id: "dia-nino", name: "Día del Niño", banner: "Hoy es el día del niño." };
  }
  return null;
}
