/** Todo lo que necesita el panel, leído de una vez. */
import { desc } from "drizzle-orm";
import type { BaseDatos } from ".";
import * as t from "./schema";
import { leerParametros, pendientes, porRevisar } from "./movimientos";

export function datosPanel(db: BaseDatos, mes: string, hoyISO: string) {
  return {
    grupos: db.select().from(t.grupos).orderBy(t.grupos.orden).all(),
    eventos: db.select().from(t.eventos).all(),
    movs: db.select().from(t.movimientos).all(),
    ultimos: db.select().from(t.movimientos).orderBy(desc(t.movimientos.fechaCargo), desc(t.movimientos.id)).limit(10).all(),
    cuadres: db.select().from(t.cuadres).all(),
    intereses: db.select().from(t.intereses).all(),
    valoraciones: db.select().from(t.valoracionesInversion).all(),
    parametros: leerParametros(db),
    pendientes: pendientes(db, mes, hoyISO),
    porRevisar: porRevisar(db),
  };
}
