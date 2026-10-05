/**
 * Duplicados al importar. Exacto: misma fecha de cargo, importe y concepto.
 * Posible: mismo importe y cargo como mucho a 2 días, aunque el concepto no se parezca
 * («Mercadona» frente a «COMPRA TARJ. MERCADONA 1234»).
 *
 * Lo que vino del resumen mensual de tu hoja (nómina con fecha supuesta, traspaso del mes)
 * no tiene día real: vale cualquier día del mes, y también varias líneas del banco que
 * juntas suman el total del mes («ahorro» 400 € + «inversion» 200 € = traspaso de 600 €).
 */
import { sumarDias } from "@/lib/formato";
import { normalizar } from "@/lib/reglas";

export type Comparable = {
  id?: number;
  fechaCargo: string;
  importeCent: number;
  concepto: string;
  tipo: string;
  /** Apunte del mes sin día real (carga inicial): se compara con todo el mes. */
  delMes?: boolean;
};
export type Duplicado = { tipo: "exacto" | "posible"; con: Comparable; /** Es una parte del total del mes. */ parte?: boolean };

const DIAS = 2;
const mes = (f: string) => f.slice(0, 7);

export function buscarDuplicado(nuevo: Omit<Comparable, "id">, existentes: Comparable[], usados = new Set<Comparable>()): Duplicado | null {
  const k = normalizar(nuevo.concepto);
  let posible: Comparable | null = null;
  let delMes: Comparable | null = null;
  for (const e of existentes) {
    if (usados.has(e) || e.importeCent !== nuevo.importeCent || e.tipo !== nuevo.tipo) continue;
    if (e.fechaCargo === nuevo.fechaCargo && normalizar(e.concepto) === k) return { tipo: "exacto", con: e };
    if (!posible && e.fechaCargo >= sumarDias(nuevo.fechaCargo, -DIAS) && e.fechaCargo <= sumarDias(nuevo.fechaCargo, DIAS)) posible = e;
    if (!delMes && e.delMes && mes(e.fechaCargo) === mes(nuevo.fechaCargo)) delMes = e;
  }
  const con = posible ?? delMes;
  return con ? { tipo: "posible", con } : null;
}

/**
 * Líneas aún sin pareja que, juntas, suman un apunte del mes: devuelve, por índice de
 * línea, el apunte del que forman parte. Solo grupos de 2 o más líneas del mismo tipo y mes.
 */
export function buscarPartes(
  lineas: { tipo: string; fechaCargo: string; importeCent: number }[],
  libres: number[],
  existentes: Comparable[],
  usados: Set<Comparable>,
) {
  const partes = new Map<number, Comparable>();
  for (const e of existentes) {
    if (!e.delMes || usados.has(e)) continue;
    const cand = libres.filter((i) => !partes.has(i) && lineas[i].tipo === e.tipo && mes(lineas[i].fechaCargo) === mes(e.fechaCargo) && lineas[i].importeCent > 0).slice(0, 12);
    // La combinación de 2 o más que suma justo el total (son pocas líneas por mes)
    for (let m = 1; m < 1 << cand.length; m++) {
      const elegidas = cand.filter((_, b) => m & (1 << b));
      if (elegidas.length < 2 || elegidas.reduce((a, i) => a + lineas[i].importeCent, 0) !== e.importeCent) continue;
      elegidas.forEach((i) => partes.set(i, e));
      usados.add(e);
      break;
    }
  }
  return partes;
}
