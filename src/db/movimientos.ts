/**
 * Lectura y escritura de movimientos y recurrentes. Cada función recibe la base
 * de datos para poder probarla con una en memoria.
 */
import { and, desc, eq, inArray, like, ne, sql } from "drizzle-orm";
import type { BaseDatos } from ".";
import * as t from "./schema";
import { normalizar } from "@/lib/reglas";
import {
  automaticosPendientes,
  esDeMovimiento,
  movimientoDeRecurrente,
  pendientesMes,
  retiradaQueCubre,
  type DatosMovimiento,
  type Hechos,
  type Parametros,
  type Recurrente,
} from "@/lib/movimientos";

export type Movimiento = typeof t.movimientos.$inferSelect;
export type Grupo = typeof t.grupos.$inferSelect;
export type Atajo = typeof t.atajos.$inferSelect;
export type Evento = typeof t.eventos.$inferSelect;

const ahora = () => new Date().toISOString();

export function leerParametros(db: BaseDatos): Parametros & Record<string, unknown> {
  return Object.fromEntries(db.select().from(t.parametros).all().map((p) => [p.clave, p.valor]));
}

/* ---------- Movimientos ---------- */

function fila(d: Omit<DatosMovimiento, "cubrirConHucha">) {
  return { ...d, conceptoNorm: normalizar(d.concepto) };
}

/** Guarda un movimiento; si es un gasto cubierto con la hucha, también su retirada enlazada. */
export function crearMovimiento(db: BaseDatos, d: DatosMovimiento, origen: "manual" | "atajo" = "manual") {
  return db.transaction((tx) => {
    const { cubrirConHucha, ...resto } = d;
    const { id } = tx.insert(t.movimientos).values({ ...fila(resto), origen }).returning({ id: t.movimientos.id }).get();
    if (cubrirConHucha && d.tipo === "gasto" && d.importeCent > 0 && d.medio !== "revolut") {
      tx.insert(t.movimientos).values({ ...fila({ ...retiradaQueCubre(d), grupoId: null, notas: null }), origen, vinculadoId: id }).run();
    }
    return id;
  });
}

/**
 * Cambia un movimiento. Si tenía una retirada de la hucha enlazada, la ajusta al nuevo
 * importe y fechas; si deja de ser un gasto que pueda cubrirse, la borra.
 */
export function editarMovimiento(db: BaseDatos, id: number, d: DatosMovimiento) {
  return db.transaction((tx) => {
    const previo = tx.select().from(t.movimientos).where(eq(t.movimientos.id, id)).get();
    if (!previo) throw new Error("Ese movimiento ya no existe.");
    const { cubrirConHucha, ...resto } = d;
    void cubrirConHucha;
    tx.update(t.movimientos).set({ ...fila(resto), pendienteRevision: false, actualizadoEn: ahora() }).where(eq(t.movimientos.id, id)).run();
    const enlazada = tx.select().from(t.movimientos).where(eq(t.movimientos.vinculadoId, id)).get();
    if (!enlazada) return { retirada: "ninguna" as const };
    if (d.tipo === "gasto" && d.importeCent > 0 && d.medio !== "revolut") {
      tx.update(t.movimientos)
        .set({ ...fila({ ...retiradaQueCubre(d), grupoId: null, notas: enlazada.notas }), actualizadoEn: ahora() })
        .where(eq(t.movimientos.id, enlazada.id))
        .run();
      return { retirada: "ajustada" as const };
    }
    tx.delete(t.movimientos).where(eq(t.movimientos.id, enlazada.id)).run();
    return { retirada: "borrada" as const };
  });
}

/** Borra un movimiento; su retirada enlazada se va con él (ON DELETE CASCADE). */
export function borrarMovimiento(db: BaseDatos, id: number) {
  return db.delete(t.movimientos).where(eq(t.movimientos.id, id)).returning({ concepto: t.movimientos.concepto }).get();
}

