/**
 * Lee tu hoja de «Seguimiento Financiero» para la carga inicial. Función pura: recibe
 * las celdas ya extraídas (las fechas como texto AAAA-MM-DD) y devuelve los movimientos.
 *
 * - Hoja 1 (resumen mensual): nómina y aportaciones a Trade Republic de cada mes.
 * - Gastos Fijos y Gastos Variables: bloques de 4 columnas (Mes, Fecha, Concepto, Gasto) por mes.
 * - Gastos gasolina: fecha real de cada repostaje. Sirve para poner la fecha de compra a la
 *   gasolina cargada en la cuenta y para deducir la pagada en efectivo (la que no se cargó).
 */
import type { Cuenta, Medio, Tipo } from "@/db/schema";
import { MESES, sumarDias } from "@/lib/formato";
import { normalizar } from "@/lib/reglas";

export type Celda = string | number | null;
export type Libro = Record<string, Celda[][]>;

export type MovCarga = {
  fechaCompra: string;
  fechaCargo: string;
  concepto: string;
  tipo: Tipo;
  medio: Medio;
  importeCent: number;
  /** Nombre del grupo; los gastos llegan en «Otros» hasta que los revises. */
  grupo: string | null;
  etiqueta: string | null;
  cuentaOrigen: Cuenta | null;
  cuentaDestino: Cuenta | null;
  notas: string | null;
};

export type OpcionesCarga = {
  anio: number;
  /** Desde este mes, nómina, traspasos y gastos fijos los apuntan los recurrentes: no se cargan de la hoja. */
  mesRecurrentes: string;
};

export const NOTA_FECHA_SUPUESTA = "Fecha supuesta (día 1): indica el día real en que entró";

const esFecha = (c: Celda): c is string => typeof c === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c);
const numero = (c: Celda) => (typeof c === "number" ? c : typeof c === "string" && c.trim() !== "" && !Number.isNaN(Number(c.replace(",", "."))) ? Number(c.replace(",", ".")) : null);
const cent = (n: number) => Math.round(n * 100);
const mesDeNombre = (s: Celda) => (typeof s === "string" ? MESES.indexOf(normalizar(s).replace(/\s+\d+$/, "")) + 1 : 0);
const iso = (anio: number, mes: number) => `${anio}-${String(mes).padStart(2, "0")}`;

