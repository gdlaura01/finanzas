/**
 * Cuentas y ahorro: saldos mes a mes, flujos de cada cuenta, Inversión TR frente a lo
 * aportado y colchón. Funciones puras; importes en céntimos.
 */
import type { Cuenta } from "@/db/schema";
import { sumarMeses } from "./formato";
import { finDeMes, saldos, type DatosSaldos } from "./panel";
import { colchon, flujoCuenta, movsDelMes, resumenMes, tir, type Mov } from "./reglas";

/** Un color por cuenta, el mismo en toda la app (validados para distinguirse también con daltonismo). */
export const COLOR_CUENTA: Record<Cuenta, string> = { imagin: "#BA6A4C", ahorro_tr: "#4B7A2F", inversion_tr: "#E0895E", hucha_revolut: "#5A72B0" };

export const INFO_CUENTA: Record<Cuenta, { nombre: string; sub: string }> = {
  imagin: { nombre: "Imagin", sub: "Cuenta de la nómina" },
  ahorro_tr: { nombre: "Ahorro TR", sub: "Trade Republic · cuenta remunerada" },
  inversion_tr: { nombre: "Inversión TR", sub: "Trade Republic · inversión" },
  hucha_revolut: { nombre: "Hucha", sub: "Revolut" },
};

/** Fecha de cierre de un mes: hoy si es el mes en curso. */
const cierre = (mes: string, hoyISO: string) => (mes === hoyISO.slice(0, 7) ? hoyISO : finDeMes(mes));

/** Saldo de una cuenta al cierre de cada mes desde `desde`; los meses sin saldo calculable no salen. */
export function serieCuenta(cuenta: Cuenta, d: DatosSaldos, desde: string, hoyISO: string) {
  const out: { mes: string; saldo: number }[] = [];
  for (let mes = desde; mes <= hoyISO.slice(0, 7); mes = sumarMeses(mes, 1)) {
    const s = saldos(d, cierre(mes, hoyISO))[cuenta];
    if (s != null) out.push({ mes, saldo: s });
  }
  return out;
}

/** Lo que entra y sale de una cuenta en un mes. */
export function flujosMes(cuenta: Cuenta, movs: Mov[], mes: string) {
  let entra = 0, sale = 0;
  for (const m of movsDelMes(movs, mes)) {
    const f = flujoCuenta(cuenta, m);
    if (f > 0) entra += f;
    else sale -= f;
  }
  return { entra, sale };
}

/** Gasto medio de los últimos `n` meses cerrados con movimientos. */
export function gastoMedio(movs: Mov[], hoyISO: string, n = 3) {
  const meses: number[] = [];
  for (let mes = sumarMeses(hoyISO.slice(0, 7), -1), i = 0; meses.length < n && i < 24; mes = sumarMeses(mes, -1), i++) {
    if (!movsDelMes(movs, mes).length) continue;
    meses.push(resumenMes(movs, mes).gastoTotal);
  }
  return meses.length ? Math.round(meses.reduce((a, x) => a + x, 0) / meses.length) : 0;
}

/** Colchón: Ahorro TR + hucha frente a `meses` de gasto medio. */
export function estadoColchon(d: DatosSaldos, hoyISO: string, meses: number) {
  const s = saldos(d, hoyISO);
  const liquido = (s.ahorro_tr ?? 0) + (s.hucha_revolut ?? 0);
  const medio = gastoMedio(d.movs, hoyISO);
  return { medio, liquido, meses, ...colchon(medio, meses, liquido) };
}

const dias = (a: string, b: string) => (Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5;

/**
 * Inversión TR: lo aportado, lo que vale, la rentabilidad anual (TIR) y la comparación
 * con haber dejado ese dinero en Ahorro TR al tipo de la cuenta. Null sin valores o sin aportaciones.
 */
export function analisisInversion(d: DatosSaldos, tasaRef: number) {
  const vs = [...d.valoraciones].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const aportaciones = d.movs
    .map((m) => ({ fecha: m.fechaCargo, importe: flujoCuenta("inversion_tr", m) }))
    .filter((a) => a.importe !== 0)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const ult = vs.at(-1);
  if (!ult) return null;
  const hasta = (f: string) => aportaciones.filter((a) => a.fecha <= f);
  const alternativa = (f: string) => Math.round(hasta(f).reduce((a, x) => a + x.importe * Math.pow(1 + tasaRef, dias(x.fecha, f) / 365), 0));
  const ap = hasta(ult.fecha);
  if (!ap.length) return null;
  const aportado = ap.reduce((a, x) => a + x.importe, 0);
  const ganancia = ult.valorCent - aportado;
  const alt = alternativa(ult.fecha);
  return {
    fecha: ult.fecha,
    valor: ult.valorCent,
    aportado,
    ganancia,
    pct: aportado ? ganancia / aportado : 0,
    tir: tir([...ap.map((a) => ({ fecha: a.fecha, importe: -a.importe })), { fecha: ult.fecha, importe: ult.valorCent }]),
    alternativa: alt,
    frenteACuenta: ult.valorCent - alt,
    meses: Math.max(1, Math.round(dias(ap[0].fecha, ult.fecha) / 30.4)),
    serie: vs.map((v) => ({ fecha: v.fecha, valor: v.valorCent, aportado: hasta(v.fecha).reduce((a, x) => a + x.importe, 0), alternativa: alternativa(v.fecha) })),
    /** Rendimiento de cada valor frente al anterior, sin contar lo aportado entre medias. */
    valores: vs.map((v, i) => {
      const p = vs[i - 1];
      if (!p) return { fecha: v.fecha, valor: v.valorCent, aportadoEntre: 0, rendimiento: null as number | null, pct: null as number | null };
      const entre = aportaciones.filter((a) => a.fecha > p.fecha && a.fecha <= v.fecha).reduce((a, x) => a + x.importe, 0);
      const r = v.valorCent - p.valorCent - entre;
      return { fecha: v.fecha, valor: v.valorCent, aportadoEntre: entre, rendimiento: r, pct: r / (p.valorCent + entre) };
    }),
  };
}

/** Intereses netos previstos en 12 meses con el saldo de hoy (con un 19 % de retención). */
export const interesPrevisto = (saldo: number, tasaRef: number) => Math.round(saldo * tasaRef * 0.81);

/** Días que han pasado desde una fecha, en palabras. */
export function haceDias(fecha: string, hoyISO: string) {
  const n = Math.round(dias(fecha, hoyISO));
  return n <= 0 ? "hoy" : n === 1 ? "ayer" : `hace ${n} días`;
}
