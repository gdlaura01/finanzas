import { describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { abrirBaseDatos } from ".";
import { sembrar } from "./semilla";
import * as t from "./schema";
import { borrarEvento, crearEvento, editarEvento, etiquetasDeOtrosEventos, guardarParametro, guardarPresupuestoGrupo } from "./plan";
import { leerParametros, pendientes } from "./movimientos";

function nueva() {
  const db = abrirBaseDatos(":memory:");
  migrate(db, { migrationsFolder: "./drizzle" });
  sembrar(db);
  return db;
}
const grupo = (db: ReturnType<typeof nueva>, nombre: string) => db.select().from(t.grupos).where(eq(t.grupos.nombre, nombre)).get()!;

describe("plan en la base de datos", () => {
  it("cambiar el traspaso a Trade Republic cambia lo que propone el pendiente", () => {
    const db = nueva();
    guardarParametro(db, "traspaso_tr_cent", 65000);
    expect(leerParametros(db).traspaso_tr_cent).toBe(65000);
    expect(pendientes(db, "2026-10", "2026-10-01").find((p) => p.recurrente.vinculo === "traspaso_tr")?.importeCent).toBe(65000);
  });
  it("presupuesto y efectivo de un grupo; Regalos no tiene parte fija", () => {
    const db = nueva();
    guardarPresupuestoGrupo(db, grupo(db, "Ropa").id, "presupuestoCent", 9000);
    guardarPresupuestoGrupo(db, grupo(db, "Regalos").id, "efectivoPrevistoCent", 2000);
    expect(grupo(db, "Ropa").presupuestoCent).toBe(9000);
    expect(grupo(db, "Regalos").efectivoPrevistoCent).toBe(2000);
    expect(() => guardarPresupuestoGrupo(db, grupo(db, "Regalos").id, "presupuestoCent", 1)).toThrow(/no tiene presupuesto fijo/);
  });
  it("crear, editar y borrar eventos; las etiquetas de los demás excluyen la propia", () => {
    const db = nueva();
    const d = { nombre: "Cofradía", mes: 3, dia: 15, anio: null, grupoId: grupo(db, "Iglesia").id, etiqueta: "Cofradía", color: "#BE8A2A", importePrevistoCent: 3000, notas: null };
    const id = crearEvento(db, d);
    expect(etiquetasDeOtrosEventos(db, id)).not.toContain("Cofradía");
    expect(etiquetasDeOtrosEventos(db)).toContain("Cofradía");
    editarEvento(db, id, { ...d, importePrevistoCent: 3500 });
    expect(db.select().from(t.eventos).where(eq(t.eventos.id, id)).get()?.importePrevistoCent).toBe(3500);
    expect(borrarEvento(db, id)?.nombre).toBe("Cofradía");
    expect(() => editarEvento(db, id, d)).toThrow(/ya no existe/);
  });
});
