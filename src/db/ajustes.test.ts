import { describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { asc, eq } from "drizzle-orm";
import { abrirBaseDatos } from ".";
import { sembrar } from "./semilla";
import * as t from "./schema";
import * as aj from "./ajustes";
import { crearMovimiento, pendientes } from "./movimientos";
import { mover } from "@/lib/ajustes";

function nueva() {
  const db = abrirBaseDatos(":memory:");
  migrate(db, { migrationsFolder: "./drizzle" });
  sembrar(db);
  return db;
}
const grupos = (db: ReturnType<typeof nueva>) => db.select().from(t.grupos).orderBy(asc(t.grupos.orden)).all();

describe("ajustes en la base de datos", () => {
  it("un recurrente nuevo aparece en los pendientes del mes", () => {
    const db = nueva();
    aj.crearRecurrente(db, { concepto: "Netflix", clase: "gasto", grupoId: 8, etiqueta: "Suscripción", medio: "imagin", importeCent: 999, dia: 5, auto: false, activo: true }, "2026-10");
    expect(pendientes(db, "2026-10", "2026-10-01").find((p) => p.recurrente.concepto === "Netflix")).toMatchObject({ fechaPrevista: "2026-10-05", importeCent: 999 });
  });
  it("la nómina conserva su importe ligado y no se puede borrar", () => {
    const db = nueva();
    const nomina = db.select().from(t.recurrentes).where(eq(t.recurrentes.concepto, "Nómina")).get()!;
    aj.editarRecurrente(db, nomina.id, { concepto: "Nómina", grupoId: null, etiqueta: null, medio: "imagin", importeCent: 1, dia: 28, auto: false, activo: true });
    expect(db.select().from(t.recurrentes).where(eq(t.recurrentes.id, nomina.id)).get()).toMatchObject({ dia: 28, importeCent: null });
    expect(() => aj.borrarRecurrente(db, nomina.id)).toThrow(/parte de la app/);
  });
  it("un grupo nuevo va antes de «Otros»", () => {
    const db = nueva();
    aj.crearGrupo(db, { nombre: "Coche", color: "#5E6B7A", presupuestoCent: 5000 });
    expect(grupos(db).slice(-2).map((g) => g.nombre)).toEqual(["Coche", "Otros"]);
  });
  it("un grupo con movimientos se archiva; sin nada, se borra; Regalos y Otros no", () => {
    const db = nueva();
    const coche = aj.crearGrupo(db, { nombre: "Coche", color: "#5E6B7A", presupuestoCent: 0 });
    const viajes = aj.crearGrupo(db, { nombre: "Viajes", color: "#8E5A6B", presupuestoCent: 0 });
    crearMovimiento(db, { fechaCompra: "2026-10-01", fechaCargo: "2026-10-01", concepto: "ITV", tipo: "gasto", medio: "imagin", importeCent: 4000, grupoId: coche, etiqueta: null, notas: null, cuentaOrigen: null, cuentaDestino: null, cubrirConHucha: false });
    expect(aj.archivarGrupo(db, coche, false)).toBe("archivado");
    expect(aj.archivarGrupo(db, viajes, false)).toBe("borrado");
    expect(aj.archivarGrupo(db, coche, true)).toBe("reactivado");
    const regalos = grupos(db).find((g) => g.nombre === "Regalos")!;
    expect(() => aj.archivarGrupo(db, regalos.id, false)).toThrow(/no se puede/);
  });
  it("ordenar atajos, grupos y reglas", () => {
    const db = nueva();
    const ids = aj.idsAtajos(db);
    aj.ordenarAtajos(db, mover(ids, ids[1], -1));
    expect(aj.idsAtajos(db).slice(0, 2)).toEqual([ids[1], ids[0]]);
    const rs = aj.idsReglas(db);
    aj.ordenarReglas(db, mover(rs, rs.at(-1)!, -1));
    expect(aj.idsReglas(db).slice(-2)).toEqual([rs.at(-1), rs.at(-2)]);
  });
  it("una regla nueva va la primera", () => {
    const db = nueva();
    const id = aj.crearRegla(db, { patron: "itv", grupoId: 1, etiqueta: null });
    expect(aj.idsReglas(db)[0]).toBe(id);
  });
});
