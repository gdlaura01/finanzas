/**
 * Presupuesto y calendario anual. Funciones puras; importes en céntimos.
 */
import { MESES, leerImporte, sumarMeses } from "./formato";
import { eventoAplica, normalizar, presupuestoGrupo, type Evento, type Grupo } from "./reglas";

/* ---------- Plan del mes ---------- */

export type EntradaPlan = {
  grupos: (Grupo & { activo: boolean; efectivoPrevistoCent?: number })[];
  eventos: Evento[];
  mes: string;
  nominaCent: number;
  traspasoTrCent: number;
  huchaCent: number;
};

/**
 * ¿Cierra el mes? Nómina − ahorro − hucha − lo que el presupuesto de los grupos pide a la nómina.
 * A la nómina solo le toca la parte que no se paga en efectivo (nunca más que el propio presupuesto).
 */
export function planMes(e: EntradaPlan) {
  const activos = e.grupos.filter((g) => g.activo);
  const presupuesto = activos.reduce((a, g) => a + presupuestoGrupo(g, e.mes, e.eventos), 0);
  const efectivo = activos.reduce((a, g) => a + Math.min(g.efectivoPrevistoCent ?? 0, presupuestoGrupo(g, e.mes, e.eventos)), 0);
  const conNomina = presupuesto - efectivo;
  const margen = e.nominaCent - e.traspasoTrCent - e.huchaCent - conNomina;
  const estado = margen < 0 ? ("no_cierra" as const) : margen < 5000 ? ("justo" as const) : ("cierra" as const);
  return { presupuesto, efectivo, conNomina, margen, estado };
}

/* ---------- Calendario ---------- */

export type VistaCalendario = "proximos" | "anio";

/** Los 12 meses que se ven: los próximos desde el actual, o enero a diciembre de un año. */
export function mesesCalendario(vista: VistaCalendario, mesHoy: string, anio: number) {
  if (vista === "anio") return MESES.map((_, i) => `${anio}-${String(i + 1).padStart(2, "0")}`);
  return Array.from({ length: 12 }, (_, i) => sumarMeses(mesHoy, i));
}

/** Eventos de un mes concreto (AAAA-MM), por día y nombre. */
export function eventosDeMes<T extends Evento & { nombre: string }>(eventos: T[], mes: string): T[] {
  const [a, m] = mes.split("-").map(Number);
  return eventos
    .filter((e) => e.mes === m && eventoAplica(e, a))
    .sort((x, y) => (x.dia ?? 0) - (y.dia ?? 0) || x.nombre.localeCompare(y.nombre, "es"));
}

/** Lo previsto y lo gastado en los eventos de unos meses, y lo que conviene apartar cada mes. */
export function resumenCalendario<T extends Evento & { id: number; nombre: string }>(eventos: T[], meses: string[], gastado: (e: T, anio: number) => number) {
  let previsto = 0, real = 0;
  for (const mes of meses)
    for (const e of eventosDeMes(eventos, mes)) {
      previsto += e.importePrevistoCent;
      real += gastado(e, Number(mes.slice(0, 4)));
    }
  return { previsto, gastado: real, apartarAlMes: Math.round(previsto / 12) };
}

/* ---------- Eventos ---------- */

