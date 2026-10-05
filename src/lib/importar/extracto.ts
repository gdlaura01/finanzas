/**
 * Extracto del banco (CSV o Excel). Funciones puras: leer la tabla, entender sus columnas
 * con un mapeo que puedes cambiar, y proponer cómo registrar cada línea.
 */
import { esFechaISO, importeACampo, leerImporte } from "@/lib/formato";
import { clasificarEntrada, type ClaseForm, type EntradaFormulario } from "@/lib/movimientos";
import { normalizar, sugerir, type Regla } from "@/lib/reglas";
import { buscarDuplicado, buscarPartes, type Comparable, type Duplicado } from "./duplicados";
import type { Celda } from "./hoja";

/* ---------- CSV ---------- */

/** Lee un CSV con «;», «,» o tabuladores (lo detecta) y comillas. */
export function leerCSV(texto: string): Celda[][] {
  const limpio = texto.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const muestra = limpio.split("\n").slice(0, 10).join("\n");
  const sep = [";", "\t", ","].map((s) => ({ s, n: muestra.split(s).length })).sort((a, b) => b.n - a.n)[0].s;
  const filas: string[][] = [];
  let fila: string[] = [], campo = "", comillas = false;
  const cerrarCampo = () => {
    fila.push(campo);
    campo = "";
  };
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (comillas) {
      if (c === '"' && limpio[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) cerrarCampo();
    else if (c === "\n") {
      cerrarCampo();
      filas.push(fila);
      fila = [];
    } else campo += c;
  }
  if (campo || fila.length) {
    cerrarCampo();
    filas.push(fila);
  }
  return filas.map((f) => f.map((x) => (x.trim() === "" ? null : x.trim()))).filter((f) => f.some((x) => x != null));
}

/* ---------- Mapeo de columnas ---------- */

export type Mapeo = {
  filaCabecera: number;
  /** Fecha de la operación: la de compra. */
  fecha: number;
  /** Fecha valor: cuándo se carga. Si no hay, la de la operación. */
  fechaValor: number | null;
  concepto: number;
  /** Una columna de importe con signo… */
  importe: number | null;
  /** …o dos, una de cargos y otra de abonos. */
  cargo: number | null;
  abono: number | null;
  formatoFecha: "dma" | "amd" | "mda";
};

const texto = (c: Celda) => normalizar(String(c ?? ""));

/** La primera fila que parece una cabecera: tiene una fecha, un concepto y un importe. */
export function buscarCabecera(tabla: Celda[][]) {
  return Math.max(
    0,
    tabla.slice(0, 30).findIndex((f) => {
      const t = f.map(texto);
      return t.some((x) => x.includes("fecha")) && t.some((x) => /concepto|descripci|movimiento|detalle/.test(x)) && t.some((x) => /importe|cantidad|cargo|abono|debe|haber/.test(x));
    }),
  );
}

/** Propone el mapeo por los nombres de las columnas. */
export function proponerMapeo(tabla: Celda[][]): Mapeo {
  const filaCabecera = buscarCabecera(tabla);
  const cab = (tabla[filaCabecera] ?? []).map(texto);
  const col = (re: RegExp, excepto: number[] = []) => cab.findIndex((x, i) => re.test(x) && !excepto.includes(i));
  const fechaValor = col(/fecha valor|f\.? ?valor|^valor$/);
  const fecha = col(/fecha/, [fechaValor]);
  const importe = col(/importe|cantidad/);
  const cargo = col(/^cargo|^debe|gasto/);
  const abono = col(/^abono|^haber|ingreso/);
  // Mira las primeras fechas para saber el formato
  const muestra = tabla.slice(filaCabecera + 1, filaCabecera + 20).map((f) => String(f[Math.max(fecha, 0)] ?? ""));
  const formatoFecha = muestra.some((s) => /^\d{4}[-/]/.test(s)) ? "amd" : "dma";
  return {
    filaCabecera,
    fecha: Math.max(fecha, 0),
    fechaValor: fechaValor >= 0 ? fechaValor : null,
    concepto: Math.max(col(/concepto|descripci|movimiento|detalle/), 0),
    importe: importe >= 0 ? importe : null,
    cargo: importe < 0 && cargo >= 0 ? cargo : null,
    abono: importe < 0 && abono >= 0 ? abono : null,
    formatoFecha,
  };
}

/** Fecha de una celda: ISO, dd/mm/aaaa, dd-mm-aa, número de serie de Excel… */
export function leerFecha(c: Celda, formato: Mapeo["formatoFecha"]): string | null {
  if (c == null) return null;
  if (typeof c === "number") {
    // Número de serie de Excel (días desde 1899-12-30)
    if (c < 20000 || c > 80000) return null;
    return new Date(Date.UTC(1899, 11, 30) + Math.round(c) * 864e5).toISOString().slice(0, 10);
  }
  const s = c.trim();
  if (esFechaISO(s.slice(0, 10))) return s.slice(0, 10);
  const p = s.split(/[/.\-\s]/).filter(Boolean).map(Number);
  if (p.length < 3 || p.some(Number.isNaN)) return null;
  const [d, m, aa] = formato === "amd" ? [p[2], p[1], p[0]] : formato === "mda" ? [p[1], p[0], p[2]] : p;
  const a = aa < 100 ? aa + 2000 : aa;
  const iso = `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return esFechaISO(iso) ? iso : null;
}

const leerNumero = (c: Celda) => (typeof c === "number" ? Math.round(c * 100) : leerImporte(c));

export type LineaExtracto = {
  fila: number;
  fechaCompra: string;
  fechaCargo: string;
  concepto: string;
  /** Con signo: negativo si sale dinero. */
  importeCent: number;
};

export function aplicarMapeo(tabla: Celda[][], m: Mapeo) {
  const lineas: LineaExtracto[] = [];
  const errores: { fila: number; motivo: string }[] = [];
  tabla.forEach((f, i) => {
    if (i <= m.filaCabecera || f.every((c) => c == null)) return;
    const fechaCompra = leerFecha(f[m.fecha], m.formatoFecha);
    const fechaCargo = m.fechaValor != null ? (leerFecha(f[m.fechaValor], m.formatoFecha) ?? fechaCompra) : fechaCompra;
    const concepto = String(f[m.concepto] ?? "").replace(/\s+/g, " ").trim();
    let importe: number | null = null;
    if (m.importe != null) importe = leerNumero(f[m.importe]);
    else {
      const cargo = m.cargo != null ? leerNumero(f[m.cargo]) : null, abono = m.abono != null ? leerNumero(f[m.abono]) : null;
      if (cargo != null && !Number.isNaN(cargo) && cargo !== 0) importe = -Math.abs(cargo);
      else if (abono != null && !Number.isNaN(abono)) importe = Math.abs(abono);
    }
    const fila = i + 1;
    if (!fechaCompra) return errores.push({ fila, motivo: "fecha ilegible" });
    if (importe == null || Number.isNaN(importe) || importe === 0) return errores.push({ fila, motivo: "importe ilegible o cero" });
    if (!concepto) return errores.push({ fila, motivo: "sin concepto" });
    lineas.push({ fila, fechaCompra: fechaCargo && fechaCompra > fechaCargo ? fechaCargo : fechaCompra, fechaCargo: fechaCargo!, concepto, importeCent: importe });
  });
  return { lineas, errores };
}

/* ---------- Propuestas ---------- */

export type Propuesta = {
  linea: LineaExtracto;
  clase: ClaseForm;
  entradaComo: "ingreso" | "devolucion" | null;
  grupoId: number | null;
  etiqueta: string | null;
  fuente: "aprendido" | "regla" | "nada";
  duplicado: Duplicado | null;
  /** Por qué llega desmarcada sin ser un duplicado (sacar efectivo). */
  aviso: string | null;
  /** Se guarda si la dejas marcada. Las que parecen duplicadas, o con aviso, llegan desmarcadas. */
  aceptar: boolean;
};

/** Qué es cada línea por su signo y su concepto (con los nombres que usa Imagin). */
export function claseDeLinea(l: Pick<LineaExtracto, "concepto" | "importeCent">): {
  clase: ClaseForm;
  entradaComo: "ingreso" | "devolucion" | null;
  /** Por qué llega desmarcada aunque no sea un duplicado. */
  aviso?: string;
} {
  const k = normalizar(l.concepto);
  if (l.importeCent < 0) {
    // Tus traspasos a Trade Republic se llaman «ahorro» o «inversion»
    if (/trade republic|^ahorro$|^inversion$/.test(k)) return { clase: "ahorro", entradaComo: null };
    // El traspaso mensual a la hucha de Revolut
    if (/^pago transferencias$/.test(k)) return { clase: "hucha", entradaComo: null };
    // Sacar efectivo no es gasto: lo que pagas con él lo apuntas como gasto en efectivo
    if (/reint\.? ?cajero|reintegro|retirada (de )?efectivo/.test(k))
      return { clase: "gasto", entradaComo: null, aviso: "sacar efectivo: no es un gasto (cuentan tus gastos en efectivo)" };
    // Las recargas con la tarjeta de Revolut («Revolut**0317*») son compras
    return { clase: "gasto", entradaComo: null };
  }
  if (/ingreso (en )?cajero|ingreso efectivo/.test(k)) return { clase: "entrada", entradaComo: "ingreso" };
  // Un traspaso de vuelta desde la hucha; las devoluciones de la tarjeta Revolut**… son devoluciones
  if (/revolut/.test(k) && !/revolut\*/.test(k)) return { clase: "retirada", entradaComo: null };
  return { clase: "entrada", entradaComo: clasificarEntrada(l.concepto) };
}

/** Cómo quedaría en el modelo interno, para compararla con lo que ya tienes. */
export function comoMovimiento(p: Pick<Propuesta, "clase" | "entradaComo"> & { linea: Pick<LineaExtracto, "importeCent"> }) {
  const a = Math.abs(p.linea.importeCent);
  switch (p.clase) {
    case "gasto": return { tipo: "gasto", importeCent: a };
    case "entrada": return p.entradaComo === "ingreso" ? { tipo: "ingreso", importeCent: a } : { tipo: "gasto", importeCent: -a };
    case "ahorro": return { tipo: "ahorro", importeCent: a };
    case "hucha": return { tipo: "traspaso", importeCent: a };
    case "retirada": return { tipo: "interno", importeCent: a };
  }
}

export function proponerLineas(
  lineas: LineaExtracto[],
  ctx: { existentes: Comparable[]; aprendido: Map<string, { grupoId: number; etiqueta: string | null }>; reglas: Regla[]; grupoPorDefecto: number },
): Propuesta[] {
  const usados = new Set<Comparable>();
  const propuestas: Propuesta[] = lineas.map((linea) => {
    const { clase, entradaComo, aviso } = claseDeLinea(linea);
    const conGrupo = clase === "gasto" || (clase === "entrada" && entradaComo === "devolucion");
    const s = conGrupo ? sugerir(linea.concepto, ctx.aprendido, ctx.reglas) : null;
    const modelo = comoMovimiento({ clase, entradaComo, linea });
    const duplicado = buscarDuplicado({ ...modelo, fechaCargo: linea.fechaCargo, concepto: linea.concepto }, ctx.existentes, usados);
    if (duplicado) usados.add(duplicado.con);
    return {
      linea, clase, entradaComo,
      grupoId: conGrupo ? (s?.grupoId ?? ctx.grupoPorDefecto) : null,
      etiqueta: s?.etiqueta ?? null,
      fuente: s?.fuente ?? "nada",
      duplicado,
      aviso: aviso ?? null,
      aceptar: !duplicado && !aviso,
    };
  });
  // Varias líneas que juntas son el total de un mes de tu hoja (p. ej. dos traspasos que suman el ahorro del mes)
  const modelos = propuestas.map((p) => ({ ...comoMovimiento(p), fechaCargo: p.linea.fechaCargo }));
  const libres = propuestas.flatMap((p, i) => (p.duplicado ? [] : [i]));
  for (const [i, con] of buscarPartes(modelos, libres, ctx.existentes, usados)) {
    propuestas[i] = { ...propuestas[i], duplicado: { tipo: "posible", con, parte: true }, aceptar: false };
  }
  return propuestas;
}

/** Lo que se manda a validar, como si lo hubieras escrito en el formulario. */
export function aFormulario(p: Propuesta): EntradaFormulario {
  return {
    clase: p.clase,
    entradaComo: p.entradaComo ?? "",
    fechaCompra: p.linea.fechaCompra,
    fechaCargo: p.linea.fechaCargo,
    concepto: p.linea.concepto,
    importe: importeACampo(Math.abs(p.linea.importeCent)),
    grupoId: p.grupoId ? String(p.grupoId) : "",
    medio: p.clase === "hucha" || p.clase === "retirada" ? "revolut" : p.clase === "ahorro" ? "trade_republic" : "imagin",
    etiqueta: p.etiqueta ?? "",
  };
}

const RELLENO = new Set(["compra", "tarj", "tarjeta", "pago", "movil", "contactless", "recibo", "en", "de", "la", "el", "del", "sl", "sa", "s.l", "s.a", "cargo", "transferencia", "transf", "a", "con", "num", "nº", "ref"]);

/** Patrón propuesto para una regla nueva: las palabras con sentido del concepto, sin números. */
export function patronSugerido(concepto: string) {
  const palabras = normalizar(concepto)
    .replace(/[*#.,:;()/\\-]/g, " ")
    .split(" ")
    .filter((w) => w.length >= 3 && !/\d/.test(w) && !RELLENO.has(w));
  return palabras.slice(0, 2).join(" ") || normalizar(concepto);
}
