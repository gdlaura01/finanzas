/**
 * Cómo se registran los movimientos. Funciones puras, sin base de datos.
 *
 * Tú apuntas importes en positivo y eliges qué es (gasto, entrada de dinero…);
 * aquí se traduce al modelo interno: tipo + importe con signo + cuentas.
 */
import type { Cuenta, Medio, Tipo } from "@/db/schema";
import { MEDIOS } from "@/db/schema";
import { esFechaISO, fechaEnMes, leerImporte, sumarMeses } from "./formato";

/** Lo que eliges al registrar. */
export const CLASES_FORM = {
  gasto: "Gasto",
  entrada: "Entrada de dinero",
  ahorro: "Ahorro",
  hucha: "A la hucha",
  retirada: "Sacar de la hucha",
} as const;
export type ClaseForm = keyof typeof CLASES_FORM;

/** Cómo se ve cada movimiento en las listas. */
export const CLASES = {
  gasto: "Gasto",
  devolucion: "Devolución",
  ingreso: "Ingreso",
  ahorro: "Ahorro",
  traspaso: "A la hucha",
  retirada: "Sacado de la hucha",
  interno: "Entre cuentas",
} as const;
export type Clase = keyof typeof CLASES;

export const NOMBRE_MEDIO: Record<Medio, string> = {
  imagin: "Imagin",
  revolut: "Revolut",
  efectivo: "Efectivo",
  trade_republic: "Trade Republic",
};

export const NOMBRE_CUENTA: Record<Cuenta, string> = {
  imagin: "Imagin",
  ahorro_tr: "Ahorro TR",
  inversion_tr: "Inversión TR",
  hucha_revolut: "Hucha",
};

/** Medio que se propone al cambiar de clase. */
export const MEDIO_POR_CLASE: Record<ClaseForm, Medio> = {
  gasto: "imagin",
  entrada: "imagin",
  ahorro: "trade_republic",
  hucha: "revolut",
  retirada: "revolut",
};

type MovClase = { tipo: Tipo; importeCent: number; cuentaOrigen?: Cuenta | null; cuentaDestino?: Cuenta | null };

export function claseDe(m: MovClase): Clase {
  if (m.tipo === "gasto") return m.importeCent < 0 ? "devolucion" : "gasto";
  if (m.tipo === "interno") return m.cuentaOrigen === "hucha_revolut" && m.cuentaDestino === "imagin" ? "retirada" : "interno";
  return m.tipo;
}

/** Entra en tu cuenta (+), sale (−) o se mueve entre tus cuentas (0). */
export function sentido(m: MovClase): 1 | -1 | 0 {
  const c = claseDe(m);
  if (c === "ingreso" || c === "devolucion" || c === "retirada") return 1;
  if (c === "interno") return 0;
  return -1;
}

/** Una entrada de dinero es ingreso solo si parece nómina o similar; si no, es la devolución de un gasto. */
const RX_INGRESO = /n[oó]mina|salario|sueldo|paga extra|intereses|hacienda|irpf|transferencia recibida/i;
export const clasificarEntrada = (concepto: string): "ingreso" | "devolucion" => (RX_INGRESO.test(concepto) ? "ingreso" : "devolucion");

/** La clase de lista vuelve a la del formulario (para editar). */
export function claseFormDe(c: Clase): { clase: ClaseForm | "interno"; entradaComo?: "ingreso" | "devolucion" } {
  if (c === "devolucion" || c === "ingreso") return { clase: "entrada", entradaComo: c };
  if (c === "traspaso") return { clase: "hucha" };
  return { clase: c };
}

export type DatosMovimiento = {
  fechaCompra: string;
  fechaCargo: string;
  concepto: string;
  tipo: Tipo;
  medio: Medio;
  importeCent: number;
  grupoId: number | null;
  etiqueta: string | null;
  notas: string | null;
  cuentaOrigen: Cuenta | null;
  cuentaDestino: Cuenta | null;
  /** Solo en gastos: apunta también una retirada de la hucha por el mismo importe. */
  cubrirConHucha: boolean;
};

