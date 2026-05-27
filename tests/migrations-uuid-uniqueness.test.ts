import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Previene la clase de bug que rompió "Pares e impares" (mostraba contenido
 * de adverbios): dos migraciones distintas que INSERTan topics con el MISMO
 * UUID. El ON CONFLICT DO UPDATE de la segunda pisa title/block/description
 * de la primera, pero deja generated_blocks viejos → contenido cruzado.
 *
 * El test ejecuta cada migración con un `pgm` mockeado que captura el SQL
 * (incluso el generado en loops JS), extrae los UUIDs de topics insertados,
 * y falla si un UUID lo insertan 2+ migraciones.
 */

const MIGRATIONS_DIR = join(process.cwd(), "migrations");

// Colisión histórica ya resuelta (mate-fundamentos pisó cordoba-lengua en
// 510-514; el fix recreó Lengua en 560-564). Se documenta acá como aceptada.
const ALLOWED_COLLISIONS = new Set([
  "55555555-5555-5555-5555-555555555510",
  "55555555-5555-5555-5555-555555555511",
  "55555555-5555-5555-5555-555555555512",
  "55555555-5555-5555-5555-555555555513",
  "55555555-5555-5555-5555-555555555514",
]);

/** Mock de pgm que registra solo las llamadas a sql(); el resto son no-ops. */
function makeRecordingPgm(recorded: string[]) {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "sql") return (s: string) => recorded.push(s);
        if (prop === "func") return (s: string) => `__func__(${s})`;
        return () => undefined;
      },
    },
  );
}

/**
 * Extrae los topic UUIDs que un SQL INSERTa. Una tupla de topic tiene la
 * forma `('<topic_uuid>', '<block_uuid>', '<title>', ...)` donde el block_id
 * SIEMPRE empieza con `22222222` (convención de bloques del proyecto). Eso
 * distingue una tupla de INSERT de una referencia en UPDATE/DELETE/IN (donde
 * los UUIDs son todos topic_ids, ninguno empieza con 22222222 en 2da
 * posición). Robusto ante `;` dentro de descripciones.
 */
function extractInsertedTopicIds(sql: string): string[] {
  const ids: string[] = [];
  const tupleRe = /\(\s*'([0-9a-fA-F-]{36})'\s*,\s*'(22222222-[0-9a-fA-F-]{27})'/g;
  let m: RegExpExecArray | null;
  while ((m = tupleRe.exec(sql)) !== null) {
    ids.push(m[1].toLowerCase());
  }
  return ids;
}

describe("migraciones: unicidad de UUIDs de topics", () => {
  it("ninguna migración INSERTa un topic UUID que otra ya insertó", async () => {
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".cjs"))
      .sort();

    // uuid → set de archivos de migración que lo insertan
    const uuidToFiles = new Map<string, Set<string>>();

    for (const file of files) {
      const recorded: string[] = [];
      const pgm = makeRecordingPgm(recorded);
      const mod = await import(pathToFileURL(join(MIGRATIONS_DIR, file)).href);
      if (typeof mod.up !== "function") continue;
      try {
        mod.up(pgm);
      } catch {
        // Si la migración usa una API de pgm no mockeada, la ignoramos:
        // las migraciones de topics solo usan pgm.sql().
        continue;
      }
      const sql = recorded.join("\n");
      for (const id of extractInsertedTopicIds(sql)) {
        if (!uuidToFiles.has(id)) uuidToFiles.set(id, new Set());
        uuidToFiles.get(id)!.add(file);
      }
    }

    const collisions: string[] = [];
    for (const [uuid, fileSet] of uuidToFiles) {
      if (fileSet.size > 1 && !ALLOWED_COLLISIONS.has(uuid)) {
        collisions.push(`${uuid} insertado por: ${[...fileSet].join(", ")}`);
      }
    }

    expect(collisions, `Colisiones de UUID detectadas:\n${collisions.join("\n")}`).toEqual([]);
  });
});