/** Movimientos de un mes (por fecha de cargo), o todos si no hay mes. Los más recientes primero. */
export function listarMovimientos(db: BaseDatos, mes: string | null) {
  return db
    .select()
    .from(t.movimientos)
    .where(mes ? like(t.movimientos.fechaCargo, `${mes}-%`) : undefined)
    .orderBy(desc(t.movimientos.fechaCargo), desc(t.movimientos.id))
    .all();
}

/** Meses con algún movimiento, del más reciente al más antiguo. */
export function mesesConMovimientos(db: BaseDatos) {
  return db
    .selectDistinct({ mes: sql<string>`substr(${t.movimientos.fechaCargo}, 1, 7)` })
    .from(t.movimientos)
    .orderBy(desc(sql`1`))
    .all()
    .map((r) => r.mes);
}

/** Lo último que has apuntado a mano (sin la carga inicial ni las importaciones). */
export function recientes(db: BaseDatos, n = 6) {
  return db
    .select()
    .from(t.movimientos)
    .where(inArray(t.movimientos.origen, ["manual", "atajo", "recurrente"]))
    .orderBy(desc(t.movimientos.id))
    .limit(n)
    .all();
}

/**
 * Cómo clasificaste cada concepto la última vez: sirve para proponer grupo,
 * etiqueta y medio al volver a escribirlo.
 */
export function ultimosPorConcepto(db: BaseDatos, limite = 400) {
  const filas = db
    .select({
      conceptoNorm: t.movimientos.conceptoNorm,
      concepto: t.movimientos.concepto,
      tipo: t.movimientos.tipo,
      importeCent: t.movimientos.importeCent,
      grupoId: t.movimientos.grupoId,
      etiqueta: t.movimientos.etiqueta,
      medio: t.movimientos.medio,
      cuentaOrigen: t.movimientos.cuentaOrigen,
      cuentaDestino: t.movimientos.cuentaDestino,
    })
    .from(t.movimientos)
    .where(and(eq(t.movimientos.pendienteRevision, false), sql`${t.movimientos.vinculadoId} is null`))
    .orderBy(desc(t.movimientos.id))
    .limit(limite * 4)
    .all();
  const vistos = new Map<string, (typeof filas)[number]>();
  for (const f of filas) if (!vistos.has(f.conceptoNorm) && vistos.size < limite) vistos.set(f.conceptoNorm, f);
  return [...vistos.values()];
}

