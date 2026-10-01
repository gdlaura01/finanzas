/** Escrituras de Ajustes: recurrentes, atajos, grupos y reglas de importación. */
import { asc, eq, sql } from "drizzle-orm";
import type { BaseDatos } from ".";
import * as t from "./schema";
import type { DatosRecurrente } from "@/lib/ajustes";

/* ---------- Recurrentes ---------- */

const CUENTAS_RECURRENTE = {
  gasto: { cuentaOrigen: null, cuentaDestino: null },
  entrada: { cuentaOrigen: null, cuentaDestino: "imagin" },
  ahorro: { cuentaOrigen: "imagin", cuentaDestino: "ahorro_tr" },
  hucha: { cuentaOrigen: "imagin", cuentaDestino: "hucha_revolut" },
} as const;

export function crearRecurrente(db: BaseDatos, d: DatosRecurrente, desde: string) {
  const clase = d.clase ?? "gasto";
  return db.insert(t.recurrentes).values({ ...d, clase, ...CUENTAS_RECURRENTE[clase], desde }).returning({ id: t.recurrentes.id }).get().id;
}

export function editarRecurrente(db: BaseDatos, id: number, d: DatosRecurrente) {
  const r = db.select().from(t.recurrentes).where(eq(t.recurrentes.id, id)).get();
  if (!r) throw new Error("Ese recurrente ya no existe.");
  const { clase, ...resto } = d;
  void clase;
  // Los ligados a un parámetro conservan su importe (se cambia en Presupuesto)
  db.update(t.recurrentes).set(r.vinculo ? { ...resto, importeCent: r.importeCent } : resto).where(eq(t.recurrentes.id, id)).run();
}

export const cambiarInterruptorRecurrente = (db: BaseDatos, id: number, campo: "auto" | "activo", valor: boolean) =>
  db.update(t.recurrentes).set({ [campo]: valor }).where(eq(t.recurrentes.id, id)).returning({ concepto: t.recurrentes.concepto, dia: t.recurrentes.dia }).get();

/** Solo se borran los que creaste tú; los movimientos que generó se quedan. */
export function borrarRecurrente(db: BaseDatos, id: number) {
  const r = db.select().from(t.recurrentes).where(eq(t.recurrentes.id, id)).get();
  if (!r) return null;
  if (r.vinculo || r.clase === "interes" || r.clase === "valoracion" || r.clase === "interno") throw new Error("Este recurrente es parte de la app: desactívalo si no lo quieres.");
  db.delete(t.recurrentes).where(eq(t.recurrentes.id, id)).run();
  return r;
}

/* ---------- Orden ---------- */

function reordenar(db: BaseDatos, tabla: typeof t.atajos | typeof t.grupos, ids: number[]) {
  db.transaction((tx) => ids.forEach((id, i) => tx.update(tabla).set({ orden: i + 1 }).where(eq(tabla.id, id)).run()));
}

/* ---------- Atajos ---------- */

type DatosAtajo = Omit<typeof t.atajos.$inferInsert, "id" | "orden" | "usos">;

export function crearAtajo(db: BaseDatos, d: DatosAtajo) {
  const max = db.select({ m: sql<number>`coalesce(max(${t.atajos.orden}), 0)` }).from(t.atajos).get()!.m;
  return db.insert(t.atajos).values({ ...d, orden: max + 1 }).returning({ id: t.atajos.id }).get().id;
}
export const editarAtajo = (db: BaseDatos, id: number, d: DatosAtajo) => db.update(t.atajos).set(d).where(eq(t.atajos.id, id)).run();
export const borrarAtajo = (db: BaseDatos, id: number) => db.delete(t.atajos).where(eq(t.atajos.id, id)).run();
export const ordenarAtajos = (db: BaseDatos, ids: number[]) => reordenar(db, t.atajos, ids);
export const idsAtajos = (db: BaseDatos) => db.select({ id: t.atajos.id }).from(t.atajos).orderBy(asc(t.atajos.orden)).all().map((x) => x.id);

/* ---------- Grupos ---------- */