/** «BAR LA IDEAL» → «Bar La Ideal»; lo que no está en mayúsculas se deja tal cual. */
export function capitalizar(s: string) {
  const t = s.trim().replace(/\s+/g, " ");
  if (t !== t.toUpperCase() || !/[A-ZÁÉÍÓÚÑ]/.test(t)) return t;
  return t.toLowerCase().replace(/(^|[\s\-(/])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
}

function buscarHoja(libro: Libro, nombre: string) {
  const k = Object.keys(libro).find((h) => normalizar(h) === normalizar(nombre));
  return k ? libro[k] : null;
}

/** Bloques de 4 columnas (Mes, Fecha, Concepto, Gasto): una lista de filas por mes. */
function leerBloques(filas: Celda[][], anio: number) {
  const cab = filas.findIndex((f) => f.some((c) => normalizar(String(c ?? "")) === "concepto"));
  if (cab < 0) return [];
  const out: { mes: string; fecha: string; concepto: string; importe: number }[] = [];
  const cabecera = filas[cab];
  for (let col = 0; col < cabecera.length; col++) {
    if (normalizar(String(cabecera[col] ?? "")) !== "mes") continue;
    let mes = 0;
    for (let r = cab + 1; r < filas.length; r++) {
      const f = filas[r];
      mes = mesDeNombre(f[col]) || mes;
      const [fecha, concepto, imp] = [f[col + 1], f[col + 2], numero(f[col + 3])];
      if (typeof concepto === "string" && normalizar(concepto) === "total") continue;
      if (!mes || !esFecha(fecha) || typeof concepto !== "string" || !concepto.trim() || imp == null) continue;
      out.push({ mes: iso(anio, mes), fecha, concepto: concepto.trim(), importe: cent(imp) });
    }
  }
  return out;
}

export function leerHojaSeguimiento(libro: Libro, o: OpcionesCarga): { movimientos: MovCarga[]; avisos: string[] } {
  const movs: MovCarga[] = [];
  const avisos: string[] = [];
  const base = { etiqueta: null, cuentaOrigen: null, cuentaDestino: null, notas: null, grupo: null } as const;

  // 1. Resumen mensual: nómina y Trade Republic
  const resumen = Object.values(libro).find((f) => f.some((fila) => fila.some((c) => typeof c === "string" && /ingresos/i.test(c))));
  if (!resumen) avisos.push("No encuentro la hoja de resumen mensual (con la columna «Ingresos»).");
  else {
    const cab = resumen.findIndex((f) => f.some((c) => typeof c === "string" && /ingresos/i.test(c)));
    const col = (re: RegExp) => resumen[cab].findIndex((c) => typeof c === "string" && re.test(c));
    const [cIng, cAho, cInv] = [col(/ingresos/i), col(/aportaci[oó]n al ahorro/i), col(/^inversi[oó]n$/i)];
    for (const f of resumen.slice(cab + 1)) {
      const m = mesDeNombre(f[0]);
      if (!m) continue;
      const mes = iso(o.anio, m);
      if (mes >= o.mesRecurrentes) continue;
      const dia1 = `${mes}-01`;
      const nomina = numero(f[cIng]), ahorro = numero(f[cAho]) ?? 0, inversion = cInv >= 0 ? (numero(f[cInv]) ?? 0) : 0;
      if (!nomina) continue;
      movs.push({ ...base, fechaCompra: dia1, fechaCargo: dia1, concepto: "Nómina", tipo: "ingreso", medio: "imagin", importeCent: cent(nomina), cuentaDestino: "imagin", notas: NOTA_FECHA_SUPUESTA });
      if (ahorro + inversion > 0)
        movs.push({
          ...base, fechaCompra: dia1, fechaCargo: dia1, concepto: "Traspaso a Trade Republic (ahorro + inversión)", tipo: "ahorro", medio: "trade_republic",
          importeCent: cent(ahorro + inversion), cuentaOrigen: "imagin", cuentaDestino: "ahorro_tr", notas: "Del resumen mensual de tu hoja",
        });
      if (inversion > 0)
        movs.push({
          ...base, fechaCompra: dia1, fechaCargo: dia1, concepto: "Paso de Ahorro TR a Inversión TR", tipo: "interno", medio: "trade_republic",
          importeCent: cent(inversion), cuentaOrigen: "ahorro_tr", cuentaDestino: "inversion_tr", notas: "Del resumen mensual de tu hoja",
        });
    }
  }

  // 2. Gastos fijos (hasta que empiezan los recurrentes)
  const fijos = buscarHoja(libro, "Gastos Fijos");
  if (!fijos) avisos.push("No encuentro la hoja «Gastos Fijos».");
  else
    for (const g of leerBloques(fijos, o.anio))
      if (g.mes < o.mesRecurrentes && g.importe !== 0)
        movs.push({ ...base, fechaCompra: g.fecha, fechaCargo: g.fecha, concepto: capitalizar(g.concepto), tipo: "gasto", medio: "imagin", importeCent: g.importe, grupo: "Otros", notas: "Gasto fijo de tu hoja" });

  // 3. Repostajes con su fecha real
  const gasolina = buscarHoja(libro, "Gastos gasolina");
  const repostajes = (gasolina ?? []).filter((f) => esFecha(f[0]) && numero(f[1]) != null).map((f) => ({ fecha: f[0] as string, importe: cent(numero(f[1])!), usado: false }));

  // 4. Gastos variables
  const variables = buscarHoja(libro, "Gastos Variables");
  if (!variables) avisos.push("No encuentro la hoja «Gastos Variables».");
  else
    for (const g of leerBloques(variables, o.anio)) {
      if (g.importe === 0) continue;
      const k = normalizar(g.concepto);
      if (k === "revolut") {
        movs.push({ ...base, fechaCompra: g.fecha, fechaCargo: g.fecha, concepto: "Pago con Revolut", tipo: "gasto", medio: "imagin", importeCent: g.importe, grupo: "Otros", notas: "Dinero pasado a Revolut para pagar algo: asigna el grupo real" });
        continue;
      }
      let fechaCompra = g.fecha, notas: string | null = null;
      if (k === "gasolina") {
        // La compra se carga en la cuenta hasta 3 días después
        const r = repostajes.find((x) => !x.usado && x.importe === g.importe && x.fecha <= g.fecha && sumarDias(x.fecha, 3) >= g.fecha);
        if (r) {
          r.usado = true;
          fechaCompra = r.fecha;
          if (r.fecha !== g.fecha) notas = "Fecha de compra tomada de tu hoja de gasolina";
        }
      }
      movs.push({ ...base, fechaCompra, fechaCargo: g.fecha, concepto: capitalizar(g.concepto), tipo: "gasto", medio: "imagin", importeCent: g.importe, grupo: "Otros", notas });
    }

  // 5. Repostajes que no aparecen en la cuenta: se pagaron en efectivo
  for (const r of repostajes)
    if (!r.usado)
      movs.push({
        ...base, fechaCompra: r.fecha, fechaCargo: r.fecha, concepto: "Gasolina", tipo: "gasto", medio: "efectivo", importeCent: r.importe,
        grupo: "Gasolina", etiqueta: "Trabajo", notas: "No aparece en los cargos de la cuenta: se marca efectivo",
      });

  movs.sort((a, b) => a.fechaCargo.localeCompare(b.fechaCargo) || a.fechaCompra.localeCompare(b.fechaCompra));
  return { movimientos: movs, avisos };
}
