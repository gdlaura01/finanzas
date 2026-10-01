import { describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq, sql } from "drizzle-orm";
import { abrirBaseDatos } from ".";
import { sembrar } from "./semilla";
import * as t from "./schema";

function nueva() {
  const db = abrirBaseDatos(":memory:");
  migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cuenta = (db: ReturnType<typeof nueva>, tabla: any): number => db.select({ n: sql<number>`count(*)` }).from(tabla).get()!.n;

describe("base de datos", () => {
  it("las migraciones y la semilla dejan la configuración de partida", () => {
    const db = nueva();
    expect(sembrar(db)).toBe(true);
    expect(cuenta(db, t.grupos)).toBe(10);
    expect(cuenta(db, t.eventos)).toBe(10);
    expect(cuenta(db, t.recurrentes)).toBe(8);
    expect(cuenta(db, t.atajos)).toBe(7);
    expect(cuenta(db, t.reglasImportacion)).toBe(11);
    expect(cuenta(db, t.intereses)).toBe(9);
    const regalos = db.select().from(t.grupos).where(eq(t.grupos.nombre, "Regalos")).get()!;
    expect(regalos.esDinamico).toBe(true);
    expect(regalos.presupuestoCent).toBeNull();
    const nomina = db.select().from(t.parametros).where(eq(t.parametros.clave, "nomina_cent")).get()!;
    expect(nomina.valor).toBe(133191);
  });

  it("sembrar dos veces no duplica nada", () => {
    const db = nueva();
    sembrar(db);
    expect(sembrar(db)).toBe(false);
    expect(cuenta(db, t.grupos)).toBe(10);
  });

  it("un recurrente no se registra dos veces el mismo mes", () => {
    const db = nueva();
    sembrar(db);
    const base = { fechaCompra: "2026-10-16", fechaCargo: "2026-10-16", concepto: "Claude", conceptoNorm: "claude", tipo: "gasto" as const, medio: "imagin" as const, importeCent: 2178, recurrenteId: 6, periodo: "2026-10" };
    db.insert(t.movimientos).values(base).run();
    expect(() => db.insert(t.movimientos).values(base).run()).toThrow();
  });

  it("al borrar un gasto se borra la retirada de la hucha que lo cubría", () => {
    const db = nueva();
    sembrar(db);
    const g = db.insert(t.movimientos).values({ fechaCompra: "2026-10-12", fechaCargo: "2026-10-12", concepto: "Regalo", conceptoNorm: "regalo", tipo: "gasto", medio: "imagin", importeCent: 4000 }).returning().get();
    db.insert(t.movimientos).values({ fechaCompra: "2026-10-12", fechaCargo: "2026-10-12", concepto: "Retirada de la hucha · Regalo", conceptoNorm: "retirada", tipo: "interno", medio: "revolut", importeCent: 4000, cuentaOrigen: "hucha_revolut", cuentaDestino: "imagin", vinculadoId: g.id }).run();
    db.delete(t.movimientos).where(eq(t.movimientos.id, g.id)).run();
    expect(cuenta(db, t.movimientos)).toBe(0);
  });

  it("la etiqueta de un evento es única", () => {
    const db = nueva();
    sembrar(db);
    expect(() => db.insert(t.eventos).values({ nombre: "Otra Navidad", grupoId: 5, etiqueta: "Navidad", importePrevistoCent: 100 }).run()).toThrow();
  });
});
