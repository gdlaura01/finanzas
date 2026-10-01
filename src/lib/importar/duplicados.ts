/**
 * Duplicados al importar. Exacto: misma fecha de cargo, importe y concepto.
 * Posible: mismo importe y cargo como mucho a 2 días, aunque el concepto no se parezca
 * («Mercadona» frente a «COMPRA TARJ. MERCADONA 1234»).
 */
import { sumarDias } from "@/lib/formato";
import { normalizar } from "@/lib/reglas";

export type Comparable = { id?: number; fechaCargo: string; importeCent: number; concepto: string; tipo: string };
export type Duplicado = { tipo: "exacto" | "posible"; con: Comparable };

const DIAS = 2;

export function buscarDuplicado(nuevo: Omit<Comparable, "id">, existentes: Comparable[], usados = new Set<Comparable>()): Duplicado | null {
  const k = normalizar(nuevo.concepto);
  let posible: Comparable | null = null;
  for (const e of existentes) {
    if (usados.has(e) || e.importeCent !== nuevo.importeCent || e.tipo !== nuevo.tipo) continue;
    if (e.fechaCargo === nuevo.fechaCargo && normalizar(e.concepto) === k) return { tipo: "exacto", con: e };
    if (!posible && e.fechaCargo >= sumarDias(nuevo.fechaCargo, -DIAS) && e.fechaCargo <= sumarDias(nuevo.fechaCargo, DIAS)) posible = e;
  }
  return posible ? { tipo: "posible", con: posible } : null;
}