/** Lo que llega del formulario, todo como texto. */
export type EntradaFormulario = {
  clase?: string;
  entradaComo?: string;
  fechaCompra?: string;
  fechaCargo?: string;
  concepto?: string;
  importe?: string;
  grupoId?: string;
  medio?: string;
  etiqueta?: string;
  notas?: string;
  cuentaDestino?: string;
  cubrirConHucha?: string;
  /** Al editar un movimiento entre cuentas se conservan sus cuentas. */
  cuentaOrigenActual?: string;
  cuentaDestinoActual?: string;
};

export type Errores = Partial<Record<"clase" | "fechaCompra" | "fechaCargo" | "concepto" | "importe" | "grupoId" | "medio" | "cuentaDestino", string>>;

const limpio = (s: string | undefined, max: number) => {
  const t = (s ?? "").trim().replace(/\s+/g, " ").slice(0, max);
  return t || null;
};

/** Comprueba lo escrito y lo traduce al modelo interno. */
export function validarMovimiento(e: EntradaFormulario, gruposValidos: number[]): { ok: true; datos: DatosMovimiento } | { ok: false; errores: Errores } {
  const errores: Errores = {};
  const clase = e.clase as ClaseForm | "interno";
  if (!(clase in CLASES_FORM) && clase !== "interno") errores.clase = "Elige qué estás registrando.";

  if (!esFechaISO(e.fechaCompra)) errores.fechaCompra = "Fecha no válida.";
  if (!esFechaISO(e.fechaCargo)) errores.fechaCargo = "Fecha no válida.";
  else if (esFechaISO(e.fechaCompra) && e.fechaCargo < e.fechaCompra) errores.fechaCargo = "El cargo no puede ser anterior a la compra.";

  const concepto = limpio(e.concepto, 120);
  if (!concepto) errores.concepto = "Escribe un concepto.";

  const imp = leerImporte(e.importe);
  if (imp == null || Number.isNaN(imp) || imp === 0) errores.importe = "Escribe un importe, por ejemplo 12,50.";
  else if (imp < 0) errores.importe = "Escríbelo en positivo: el tipo ya dice si entra o sale.";

  const medio = e.medio as Medio;
  if (!MEDIOS.includes(medio)) errores.medio = "Elige un medio.";

  const como = e.entradaComo === "ingreso" || e.entradaComo === "devolucion" ? e.entradaComo : clasificarEntrada(concepto ?? "");
  const conGrupo = clase === "gasto" || (clase === "entrada" && como === "devolucion");
  const grupoId = conGrupo ? Number(e.grupoId) : null;
  if (conGrupo && !gruposValidos.includes(grupoId!)) errores.grupoId = "Elige un grupo.";

  const destinoAhorro = e.cuentaDestino === "inversion_tr" ? "inversion_tr" : e.cuentaDestino === "ahorro_tr" || !e.cuentaDestino ? "ahorro_tr" : null;
  if (clase === "ahorro" && !destinoAhorro) errores.cuentaDestino = "Elige Ahorro TR o Inversión TR.";

  if (Object.keys(errores).length) return { ok: false, errores };

  const importe = imp!;
  const base = {
    fechaCompra: e.fechaCompra!,
    fechaCargo: e.fechaCargo!,
    concepto: concepto!,
    medio,
    etiqueta: limpio(e.etiqueta, 60),
    notas: limpio(e.notas, 300),
    grupoId,
    cuentaOrigen: null as Cuenta | null,
    cuentaDestino: null as Cuenta | null,
    cubrirConHucha: false,
  };
  let datos: DatosMovimiento;
  switch (clase) {
    case "gasto":
      datos = { ...base, tipo: "gasto", importeCent: importe, cubrirConHucha: e.cubrirConHucha === "on" && medio !== "revolut" };
      break;
    case "entrada":
      datos = como === "ingreso"
        ? { ...base, tipo: "ingreso", importeCent: importe, cuentaDestino: "imagin" }
        : { ...base, tipo: "gasto", importeCent: -importe };
      break;
    case "ahorro":
      datos = { ...base, tipo: "ahorro", importeCent: importe, cuentaOrigen: "imagin", cuentaDestino: destinoAhorro };
      break;
    case "hucha":
      datos = { ...base, tipo: "traspaso", importeCent: importe, cuentaOrigen: "imagin", cuentaDestino: "hucha_revolut" };
      break;
    case "retirada":
      datos = { ...base, tipo: "interno", importeCent: importe, cuentaOrigen: "hucha_revolut", cuentaDestino: "imagin" };
      break;
    case "interno":
      datos = {
        ...base,
        tipo: "interno",
        importeCent: importe,
        cuentaOrigen: (e.cuentaOrigenActual as Cuenta) || "ahorro_tr",
        cuentaDestino: (e.cuentaDestinoActual as Cuenta) || "inversion_tr",
      };
      break;
  }
  return { ok: true, datos };
}

