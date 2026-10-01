"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import * as imp from "@/db/importar";
import { gruposActivos, todosLosGrupos, ultimosPorConcepto } from "@/db/movimientos";
import * as t from "@/db/schema";
import { conSesion, exigirSesion, type Resultado } from "@/lib/auth/exigir";
import { esFechaISO, esMes } from "@/lib/formato";
import { leerLibro } from "@/lib/importar/excel";
import { aFormulario, aplicarMapeo, leerCSV, proponerLineas, proponerMapeo, type Mapeo, type Propuesta } from "@/lib/importar/extracto";
import { leerHojaSeguimiento, type Celda } from "@/lib/importar/hoja";
import { validarMovimiento } from "@/lib/movimientos";

const refrescar = () => revalidatePath("/", "layout");
const MAX = 10 * 1024 * 1024;

async function archivoDe(f: FormData) {
  const a = f.get("archivo");
  if (!(a instanceof File) || a.size === 0) throw new Error("Elige un archivo.");
  if (a.size > MAX) throw new Error("El archivo pasa de 10 MB.");
  return a;
}

/* ---------- Carga inicial ---------- */

async function leerCarga(f: FormData) {
  const a = await archivoDe(f);
  if (!/\.xlsx$/i.test(a.name)) throw new Error("La carga inicial es tu hoja de seguimiento en .xlsx (en Google Sheets: Archivo › Descargar › Microsoft Excel).");
  const base = db();
  // Desde el primer mes con recurrentes, nómina, traspasos y fijos los apuntan ellos
  const desde = base.select({ d: t.recurrentes.desde }).from(t.recurrentes).orderBy(t.recurrentes.desde).limit(1).get()?.d ?? "2026-10";
  const r = leerHojaSeguimiento(await leerLibro(await a.arrayBuffer()), { anio: Number(desde.slice(0, 4)), mesRecurrentes: desde });
  return { nombre: a.name, ...r };
}

export type VistaPreviaCarga = { nombre: string; avisos: string[]; meses: { mes: string; apuntes: number; gastos: number; efectivo: number }[]; total: number };

