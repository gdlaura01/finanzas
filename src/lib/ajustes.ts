/**
 * Ajustes: validación de recurrentes, atajos, grupos y reglas, y su orden. Funciones puras.
 */
import { MEDIOS, type Medio } from "@/db/schema";
import { leerImporte } from "./formato";
import { MEDIO_POR_CLASE, type ClaseForm } from "./movimientos";
import { normalizar } from "./reglas";

/** Sube o baja un elemento una posición; devuelve el nuevo orden de ids. */
export function mover(ids: number[], id: number, dir: -1 | 1) {
  const i = ids.indexOf(id), j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  const out = [...ids];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

const texto = (s: string | undefined, max: number) => (s ?? "").trim().replace(/\s+/g, " ").slice(0, max);
const importeOpcional = (s: string | undefined) => {
  if (!s?.trim()) return { ok: true as const, valor: null };
  const v = leerImporte(s);
  return v == null || Number.isNaN(v) || v < 0 ? { ok: false as const } : { ok: true as const, valor: v };
};
const diaOpcional = (s: string | undefined) => {
  if (!s?.trim()) return { ok: true as const, valor: null };
  const d = Number(s);
  return Number.isInteger(d) && d >= 1 && d <= 31 ? { ok: true as const, valor: d } : { ok: false as const };
};

type Errores = Record<string, string>;

/* ---------- Recurrentes ---------- */

export const CLASES_RECURRENTE_NUEVO = ["gasto", "entrada", "ahorro", "hucha"] as const;

export type DatosRecurrente = {
  concepto: string;
  clase?: (typeof CLASES_RECURRENTE_NUEVO)[number];
  grupoId: number | null;
  etiqueta: string | null;
  medio: Medio;
  importeCent: number | null;
  dia: number | null;
  auto: boolean;
  activo: boolean;
};

/**
 * Valida un recurrente. Los nuevos pueden ser gasto, entrada, ahorro o hucha; los que van
 * ligados a un parámetro (nómina, traspaso a TR) no cambian su importe aquí.
 * «Se apunta solo» exige un día fijo y un importe.
 */
export function validarRecurrente(
  f: Record<string, string | undefined>,
  ctx: { grupos: number[]; nuevo: boolean; clase?: string; vinculado: boolean },
): { ok: true; datos: DatosRecurrente } | { ok: false; errores: Errores } {
  const e: Errores = {};
  const concepto = texto(f.concepto, 80);
  if (!concepto) e.concepto = "Ponle un concepto.";
  const clase = (ctx.nuevo ? f.clase : ctx.clase) as string;
  if (ctx.nuevo && !CLASES_RECURRENTE_NUEVO.includes(clase as never)) e.clase = "Elige el tipo.";
  const dia = diaOpcional(f.dia);
  if (!dia.ok) e.dia = "El día tiene que estar entre 1 y 31, o vacío.";
  const imp = ctx.vinculado || clase === "interes" || clase === "valoracion" ? { ok: true as const, valor: null } : importeOpcional(f.importe);
  if (!imp.ok) e.importe = "Escribe el importe, por ejemplo 9,99, o déjalo vacío si varía.";
  const grupoId = clase === "gasto" ? Number(f.grupoId) : null;
  if (clase === "gasto" && !ctx.grupos.includes(grupoId!)) e.grupoId = "Elige un grupo.";
  const medio = (f.medio || MEDIO_POR_CLASE[clase as ClaseForm] || "imagin") as Medio;
  if (!MEDIOS.includes(medio)) e.medio = "Elige un medio.";
  const auto = f.auto === "on";
  if (auto && dia.ok && dia.valor == null) e.dia = "«Se apunta solo» necesita un día fijo.";
  if (auto && imp.ok && imp.valor == null && !ctx.vinculado && clase !== "interes" && clase !== "valoracion") e.importe = "«Se apunta solo» necesita un importe.";
  if (Object.keys(e).length) return { ok: false, errores: e };
  return {
    ok: true,
    datos: {
      concepto,
      ...(ctx.nuevo ? { clase: clase as DatosRecurrente["clase"] } : {}),
      grupoId,
      etiqueta: clase === "gasto" ? texto(f.etiqueta, 60) || null : null,
      medio,
      importeCent: imp.ok ? imp.valor : null,
      dia: dia.ok ? dia.valor : null,
      auto,
      activo: f.activo !== "off",
    },
  };
}

/* ---------- Atajos ---------- */

export function validarAtajo(f: Record<string, string | undefined>, grupos: number[]) {
  const e: Errores = {};
  const textoBoton = texto(f.textoBoton, 24), concepto = texto(f.concepto, 80);
  if (!textoBoton) e.textoBoton = "Escribe el texto del botón.";
  if (!concepto) e.concepto = "Escribe el concepto que rellena.";
  const clase = f.clase as ClaseForm;
  if (!["gasto", "entrada", "ahorro", "hucha", "retirada"].includes(clase)) e.clase = "Elige el tipo.";
  const imp = importeOpcional(f.importe);
  if (!imp.ok) e.importe = "Importe no válido: déjalo vacío si varía.";
  const conGrupo = clase === "gasto" || (clase === "entrada" && f.entradaComo !== "ingreso");
  const grupoId = conGrupo && f.grupoId ? Number(f.grupoId) : null;
  if (grupoId != null && !grupos.includes(grupoId)) e.grupoId = "Grupo no válido.";
  const medio = (f.medio || "imagin") as Medio;
  if (!MEDIOS.includes(medio)) e.medio = "Elige un medio.";
  if (Object.keys(e).length) return { ok: false as const, errores: e };
  return {
    ok: true as const,
    datos: {
      textoBoton, concepto, clase, medio,
      entradaComo: clase === "entrada" ? (f.entradaComo === "ingreso" ? ("ingreso" as const) : f.entradaComo === "devolucion" ? ("devolucion" as const) : null) : null,
      grupoId,
      etiqueta: texto(f.etiqueta, 60) || null,
      importeCent: imp.ok ? imp.valor : null,
    },
  };
}

/* ---------- Grupos ---------- */

export function validarGrupo(f: Record<string, string | undefined>, ctx: { nombresDeOtros: string[]; nuevo: boolean }) {
  const e: Errores = {};
  const nombre = texto(f.nombre, 30);
  if (!nombre) e.nombre = "Escribe un nombre.";
  else if (ctx.nombresDeOtros.some((n) => normalizar(n) === normalizar(nombre))) e.nombre = "Ya hay un grupo con ese nombre.";
  const color = f.color ?? "";
  if (!/^#[0-9a-f]{6}$/i.test(color)) e.color = "Elige un color.";
  const imp = ctx.nuevo ? importeOpcional(f.presupuesto) : { ok: true as const, valor: null };
  if (!imp.ok) e.presupuesto = "Presupuesto no válido.";
  if (Object.keys(e).length) return { ok: false as const, errores: e };
  return { ok: true as const, datos: { nombre, color, presupuestoCent: imp.ok ? (imp.valor ?? 0) : 0 } };
}

/* ---------- Reglas ---------- */

/** «repsol, cepsa, ^bar» → «repsol|cepsa|^bar»: sin tildes ni mayúsculas, escapando lo que no sea ^ o $. */
export function palabrasAPatron(palabras: string) {
  return palabras
    .split(",")
    .map((w) => normalizar(w))
    .filter(Boolean)
    .map((w) => w.replace(/[.*+?(){}[\]\\|]/g, "\\$&"))
    .join("|");
}

/** Para enseñar una regla: sus palabras, con «al inicio» o «exacto» si llevan ^ o $. */
export function patronAPalabras(patron: string) {
  return patron
    .split("|")
    .map((w) => w.trim())
    .filter(Boolean)
    .map((w) => {
      const limpio = w.replace(/^\^|\$$/g, "").replace(/\\(.)/g, "$1");
      if (/^\^.*\$$/.test(w)) return `«${limpio}» exacto`;
      if (w.startsWith("^")) return `«${limpio}» al inicio`;
      return limpio;
    });
}

/** Al editar: el patrón como palabras separadas por comas. */
export const patronAEditable = (patron: string) =>
  patron
    .split("|")
    .map((w) => w.trim().replace(/\\(.)/g, "$1"))
    .filter(Boolean)
    .join(", ");
