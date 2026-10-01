/** Escritura de las importaciones: carga inicial y extractos. */
import { and, eq, inArray, sql } from "drizzle-orm";
import type { BaseDatos } from ".";
import * as t from "./schema";
import { normalizar } from "@/lib/reglas";
import { buscarDuplicado, type Comparable } from "@/lib/importar/duplicados";
import type { MovCarga } from "@/lib/importar/hoja";
import type { DatosMovimiento } from "@/lib/movimientos";

export const cargaInicialHecha = (db: BaseDatos) =>
  !!db.select({ id: t.movimientos.id }).from(t.movimientos).where(eq(t.movimientos.origen, "carga_inicial")).limit(1).get();

export function existentesComparables(db: BaseDatos): Comparable[] {
  return db
    .select({ id: t.movimientos.id, fechaCargo: t.movimientos.fechaCargo, importeCent: t.movimientos.importeCent, concepto: t.movimientos.concepto, tipo: t.movimientos.tipo })
    .from(t.movimientos)
    .all();
}

/**
 * Guarda la carga inicial, una sola vez. Lo que ya estaba en la app (mismo importe y
 * cargo a 2 días o menos) no se vuelve a cargar. Todo queda pendiente de revisar.
 */
export function guardarCargaInicial(db: BaseDatos, archivo: string, movs: MovCarga[]) {
  if (cargaInicialHecha(db)) throw new Error("La carga inicial ya está hecha. Corrige lo que haga falta desde Revisar carga inicial o Movimientos.");
  const grupos = Object.fromEntries(db.select().from(t.grupos).all().map((g) => [normalizar(g.nombre), g.id]));
  const existentes = existentesComparables(db);
  const usados = new Set<Comparable>();
  const omitidos: { mov: MovCarga; con: Comparable }[] = [];
  const cargados = db.transaction((tx) => {
    const imp = tx.insert(t.importaciones).values({ archivo: `Carga inicial · ${archivo}`, filasLeidas: movs.length }).returning({ id: t.importaciones.id }).get();
    let n = 0;
    for (const m of movs) {
      const d = buscarDuplicado(m, existentes, usados);
      if (d) {
        usados.add(d.con);
        omitidos.push({ mov: m, con: d.con });
        continue;
      }
      const { grupo, ...resto } = m;
      tx.insert(t.movimientos)
        .values({ ...resto, grupoId: grupo ? (grupos[normalizar(grupo)] ?? null) : null, conceptoNorm: normalizar(m.concepto), origen: "carga_inicial", importacionId: imp.id, pendienteRevision: true })
        .run();
      n++;
    }
    tx.update(t.importaciones).set({ aceptadas: n, descartadas: omitidos.length }).where(eq(t.importaciones.id, imp.id)).run();
    return n;
  });
  return { cargados, omitidos };
}

/* ---------- Revisión de la carga inicial ---------- */

export const pendientesDeRevisar = (db: BaseDatos) =>
  db.select().from(t.movimientos).where(eq(t.movimientos.pendienteRevision, true)).orderBy(t.movimientos.fechaCargo, t.movimientos.id).all();

export type Antes = Pick<typeof t.movimientos.$inferSelect, "id" | "fechaCompra" | "fechaCargo" | "grupoId" | "etiqueta" | "medio" | "notas" | "pendienteRevision">;

const foto = (m: typeof t.movimientos.$inferSelect): Antes => ({
  id: m.id, fechaCompra: m.fechaCompra, fechaCargo: m.fechaCargo, grupoId: m.grupoId, etiqueta: m.etiqueta, medio: m.medio, notas: m.notas, pendienteRevision: m.pendienteRevision,
});

/** Confirma los apuntes que no son gastos de un mes (nómina, traspasos) con el día real. Devuelve cómo estaban, para deshacer. */
export function confirmarMesCarga(db: BaseDatos, mes: string, fecha: string): Antes[] {
  return db.transaction((tx) => {
    const filas = tx.select().from(t.movimientos)
      .where(and(eq(t.movimientos.pendienteRevision, true), sql`${t.movimientos.tipo} <> 'gasto'`, sql`substr(${t.movimientos.fechaCargo}, 1, 7) = ${mes}`))
      .all();
    for (const m of filas)
      tx.update(t.movimientos)
        .set({ fechaCompra: fecha, fechaCargo: fecha, pendienteRevision: false, notas: m.notas?.startsWith("Fecha supuesta") ? null : m.notas, actualizadoEn: new Date().toISOString() })
        .where(eq(t.movimientos.id, m.id))
        .run();
    return filas.map(foto);
  });
}