/** Etiqueta que se propone al escribir el nombre: sus tres primeras palabras. */
export function etiquetaDesdeNombre(nombre: string) {
  const t = nombre.trim().split(/\s+/).slice(0, 3).join(" ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const DIAS_MAX = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export type FormularioEvento = {
  nombre?: string;
  mes?: string;
  dia?: string;
  grupoId?: string;
  etiqueta?: string;
  importe?: string;
  notas?: string;
  color?: string;
  soloEsteAnio?: string;
  anio?: string;
};

export type DatosEvento = {
  nombre: string;
  mes: number | null;
  dia: number | null;
  anio: number | null;
  grupoId: number;
  etiqueta: string;
  color: string | null;
  importePrevistoCent: number;
  notas: string | null;
};

export type ErroresEvento = Partial<Record<"nombre" | "mes" | "dia" | "grupoId" | "etiqueta" | "importe" | "color", string>>;

/**
 * Comprueba un evento. La etiqueta enlaza el gasto real con el evento, así que no puede
 * repetirse (sin mirar tildes ni mayúsculas). Vacía, toma el nombre.
 */
export function validarEvento(
  f: FormularioEvento,
  ctx: { grupos: number[]; etiquetasDeOtros: string[] },
): { ok: true; datos: DatosEvento } | { ok: false; errores: ErroresEvento } {
  const errores: ErroresEvento = {};
  const nombre = (f.nombre ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  if (!nombre) errores.nombre = "Ponle un nombre al evento.";

  const mes = f.mes ? Number(f.mes) : null;
  if (mes != null && !(Number.isInteger(mes) && mes >= 1 && mes <= 12)) errores.mes = "Elige un mes.";

  const diaTexto = (f.dia ?? "").trim();
  const dia = diaTexto ? Number(diaTexto) : null;
  if (dia != null) {
    if (!(Number.isInteger(dia) && dia >= 1 && dia <= 31)) errores.dia = "El día tiene que estar entre 1 y 31, o vacío.";
    else if (mes != null && !errores.mes && dia > DIAS_MAX[mes - 1]) errores.dia = `${MESES[mes - 1]} no tiene día ${dia}.`;
  }

  const grupoId = Number(f.grupoId);
  if (!ctx.grupos.includes(grupoId)) errores.grupoId = "Elige un grupo.";

  const imp = leerImporte(f.importe);
  if (imp == null || Number.isNaN(imp) || imp < 0) errores.importe = "Escribe el importe previsto, por ejemplo 30,00.";

  const etiqueta = ((f.etiqueta ?? "").trim() || nombre).replace(/\s+/g, " ").slice(0, 60);
  if (etiqueta && ctx.etiquetasDeOtros.some((x) => normalizar(x) === normalizar(etiqueta)))
    errores.etiqueta = `Ya hay otro evento con la etiqueta «${etiqueta}». Cámbiala para que el gasto real no se mezcle.`;

  const color = f.color ? f.color : null;
  if (color && !/^#[0-9a-f]{6}$/i.test(color)) errores.color = "Color no válido.";

  const anio = f.soloEsteAnio === "on" ? Number(f.anio) : null;
  if (anio != null && !(Number.isInteger(anio) && anio >= 2000 && anio <= 2100)) errores.mes = "Año no válido.";

  if (Object.keys(errores).length) return { ok: false, errores };
  return {
    ok: true,
    datos: { nombre, mes, dia, anio, grupoId, etiqueta, color, importePrevistoCent: imp!, notas: (f.notas ?? "").trim().slice(0, 200) || null },
  };
}

/* ---------- Parámetros del plan ---------- */

export const PARAMETROS_PLAN = {
  nomina_cent: "Nómina neta mensual",
  traspaso_tr_cent: "Traspaso mensual a Trade Republic",
  paso_inversion_cent: "De ello, pasa a Inversión TR el día 2",
  objetivo_hucha_cent: "Objetivo mensual de la hucha",
} as const;
export type ParametroPlan = keyof typeof PARAMETROS_PLAN;

/** Valida un parámetro del plan; lo que pasa a Inversión TR no puede superar el traspaso. */
export function validarParametro(clave: string, texto: string, actuales: Partial<Record<ParametroPlan, number>>): { ok: true; valor: number } | { ok: false; error: string } {
  if (!(clave in PARAMETROS_PLAN)) return { ok: false, error: "Parámetro desconocido." };
  const v = leerImporte(texto);
  if (v == null || Number.isNaN(v) || v < 0) return { ok: false, error: "Escribe un importe, por ejemplo 800,00." };
  if (clave === "paso_inversion_cent" && v > (actuales.traspaso_tr_cent ?? Infinity)) return { ok: false, error: "No puede pasar a Inversión TR más de lo que traspasas a Trade Republic." };
  if (clave === "traspaso_tr_cent" && v < (actuales.paso_inversion_cent ?? 0)) return { ok: false, error: "El traspaso no puede ser menor que lo que pasa a Inversión TR." };
  return { ok: true, valor: v };
}