/** La retirada de la hucha que acompaña a un gasto cubierto con ella. */
export function retiradaQueCubre(g: Pick<DatosMovimiento, "fechaCompra" | "fechaCargo" | "concepto" | "importeCent" | "etiqueta">) {
  return {
    fechaCompra: g.fechaCompra,
    fechaCargo: g.fechaCargo,
    concepto: `Retirada de la hucha · ${g.concepto}`,
    tipo: "interno" as const,
    medio: "revolut" as const,
    importeCent: g.importeCent,
    etiqueta: g.etiqueta,
    cuentaOrigen: "hucha_revolut" as const,
    cuentaDestino: "imagin" as const,
  };
}

/* ---------- Recurrentes ---------- */

export type Recurrente = {
  id: number;
  concepto: string;
  clase: "entrada" | "gasto" | "ahorro" | "hucha" | "interno" | "interes" | "valoracion";
  grupoId: number | null;
  etiqueta: string | null;
  medio: Medio;
  cuentaOrigen: Cuenta | null;
  cuentaDestino: Cuenta | null;
  importeCent: number | null;
  vinculo: "nomina" | "traspaso_tr" | "paso_inversion" | null;
  dia: number | null;
  auto: boolean;
  activo: boolean;
  desde: string;
};

export type Parametros = Partial<Record<"nomina_cent" | "traspaso_tr_cent" | "paso_inversion_cent", number>>;

/** Importe propuesto: el del parámetro si está vinculado (nómina, traspaso a TR…), si no, el suyo. */
export function importeRecurrente(r: Pick<Recurrente, "vinculo" | "importeCent">, p: Parametros) {
  if (r.vinculo === "nomina") return p.nomina_cent ?? null;
  if (r.vinculo === "traspaso_tr") return p.traspaso_tr_cent ?? null;
  if (r.vinculo === "paso_inversion") return p.paso_inversion_cent ?? null;
  return r.importeCent;
}

export function describirRecurrente(r: Pick<Recurrente, "clase" | "medio" | "cuentaOrigen" | "cuentaDestino">, grupo?: string | null) {
  switch (r.clase) {
    case "entrada": return "Ingreso en Imagin";
    case "ahorro": return `De Imagin a ${NOMBRE_CUENTA[r.cuentaDestino ?? "ahorro_tr"]}`;
    case "interno": return `De ${NOMBRE_CUENTA[r.cuentaOrigen ?? "ahorro_tr"]} a ${NOMBRE_CUENTA[r.cuentaDestino ?? "inversion_tr"]}, dentro de Trade Republic: no toca Imagin`;
    case "interes": return "Interés neto que te paga el banco";
    case "valoracion": return "El valor que ves en la pestaña «Cartera» de la app de Trade Republic";
    case "hucha": return "De Imagin a la hucha de Revolut";
    case "gasto": return ["Gasto", grupo, NOMBRE_MEDIO[r.medio]].filter(Boolean).join(" · ");
  }
}

/** Se apuntan como movimiento; intereses y valoraciones van a sus propias tablas. */
export const esDeMovimiento = (r: Pick<Recurrente, "clase">) => r.clase !== "interes" && r.clase !== "valoracion";

