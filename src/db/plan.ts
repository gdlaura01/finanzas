/** Escritura del plan: parámetros, presupuesto de los grupos y eventos del calendario. */
import { eq, ne } from "drizzle-orm";
import type { BaseDatos } from ".";
import * as t from "./schema";
import type { DatosEvento, ParametroPlan } from "@/lib/plan";

export function guardarParametro(db: BaseDatos, clave: ParametroPlan, valor: number) {
  db.insert(t.parametros).values({ clave, valor }).onConflictDoUpdate({ target: t.parametros.clave, set: { valor } }).run();
}

/** Cambia el presupuesto fijo o la parte en efectivo de un grupo. Los grupos dinámicos no tienen parte fija. */
export function guardarPresupuestoGrupo(db: BaseDatos, id: number, campo: "presupuestoCent" | "efectivoPrevistoCent", valor: number) {
  const g = db.select().from(t.grupos).where(eq(t.grupos.id, id)).get();
  if (!g) throw new Error("Ese grupo ya no existe.");
  if (campo === "presupuestoCent" && g.esDinamico) throw new Error(`${g.nombre} no tiene presupuesto fijo: sale de sus eventos del calendario.`);
  db.update(t.grupos).set({ [campo]: valor }).where(eq(t.grupos.id, id)).run();
  return g;
}

/** Etiquetas de los demás eventos, para no repetirlas. */
export const etiquetasDeOtrosEventos = (db: BaseDatos, id?: number) =>
  db.select({ e: t.eventos.etiqueta }).from(t.eventos).where(id ? ne(t.eventos.id, id) : undefined).all().map((x) => x.e);

export function crearEvento(db: BaseDatos, d: DatosEvento) {
  return db.insert(t.eventos).values(d).returning({ id: t.eventos.id }).get().id;
}

export function editarEvento(db: BaseDatos, id: number, d: DatosEvento) {
  const r = db.update(t.eventos).set(d).where(eq(t.eventos.id, id)).returning({ id: t.eventos.id }).get();
  if (!r) throw new Error("Ese evento ya no existe.");
}

/** Borra un evento. Los gastos que llevaban su etiqueta la conservan. */
export const borrarEvento = (db: BaseDatos, id: number) => db.delete(t.eventos).where(eq(t.eventos.id, id)).returning({ nombre: t.eventos.nombre }).get();