export function etiquetasUsadas(db: BaseDatos) {
  const deMovs = db.selectDistinct({ e: t.movimientos.etiqueta }).from(t.movimientos).where(sql`${t.movimientos.etiqueta} is not null`).all();
  const deEventos = db.select({ e: t.eventos.etiqueta }).from(t.eventos).all();
  return [...new Set([...deMovs, ...deEventos].map((r) => r.e!).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
}

export const gruposActivos = (db: BaseDatos) => db.select().from(t.grupos).where(eq(t.grupos.activo, true)).orderBy(t.grupos.orden).all();
export const todosLosGrupos = (db: BaseDatos) => db.select().from(t.grupos).orderBy(t.grupos.orden).all();

/** Atajos ordenados: los que más usas primero; a igualdad, el orden que les diste. */
export const atajosPorUso = (db: BaseDatos) => db.select().from(t.atajos).orderBy(desc(t.atajos.usos), t.atajos.orden).all();

export function usarAtajo(db: BaseDatos, id: number) {
  db.update(t.atajos).set({ usos: sql`${t.atajos.usos} + 1` }).where(eq(t.atajos.id, id)).run();
}

/* ---------- Recurrentes ---------- */

function hechos(db: BaseDatos): Hechos {
  return {
    registrados: new Set(
      db.select({ r: t.movimientos.recurrenteId, p: t.movimientos.periodo }).from(t.movimientos).where(sql`${t.movimientos.recurrenteId} is not null`).all().map((x) => `${x.r}|${x.p}`),
    ),
    omitidos: new Set(db.select().from(t.recurrentesOmitidos).all().map((x) => `${x.recurrenteId}|${x.periodo}`)),
    intereses: new Set(db.select().from(t.intereses).all().map((x) => `${x.cuenta}|${x.mes}`)),
    valoraciones: new Set(db.select().from(t.valoracionesInversion).all().map((x) => x.fecha.slice(0, 7))),
  };
}

const recurrentes = (db: BaseDatos) => db.select().from(t.recurrentes).orderBy(t.recurrentes.id).all() as Recurrente[];

export function pendientes(db: BaseDatos, mes: string, hoyISO: string) {
  return pendientesMes(recurrentes(db), hechos(db), mes, hoyISO, leerParametros(db));
}

/** Apunta los recurrentes marcados como «se apunta solo» cuya fecha ya ha llegado. */
export function registrarAutomaticos(db: BaseDatos, hoyISO: string) {
  const lista = automaticosPendientes(recurrentes(db), hechos(db), hoyISO, leerParametros(db));
  if (!lista.length) return 0;
  db.transaction((tx) => {
    for (const a of lista) {
      const m = movimientoDeRecurrente(a.recurrente, a.fecha, a.importeCent, a.periodo, null);
      tx.insert(t.movimientos).values({ ...m, conceptoNorm: normalizar(m.concepto) }).onConflictDoNothing().run();
    }
  });
  return lista.length;
}

/**
 * Confirma un recurrente de un mes con la fecha y el importe reales.
 * Los intereses van a su tabla (se cobran el día 1) y el valor de Inversión TR a la suya.
 */
export function confirmarRecurrente(db: BaseDatos, p: { recurrenteId: number; periodo: string; fecha: string; importeCent: number; notas: string | null }) {
  const r = db.select().from(t.recurrentes).where(eq(t.recurrentes.id, p.recurrenteId)).get() as Recurrente | undefined;
  if (!r) throw new Error("Ese recurrente ya no existe.");
  const importe = Math.abs(p.importeCent);
  if (r.clase === "interes") {
    const cuenta = r.cuentaDestino ?? "ahorro_tr";
    db.insert(t.intereses).values({ cuenta, mes: p.periodo, importeCent: importe })
      .onConflictDoUpdate({ target: [t.intereses.cuenta, t.intereses.mes], set: { importeCent: importe } }).run();
    return r;
  }
  if (r.clase === "valoracion") {
    db.insert(t.valoracionesInversion).values({ fecha: p.fecha, valorCent: importe })
      .onConflictDoUpdate({ target: t.valoracionesInversion.fecha, set: { valorCent: importe } }).run();
    return r;
  }
  if (!esDeMovimiento(r)) throw new Error("Este recurrente no genera un movimiento.");
  const ya = db.select({ id: t.movimientos.id }).from(t.movimientos)
    .where(and(eq(t.movimientos.recurrenteId, r.id), eq(t.movimientos.periodo, p.periodo))).get();
  if (ya) throw new Error(`«${r.concepto}» ya está registrado este mes.`);
  const m = movimientoDeRecurrente(r, p.fecha, importe, p.periodo, p.notas);
  db.insert(t.movimientos).values({ ...m, conceptoNorm: normalizar(m.concepto) }).run();
  return r;
}

export function omitirRecurrente(db: BaseDatos, recurrenteId: number, periodo: string) {
  db.insert(t.recurrentesOmitidos).values({ recurrenteId, periodo }).onConflictDoNothing().run();
  return db.select().from(t.recurrentes).where(eq(t.recurrentes.id, recurrenteId)).get();
}

/** Cambia el día previsto de cada mes. Sin día, deja de apuntarse solo. */
export function cambiarDiaRecurrente(db: BaseDatos, recurrenteId: number, dia: number | null) {
  db.update(t.recurrentes).set(dia ? { dia } : { dia: null, auto: false }).where(eq(t.recurrentes.id, recurrenteId)).run();
  return db.select().from(t.recurrentes).where(eq(t.recurrentes.id, recurrenteId)).get();
}

/** Cuántos movimientos de la carga inicial o importados quedan por revisar. */
export const porRevisar = (db: BaseDatos) =>
  db.select({ n: sql<number>`count(*)` }).from(t.movimientos).where(and(eq(t.movimientos.pendienteRevision, true), ne(t.movimientos.origen, "manual"))).get()!.n;