/** Un grupo nuevo se coloca antes de «Otros», que queda siempre al final. */
export function crearGrupo(db: BaseDatos, d: { nombre: string; color: string; presupuestoCent: number }) {
  return db.transaction((tx) => {
    const todos = tx.select().from(t.grupos).orderBy(asc(t.grupos.orden)).all();
    const otros = todos.find((g) => g.nombre === "Otros");
    const id = tx.insert(t.grupos).values({ ...d, orden: todos.length + 1 }).returning({ id: t.grupos.id }).get().id;
    const ids = todos.map((g) => g.id).filter((x) => x !== otros?.id);
    ids.push(id);
    if (otros) ids.push(otros.id);
    ids.forEach((gid, i) => tx.update(t.grupos).set({ orden: i + 1 }).where(eq(t.grupos.id, gid)).run());
    return id;
  });
}

export const editarGrupo = (db: BaseDatos, id: number, d: { nombre: string; color: string }) => db.update(t.grupos).set(d).where(eq(t.grupos.id, id)).run();
export const ordenarGrupos = (db: BaseDatos, ids: number[]) => reordenar(db, t.grupos, ids);
export const idsGrupos = (db: BaseDatos) => db.select({ id: t.grupos.id }).from(t.grupos).orderBy(asc(t.grupos.orden)).all().map((x) => x.id);

/** Cuántas cosas usan un grupo: con alguna, se archiva en vez de borrarse. */
export function usosGrupo(db: BaseDatos, id: number) {
  const n = (tabla: typeof t.movimientos | typeof t.eventos | typeof t.recurrentes | typeof t.atajos | typeof t.reglasImportacion) =>
    db.select({ n: sql<number>`count(*)` }).from(tabla).where(eq(tabla.grupoId, id)).get()!.n;
  return { movimientos: n(t.movimientos), otros: n(t.eventos) + n(t.recurrentes) + n(t.atajos) + n(t.reglasImportacion) };
}

/** Archiva el grupo si se usa en algo; si no, lo borra. Reactivar lo vuelve a ofrecer. */
export function archivarGrupo(db: BaseDatos, id: number, activo: boolean) {
  const g = db.select().from(t.grupos).where(eq(t.grupos.id, id)).get();
  if (!g) throw new Error("Ese grupo ya no existe.");
  if (g.esDinamico || g.nombre === "Otros") throw new Error(`${g.nombre} no se puede archivar.`);
  if (activo) {
    db.update(t.grupos).set({ activo: true }).where(eq(t.grupos.id, id)).run();
    return "reactivado" as const;
  }
  const u = usosGrupo(db, id);
  if (u.movimientos + u.otros > 0) {
    db.update(t.grupos).set({ activo: false }).where(eq(t.grupos.id, id)).run();
    return "archivado" as const;
  }
  db.delete(t.grupos).where(eq(t.grupos.id, id)).run();
  return "borrado" as const;
}

/* ---------- Reglas ---------- */

const reglasEnOrden = (db: BaseDatos) => db.select().from(t.reglasImportacion).orderBy(asc(t.reglasImportacion.prioridad), asc(t.reglasImportacion.id)).all();

/** Una regla nueva va la primera: así gana a las generales. */
export function crearRegla(db: BaseDatos, d: { patron: string; grupoId: number; etiqueta: string | null }) {
  const min = reglasEnOrden(db)[0]?.prioridad ?? 20;
  return db.insert(t.reglasImportacion).values({ ...d, prioridad: min - 10 }).returning({ id: t.reglasImportacion.id }).get().id;
}
export const editarRegla = (db: BaseDatos, id: number, d: { patron: string; grupoId: number; etiqueta: string | null }) => db.update(t.reglasImportacion).set(d).where(eq(t.reglasImportacion.id, id)).run();
export const borrarRegla = (db: BaseDatos, id: number) => db.delete(t.reglasImportacion).where(eq(t.reglasImportacion.id, id)).run();

/** Sube o baja una regla: se renumeran todas de 10 en 10 en el orden nuevo. */
export function ordenarReglas(db: BaseDatos, ids: number[]) {
  db.transaction((tx) => ids.forEach((id, i) => tx.update(t.reglasImportacion).set({ prioridad: (i + 1) * 10 }).where(eq(t.reglasImportacion.id, id)).run()));
}
export const idsReglas = (db: BaseDatos) => reglasEnOrden(db).map((r) => r.id);
