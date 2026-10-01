import { describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { abrirBaseDatos } from ".";
import { sembrar } from "./semilla";
import * as t from "./schema";
import { anotarValor, cuadrar, guardarInteres, quitarValor, ultimoCuadre } from "./cuentas";

function nueva() {
  const db = abrirBaseDatos(":memory:");
  migrate(db, { migrationsFolder: "./drizzle" });
  sembrar(db);
  return db;
}

describe("cuentas en la base de datos", () => {
  it("cuadrar guarda el saldo real y lo que calculaba la app; el mismo día se sobrescribe", () => {
    const db = nueva();
    cuadrar(db, "imagin", "2026-10-05", 6065, 6000);
    cuadrar(db, "imagin", "2026-10-05", 6100, 6000);
    const imagin = db.select().from(t.cuadres).all().filter((c) => c.cuenta === "imagin");
    expect(imagin).toHaveLength(2);
    expect(ultimoCuadre(db, "imagin")).toMatchObject({ fecha: "2026-10-05", saldoRealCent: 6100, saldoCalculadoCent: 6000, esPartida: false, estimado: false });
    // Las demás cuentas no se tocan
    expect(ultimoCuadre(db, "ahorro_tr")).toMatchObject({ saldoRealCent: 191166, esPartida: true });
  });
  it("valores de Inversión TR: anotar, corregir y quitar", () => {
    const db = nueva();
    anotarValor(db, "2026-10-28", 160000);
    anotarValor(db, "2026-10-28", 161000);
    expect(db.select().from(t.valoracionesInversion).all().find((v) => v.fecha === "2026-10-28")?.valorCent).toBe(161000);
    quitarValor(db, "2026-10-28");
    expect(db.select().from(t.valoracionesInversion).all().some((v) => v.fecha === "2026-10-28")).toBe(false);
  });
  it("el interés se corrige a mano, y a cero se quita solo el de esa cuenta", () => {
    const db = nueva();
    guardarInteres(db, "ahorro_tr", "2026-10", 470);
    guardarInteres(db, "hucha_revolut", "2026-10", 12);
    expect(db.select().from(t.intereses).all().find((i) => i.cuenta === "ahorro_tr" && i.mes === "2026-10")?.importeCent).toBe(470);
    guardarInteres(db, "hucha_revolut", "2026-10", 0);
    const oct = db.select().from(t.intereses).all().filter((i) => i.mes === "2026-10");
    expect(oct.map((i) => i.cuenta)).toEqual(["ahorro_tr"]);
  });
});