export async function previsualizarCarga(f: FormData): Promise<{ ok: true; vista: VistaPreviaCarga } | { ok: false; error: string }> {
  try {
    await exigirSesion();
    if (imp.cargaInicialHecha(db())) return { ok: false, error: "La carga inicial ya está hecha." };
    const r = await leerCarga(f);
    const meses = new Map<string, { mes: string; apuntes: number; gastos: number; efectivo: number }>();
    for (const m of r.movimientos) {
      const k = m.fechaCargo.slice(0, 7);
      const x = meses.get(k) ?? { mes: k, apuntes: 0, gastos: 0, efectivo: 0 };
      x.apuntes++;
      if (m.tipo === "gasto") x.gastos += m.importeCent;
      if (m.medio === "efectivo") x.efectivo++;
      meses.set(k, x);
    }
    return { ok: true, vista: { nombre: r.nombre, avisos: r.avisos, meses: [...meses.values()].sort((a, b) => a.mes.localeCompare(b.mes)), total: r.movimientos.length } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function hacerCargaInicial(f: FormData): Promise<Resultado> {
  return conSesion(async () => {
    const r = await leerCarga(f);
    if (!r.movimientos.length) return { ok: false, error: "No he encontrado movimientos en la hoja." };
    const { cargados, omitidos } = imp.guardarCargaInicial(db(), r.nombre, r.movimientos);
    refrescar();
    return { ok: true, mensaje: `${cargados} apuntes cargados${omitidos.length ? `; ${omitidos.length} ya estaban en la app y no se han repetido` : ""}. Revísalos por lotes.` };
  });
}

/* ---------- Revisión ---------- */

export async function confirmarMeses(meses: { mes: string; fecha: string }[]): Promise<Resultado & { antes?: imp.Antes[] }> {
  try {
    await exigirSesion();
    if (meses.some((m) => !esMes(m.mes) || !esFechaISO(m.fecha) || m.fecha.slice(0, 7) !== m.mes)) return { ok: false, error: "La fecha tiene que caer en su mes." };
    const antes = meses.flatMap((m) => imp.confirmarMesCarga(db(), m.mes, m.fecha));
    refrescar();
    return { ok: true, mensaje: `${antes.length} apuntes confirmados`, antes };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function clasificarConceptos(lotes: imp.Clasificacion[]): Promise<Resultado & { antes?: imp.Antes[] }> {
  try {
    await exigirSesion();
    const grupos = todosLosGrupos(db()).map((g) => g.id);
    for (const l of lotes) {
      if (!grupos.includes(l.grupoId)) return { ok: false, error: "Elige un grupo." };
      for (const x of Object.values(l.excepciones ?? {})) {
        if (x.grupoId != null && !grupos.includes(x.grupoId)) return { ok: false, error: "Grupo no válido." };
        if (x.medio != null && !t.MEDIOS.includes(x.medio)) return { ok: false, error: "Medio no válido." };
        if (x.fechaCargo != null && !esFechaISO(x.fechaCargo)) return { ok: false, error: "Fecha no válida." };
      }
      l.etiqueta = l.etiqueta?.trim().slice(0, 60) || null;
    }
    const antes = imp.clasificarCarga(db(), lotes);
    refrescar();
    return { ok: true, mensaje: `${antes.length} apunte${antes.length === 1 ? "" : "s"} clasificado${antes.length === 1 ? "" : "s"}`, antes };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deshacer(antes: imp.Antes[]): Promise<Resultado> {
  return conSesion(() => {
    imp.deshacerRevision(db(), antes);
    refrescar();
    return { ok: true, mensaje: "Deshecho" };
  });
}

/* ---------- Extracto ---------- */

export type ExtractoLeido = { nombre: string; tabla: Celda[][]; mapeo: Mapeo; mapeoGuardado: string | null };

export async function leerExtracto(f: FormData): Promise<{ ok: true; extracto: ExtractoLeido } | { ok: false; error: string }> {
  try {
    await exigirSesion();
    const a = await archivoDe(f);
    let tabla: Celda[][];
    if (/\.xlsx$/i.test(a.name)) tabla = Object.values(await leerLibro(await a.arrayBuffer()))[0] ?? [];
    else if (/\.(csv|txt)$/i.test(a.name)) {
      const bytes = new Uint8Array(await a.arrayBuffer());
      // Los bancos españoles a veces exportan en Windows-1252
      let texto = new TextDecoder("utf-8").decode(bytes);
      if (texto.includes("�")) texto = new TextDecoder("windows-1252").decode(bytes);
      tabla = leerCSV(texto);
    } else return { ok: false, error: "El extracto tiene que ser .csv o .xlsx." };
    if (tabla.length < 2) return { ok: false, error: "El archivo está vacío." };
    // Si guardaste un mapeo y la cabecera sigue igual, se reutiliza
    const guardado = imp.mapeosGuardados(db()).find((m) => {
      const c = m.configuracion as Mapeo & { cabecera?: string[] };
      return JSON.stringify((tabla[c.filaCabecera] ?? []).map((x) => String(x ?? ""))) === JSON.stringify(c.cabecera ?? []);
    });
    const mapeo = guardado ? (guardado.configuracion as Mapeo) : proponerMapeo(tabla);
    return { ok: true, extracto: { nombre: a.name, tabla: tabla.slice(0, 2000), mapeo, mapeoGuardado: guardado?.nombre ?? null } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function proponerExtracto(tabla: Celda[][], mapeo: Mapeo): Promise<{ ok: true; propuestas: Propuesta[]; errores: { fila: number; motivo: string }[] } | { ok: false; error: string }> {
  try {
    await exigirSesion();
    const base = db();
    const { lineas, errores } = aplicarMapeo(tabla, mapeo);
    const aprendido = new Map(ultimosPorConcepto(base).filter((u) => u.tipo === "gasto" && u.grupoId).map((u) => [u.conceptoNorm, { grupoId: u.grupoId!, etiqueta: u.etiqueta }]));
    const otros = gruposActivos(base).find((g) => g.nombre === "Otros")?.id ?? gruposActivos(base)[0].id;
    const propuestas = proponerLineas(lineas, { existentes: imp.existentesComparables(base), aprendido, reglas: base.select().from(t.reglasImportacion).all(), grupoPorDefecto: otros });
    return { ok: true, propuestas, errores };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function guardarLineas(p: { archivo: string; tabla: Celda[][]; mapeo: Mapeo; nombreMapeo: string | null; filasLeidas: number; propuestas: Propuesta[] }): Promise<Resultado> {
  return conSesion(() => {
    const base = db();
    const grupos = todosLosGrupos(base).map((g) => g.id);
    const aceptadas = p.propuestas.filter((x) => x.aceptar);
    const movimientos = [];
    for (const x of aceptadas) {
      const r = validarMovimiento(aFormulario(x), grupos);
      if (!r.ok) return { ok: false, error: `Fila ${x.linea.fila} («${x.linea.concepto}»): ${Object.values(r.errores)[0]}` };
      const { cubrirConHucha, ...d } = r.datos;
      void cubrirConHucha;
      movimientos.push(d);
    }
    let mapeoId: number | null = null;
    if (p.nombreMapeo?.trim()) {
      const cabecera = (p.tabla[p.mapeo.filaCabecera] ?? []).map((x) => String(x ?? ""));
      mapeoId = imp.guardarMapeo(base, p.nombreMapeo.trim().slice(0, 40), { ...p.mapeo, cabecera });
    }
    imp.guardarExtracto(base, { archivo: p.archivo, mapeoId, filasLeidas: p.filasLeidas, descartadas: p.propuestas.length - aceptadas.length, movimientos });
    refrescar();
    return { ok: true, mensaje: `${movimientos.length} movimiento${movimientos.length === 1 ? "" : "s"} importado${movimientos.length === 1 ? "" : "s"}` };
  });
}

export async function crearReglaImportacion(patron: string, grupoId: number, etiqueta: string | null): Promise<Resultado> {
  return conSesion(() => {
    const p = patron.trim().toLowerCase().slice(0, 120);
    if (!p) return { ok: false, error: "Escribe las palabras de la regla." };
    if (!todosLosGrupos(db()).some((g) => g.id === grupoId)) return { ok: false, error: "Elige un grupo." };
    imp.crearRegla(db(), p, grupoId, etiqueta?.trim() || null);
    refrescar();
    return { ok: true, mensaje: `Regla creada: «${p}»` };
  });
}
