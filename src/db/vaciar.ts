/** «Vaciar datos»: todo a cero para empezar de nuevo, conservando la configuración. */
import { count } from "drizzle-orm";
import type { BaseDatos } from ".";
import * as t from "./schema";

/**
 * Borra todos los movimientos e importaciones (también la carga inicial), los saldos de
 * partida y cuadres, los intereses y los valores de Inversión TR. Deja cada cuenta con un
 * saldo de partida de 0 € el 31/12 del año anterior, para que lo que importes se sume desde cero.
 * Se conservan grupos, presupuestos, calendario, recurrentes, atajos, reglas y parámetros.
 */
export function vaciarDatos(db: BaseDatos, hoyISO: string) {
  const partida = `${Number(hoyISO.slice(0, 4)) - 1}-12-31`;
  return db.transaction((tx) => {
    const movimientos = tx.select({ n: count() }).from(t.movimientos).get()!.n;
    tx.delete(t.recurrentesOmitidos).run();
    // Primero las retiradas de la hucha enlazadas, luego el resto (las importaciones las referencian)
    tx.update(t.movimientos).set({ vinculadoId: null }).run();
    tx.delete(t.movimientos).run();
    tx.delete(t.importaciones).run();
    tx.delete(t.cuadres).run();
    tx.delete(t.intereses).run();
    tx.delete(t.valoracionesInversion).run();
    tx.insert(t.cuadres)
      .values((["imagin", "ahorro_tr", "hucha_revolut"] as const).map((cuenta) => ({ cuenta, fecha: partida, saldoRealCent: 0, esPartida: true })))
      .run();
    return { movimientos, partida };
  });
}
