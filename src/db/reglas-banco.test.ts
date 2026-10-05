import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sugerir } from "@/lib/reglas";

// Las reglas de la migración 0001 (para bases ya creadas), tal cual se guardan
const patrones = [...readFileSync("drizzle/0001_reglas_banco.sql", "utf8").matchAll(/^SELECT '([^']+)'/gm)].map((m) => m[1]);
const semilla = readFileSync("src/db/semilla.ts", "utf8");

describe("reglas para los conceptos de Imagin", () => {
  it("la migración y la semilla de una base nueva tienen las mismas", () => {
    expect(patrones).toHaveLength(4);
    for (const p of patrones) expect(semilla).toContain(JSON.stringify(p));
  });
  it("reconocen cómo escribe el banco cada comercio", () => {
    const reglas = patrones.map((patron, i) => ({ patron, grupoId: i, etiqueta: null, prioridad: i }));
    const grupo = (c: string) => sugerir(c, new Map(), reglas)?.grupoId ?? null;
    // 0 gasolineras, 1 IA, 2 caprichos, 3 ropa
    expect(["EESS ECONOIL LUCE", "PLENOIL FERNAN NU", "PETROIL AZAHARA", "E. S. ZOCO CORDOB"].map(grupo)).toEqual([0, 0, 0, 0]);
    expect(["ANTHROPIC* CLAUDE", "ANTHROPIC"].map(grupo)).toEqual([1, 1]);
    expect(["VIRYI NAILS", "BK21682 CORDOBA L", "BK CORDOBA LIDL"].map(grupo)).toEqual([2, 2, 2]);
    expect(["H  M", "ECI C.C. RONDA DE", "0599 ECI CORDOBA"].map(grupo)).toEqual([3, 3, 3]);
    // Y no se confunden con otros
    expect(["MERCADONA AVDA MA", "SP BEANYWOOD", "TPV. CORDOBA IV-P", "DECIMAS"].map(grupo)).toEqual([null, null, null, null]);
  });
});