export type Hechos = {
  /** `${recurrenteId}|${periodo}` ya registrados. */
  registrados: Set<string>;
  /** `${recurrenteId}|${periodo}` omitidos. */
  omitidos: Set<string>;
  /** `${cuenta}|${mes}` con intereses anotados. */
  intereses: Set<string>;
  /** Meses `AAAA-MM` con valor de Inversión TR anotado. */
  valoraciones: Set<string>;
};

export type Pendiente = { recurrente: Recurrente; fechaPrevista: string | null; importeCent: number | null };

function hecho(r: Recurrente, mes: string, h: Hechos) {
  const k = `${r.id}|${mes}`;
  if (h.omitidos.has(k)) return true;
  if (r.clase === "interes") return h.intereses.has(`${r.cuentaDestino}|${mes}`);
  if (r.clase === "valoracion") return h.valoraciones.has(mes);
  return h.registrados.has(k);
}

/** Recurrentes de un mes que aún no has confirmado ni omitido, por fecha prevista (los sin día, primero). */
export function pendientesMes(recurrentes: Recurrente[], h: Hechos, mes: string, hoyISO: string, p: Parametros): Pendiente[] {
  if (mes > hoyISO.slice(0, 7)) return [];
  return recurrentes
    .filter((r) => r.activo && mes >= r.desde && !hecho(r, mes, h))
    .map((r) => ({
      recurrente: r,
      fechaPrevista: r.clase === "interes" ? `${mes}-01` : r.dia ? fechaEnMes(mes, r.dia) : null,
      importeCent: importeRecurrente(r, p),
    }))
    .sort((a, b) => (a.fechaPrevista ?? "").localeCompare(b.fechaPrevista ?? "") || a.recurrente.id - b.recurrente.id);
}

/** Los que «se apuntan solos»: con día fijo e importe conocido, cuya fecha ya ha llegado. */
export function automaticosPendientes(recurrentes: Recurrente[], h: Hechos, hoyISO: string, p: Parametros) {
  const out: { recurrente: Recurrente; periodo: string; fecha: string; importeCent: number }[] = [];
  for (const r of recurrentes) {
    if (!r.activo || !r.auto || !r.dia || !esDeMovimiento(r)) continue;
    const importe = importeRecurrente(r, p);
    if (importe == null) continue;
    for (let mes = r.desde; mes <= hoyISO.slice(0, 7); mes = sumarMeses(mes, 1)) {
      const fecha = fechaEnMes(mes, r.dia);
      if (fecha <= hoyISO && !hecho(r, mes, h)) out.push({ recurrente: r, periodo: mes, fecha, importeCent: importe });
    }
  }
  return out;
}

/** El movimiento que genera un recurrente al confirmarlo. */
export function movimientoDeRecurrente(r: Recurrente, fecha: string, importeCent: number, periodo: string, notas: string | null) {
  const base = {
    fechaCompra: fecha,
    fechaCargo: fecha,
    concepto: r.concepto,
    etiqueta: r.etiqueta,
    medio: r.medio,
    notas,
    importeCent: Math.abs(importeCent),
    grupoId: null as number | null,
    cuentaOrigen: null as Cuenta | null,
    cuentaDestino: null as Cuenta | null,
    recurrenteId: r.id,
    periodo,
    origen: "recurrente" as const,
  };
  switch (r.clase) {
    case "entrada": return { ...base, tipo: "ingreso" as const, cuentaDestino: "imagin" as const };
    case "ahorro": return { ...base, tipo: "ahorro" as const, cuentaOrigen: r.cuentaOrigen ?? "imagin", cuentaDestino: r.cuentaDestino ?? "ahorro_tr" };
    case "interno": return { ...base, tipo: "interno" as const, cuentaOrigen: r.cuentaOrigen, cuentaDestino: r.cuentaDestino };
    case "hucha": return { ...base, tipo: "traspaso" as const, cuentaOrigen: "imagin" as const, cuentaDestino: "hucha_revolut" as const };
    case "gasto": return { ...base, tipo: "gasto" as const, grupoId: r.grupoId };
    default: throw new Error(`«${r.concepto}» no genera un movimiento.`);
  }
}
