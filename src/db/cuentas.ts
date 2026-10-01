/** Escrituras de Cuentas y ahorro: cuadres, valores de Inversión TR e intereses. */
import { and, eq } from "drizzle-orm";
import type { BaseDatos } from ".";
import * as t from "./schema";
import type { Cuenta } from "./schema";

/** Cuadra una cuenta con su saldo real: desde esa fecha se calcula a partir de él. Guarda lo que calculaba la app para ver la diferencia. */
export function cuadrar(db: BaseDatos, cuenta: Exclude<Cuenta, "inversion_tr">, fecha: string, saldoRealCent: number, saldoCalculadoCent: number | null) {
  db.transaction((tx) => {
    const ya = tx.select().from(t.cuadres).all().find((c) => c.cuenta === cuenta && c.fecha === fecha);
    if (ya) tx.update(t.cuadres).set({ saldoRealCent, saldoCalculadoCent, esPartida: false, estimado: false }).where(eq(t.cuadres.id, ya.id)).run();
    else tx.insert(t.cuadres).values({ cuenta, fecha, saldoRealCent, saldoCalculadoCent }).run();
  });
}

export function anotarValor(db: BaseDatos, fecha: string, valorCent: number) {
  db.insert(t.valoracionesInversion).values({ fecha, valorCent }).onConflictDoUpdate({ target: t.valoracionesInversion.fecha, set: { valorCent } }).run();
}

export const quitarValor = (db: BaseDatos, fecha: string) => db.delete(t.valoracionesInversion).where(eq(t.valoracionesInversion.fecha, fecha)).run();

/** El interés lo liquida el banco: se puede corregir a mano. A cero, se quita. */
export function guardarInteres(db: BaseDatos, cuenta: Cuenta, mes: string, importeCent: number) {
  if (!importeCent) return db.delete(t.intereses).where(and(eq(t.intereses.cuenta, cuenta), eq(t.intereses.mes, mes))).run();
  db.insert(t.intereses).values({ cuenta, mes, importeCent }).onConflictDoUpdate({ target: [t.intereses.cuenta, t.intereses.mes], set: { importeCent } }).run();
}

export const ultimoCuadre = (db: BaseDatos, cuenta: Cuenta) =>
  db.select().from(t.cuadres).all().filter((c) => c.cuenta === cuenta).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id).at(-1) ?? null;