export type Clasificacion = {
  ids: number[];
  grupoId: number;
  etiqueta: string | null;
  /** Excepciones por apunte: otro grupo, otro medio u otra fecha de cargo. */
  excepciones?: Record<number, { grupoId?: number; medio?: (typeof t.MEDIOS)[number]; fechaCargo?: string }>;
};

/** Clasifica gastos pendientes por lotes. Devuelve cómo estaban, para deshacer. */
export function clasificarCarga(db: BaseDatos, lotes: Clasificacion[]): Antes[] {
  return db.transaction((tx) => {
    const antes: Antes[] = [];
    for (const l of lotes) {
      const filas = tx.select().from(t.movimientos).where(and(inArray(t.movimientos.id, l.ids), eq(t.movimientos.pendienteRevision, true))).all();
      for (const m of filas) {
        antes.push(foto(m));
        const x = l.excepciones?.[m.id] ?? {};
        const cargo = x.fechaCargo ?? m.fechaCargo;
        tx.update(t.movimientos)
          .set({
            grupoId: x.grupoId ?? l.grupoId,
            etiqueta: l.etiqueta,
            medio: x.medio ?? m.medio,
            fechaCargo: cargo,
            // Si cambias el cargo y la compra coincidía (o queda después), la compra le sigue
            fechaCompra: m.fechaCompra === m.fechaCargo || cargo < m.fechaCompra ? cargo : m.fechaCompra,
            pendienteRevision: false,
            actualizadoEn: new Date().toISOString(),
          })
          .where(eq(t.movimientos.id, m.id))
          .run();
      }
    }
    return antes;
  });
}

export function deshacerRevision(db: BaseDatos, antes: Antes[]) {
  db.transaction((tx) => {
    for (const a of antes) {
      const { id, ...resto } = a;
      tx.update(t.movimientos).set(resto).where(eq(t.movimientos.id, id)).run();
    }
  });
}

/* ---------- Extractos ---------- */

export const mapeosGuardados = (db: BaseDatos) => db.select().from(t.mapeosExtracto).orderBy(t.mapeosExtracto.nombre).all();

export function guardarMapeo(db: BaseDatos, nombre: string, configuracion: unknown) {
  return db
    .insert(t.mapeosExtracto)
    .values({ nombre, configuracion })
    .onConflictDoUpdate({ target: t.mapeosExtracto.nombre, set: { configuracion } })
    .returning({ id: t.mapeosExtracto.id })
    .get().id;
}

/** Guarda las líneas aceptadas de un extracto, ya validadas, y apunta la importación. */
export function guardarExtracto(db: BaseDatos, p: { archivo: string; mapeoId: number | null; filasLeidas: number; descartadas: number; movimientos: Omit<DatosMovimiento, "cubrirConHucha">[] }) {
  return db.transaction((tx) => {
    const imp = tx.insert(t.importaciones)
      .values({ archivo: p.archivo, mapeoId: p.mapeoId, filasLeidas: p.filasLeidas, aceptadas: p.movimientos.length, descartadas: p.descartadas })
      .returning({ id: t.importaciones.id })
      .get();
    for (const m of p.movimientos) tx.insert(t.movimientos).values({ ...m, conceptoNorm: normalizar(m.concepto), origen: "importacion", importacionId: imp.id }).run();
    return imp.id;
  });
}

/** Regla nueva por delante de las que ya hay, para que gane a las generales. */
export function crearRegla(db: BaseDatos, patron: string, grupoId: number, etiqueta: string | null) {
  const min = db.select({ p: sql<number>`coalesce(min(${t.reglasImportacion.prioridad}), 10)` }).from(t.reglasImportacion).get()!.p;
  return db.insert(t.reglasImportacion).values({ patron, grupoId, etiqueta, prioridad: min - 10 }).returning({ id: t.reglasImportacion.id }).get().id;
}
