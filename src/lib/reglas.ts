/**
 * Reglas de negocio. Funciones puras: reciben datos y devuelven cifras,
 * sin tocar la base de datos, para poder probarlas por separado.
 * Todos los importes en céntimos.
 */
import type { Cuenta, Medio, Tipo } from "@/db/schema";

export type Mov = {
  fechaCompra: string;
  fechaCargo: string;
  tipo: Tipo;
  medio: Medio;
  importeCent: number;
  grupoId?: number | null;
  etiqueta?: string | null;
  cuentaOrigen?: Cuenta | null;
  cuentaDestino?: Cuenta | null;
};

export type Grupo = { id: number; presupuestoCent: number | null; esDinamico: boolean; efectivoPrevistoCent?: number };
export type Evento = { mes: number | null; dia?: number | null; anio?: number | null; grupoId: number; etiqueta: string; importePrevistoCent: number };
export type Cuadre = { cuenta: Cuenta; fecha: string; saldoRealCent: number };
export type Interes = { cuenta: Cuenta; mes: string; importeCent: number };
export type Valoracion = { fecha: string; valorCent: number };

/** Sin tildes, en minúsculas y sin espacios sobrantes: así se comparan conceptos. */
export const normalizar = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

/** El mes de un movimiento lo decide su fecha de cargo. */
export const mesDe = (m: Pick<Mov, "fechaCargo">) => m.fechaCargo.slice(0, 7);

export const movsDelMes = <T extends Mov>(movs: T[], mes: string) => movs.filter((m) => mesDe(m) === mes);

/** Retirada de la hucha: dinero que vuelve de Revolut a Imagin. */
export const esRetirada = (m: Mov) => m.tipo === "interno" && m.cuentaOrigen === "hucha_revolut" && m.cuentaDestino === "imagin";

/** Un gasto con importe negativo es una devolución o un bizum recibido: netea su grupo. */
export const esDevolucion = (m: Mov) => m.tipo === "gasto" && m.importeCent < 0;

export type ResumenMes = {
  ingresos: number;
  ahorro: number;
  traspasos: number;
  retiradas: number;
  gastoTotal: number;
  gastoEfectivo: number;
  gastoRevolut: number;
  disponible: number;
  tasaAhorro: number;
};

/**
 * Disponible del mes:
 *   ingresos − ahorro − traspasos a la hucha + lo sacado de la hucha
 *   − (gasto total − gasto en efectivo − gasto pagado con Revolut)
 *
 * El efectivo cuenta en su grupo pero no sale de la nómina. Lo pagado con Revolut
 * ya salió de Imagin al traspasarlo a la hucha: restarlo otra vez lo contaría dos veces.
 */
export function resumenMes(movs: Mov[], mes: string): ResumenMes {
  const r = { ingresos: 0, ahorro: 0, traspasos: 0, retiradas: 0, gastoTotal: 0, gastoEfectivo: 0, gastoRevolut: 0 };
  for (const m of movsDelMes(movs, mes)) {
    if (m.tipo === "ingreso") r.ingresos += m.importeCent;
    else if (m.tipo === "ahorro") r.ahorro += m.importeCent;
    else if (m.tipo === "traspaso") r.traspasos += m.importeCent;
    else if (esRetirada(m)) r.retiradas += m.importeCent;
    else if (m.tipo === "gasto") {
      r.gastoTotal += m.importeCent;
      if (m.medio === "efectivo") r.gastoEfectivo += m.importeCent;
      if (m.medio === "revolut") r.gastoRevolut += m.importeCent;
    }
  }
  const disponible = r.ingresos - r.ahorro - r.traspasos + r.retiradas - (r.gastoTotal - r.gastoEfectivo - r.gastoRevolut);
  const tasaAhorro = r.ingresos ? (r.ahorro + r.traspasos - r.retiradas) / r.ingresos : 0;
  return { ...r, disponible, tasaAhorro };
}

/** Un evento se repite cada año salvo que tenga un año concreto. */
export const eventoAplica = (e: Pick<Evento, "anio">, anio: number) => !e.anio || e.anio === anio;

export function eventosDelMes<T extends Evento>(eventos: T[], mes: string, grupoId?: number): T[] {
  const [a, mm] = mes.split("-").map(Number);
  return eventos.filter((e) => e.mes === mm && eventoAplica(e, a) && (grupoId == null || e.grupoId === grupoId));
}

/**
 * Presupuesto de un grupo en un mes = su presupuesto fijo + sus eventos de ese mes.
 * Un grupo dinámico (Regalos) no tiene parte fija: sin eventos, su presupuesto es cero.
 */
export function presupuestoGrupo(g: Grupo, mes: string, eventos: Evento[]) {
  const ev = eventosDelMes(eventos, mes, g.id).reduce((a, e) => a + e.importePrevistoCent, 0);
  return (g.esDinamico ? 0 : g.presupuestoCent ?? 0) + ev;
}

export const gastoGrupoMes = (movs: Mov[], grupoId: number, mes: string) =>
  movsDelMes(movs, mes)
    .filter((m) => m.tipo === "gasto" && m.grupoId === grupoId)
    .reduce((a, m) => a + m.importeCent, 0);

/** Semáforo: verde hasta el 80 %, ámbar hasta el 100 %, burdeos por encima. */
export function semaforo(realCent: number, presupuestoCent: number): "verde" | "ambar" | "rojo" | "sin" {
  if (presupuestoCent <= 0) return realCent > 0 ? "rojo" : "sin";
  const p = realCent / presupuestoCent;
  return p < 0.8 ? "verde" : p <= 1 ? "ambar" : "rojo";
}

/** Lo que paga la hucha: los gastos pagados desde Revolut. */
export const consumeHucha = (m: Mov) => m.tipo === "gasto" && m.medio === "revolut";

/** Efecto de un movimiento sobre el saldo de una cuenta. */
export function flujoCuenta(cuenta: Cuenta, m: Mov): number {
  if (cuenta === "imagin") {
    if (m.tipo === "ingreso") return m.importeCent;
    if (m.tipo === "ahorro" || m.tipo === "traspaso") return -m.importeCent;
    if (m.tipo === "gasto") return m.medio === "imagin" ? -m.importeCent : 0;
  }
  if (cuenta === "hucha_revolut") {
    if (m.tipo === "traspaso") return m.importeCent;
    if (consumeHucha(m)) return -m.importeCent;
  }
  if (cuenta !== "imagin" && cuenta !== "hucha_revolut" && m.tipo === "ahorro" && m.cuentaDestino === cuenta) return m.importeCent;
  if (m.tipo === "interno") return (m.cuentaDestino === cuenta ? m.importeCent : 0) - (m.cuentaOrigen === cuenta ? m.importeCent : 0);
  return 0;
}

/**
 * Saldo de una cuenta en una fecha: último cuadre (o saldo de partida) anterior
 * + movimientos con cargo posterior + intereses cobrados después (se cobran el día 1).
 * Devuelve null si la fecha es anterior a cualquier cuadre.
 */
export function saldoCuenta(cuenta: Cuenta, fecha: string, d: { cuadres: Cuadre[]; movs: Mov[]; intereses: Interes[] }) {
  const base = d.cuadres.filter((c) => c.cuenta === cuenta && c.fecha <= fecha).sort((a, b) => a.fecha.localeCompare(b.fecha)).pop();
  if (!base) return null;
  const movs = d.movs.filter((m) => m.fechaCargo > base.fecha && m.fechaCargo <= fecha).reduce((a, m) => a + flujoCuenta(cuenta, m), 0);
  const ints = d.intereses
    .filter((i) => i.cuenta === cuenta && `${i.mes}-01` > base.fecha && `${i.mes}-01` <= fecha)
    .reduce((a, i) => a + i.importeCent, 0);
  return base.saldoRealCent + movs + ints;
}

/** Inversión TR: último valor anotado + lo aportado después. */
export function valorInversion(fecha: string, d: { valoraciones: Valoracion[]; movs: Mov[] }) {
  const v = d.valoraciones.filter((x) => x.fecha <= fecha).sort((a, b) => a.fecha.localeCompare(b.fecha)).pop();
  const desde = v?.fecha ?? "0000-00-00";
  return (v?.valorCent ?? 0) + d.movs.filter((m) => m.fechaCargo > desde && m.fechaCargo <= fecha).reduce((a, m) => a + flujoCuenta("inversion_tr", m), 0);
}

/** Provisión mensual: lo previsto en eventos para un periodo, repartido en 12 meses. */
export const provisionMensual = (eventos: Evento[], meses: string[]) =>
  Math.round(meses.reduce((a, mes) => a + eventosDelMes(eventos, mes).reduce((b, e) => b + e.importePrevistoCent, 0), 0) / 12);

/** Colchón de seguridad: cuántos meses de gasto medio cubren Ahorro TR y la hucha. */
export function colchon(gastoMedioCent: number, meses: number, liquidoCent: number) {
  const objetivo = gastoMedioCent * meses;
  return { objetivo, cubierto: objetivo ? liquidoCent / objetivo : 0, sobra: liquidoCent - objetivo };
}

/** Rentabilidad anual (TIR) con fechas: aportaciones en negativo y valor final en positivo. */
export function tir(flujos: { fecha: string; importe: number }[]): number | null {
  if (flujos.length < 2) return null;
  const t0 = Date.parse(flujos[0].fecha);
  const vpn = (r: number) => flujos.reduce((a, f) => a + f.importe / Math.pow(1 + r, (Date.parse(f.fecha) - t0) / (365 * 864e5)), 0);
  let lo = -0.95, hi = 5;
  if (vpn(lo) * vpn(hi) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (vpn(lo) * vpn(mid) <= 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

export type Regla = { patron: string; grupoId: number; etiqueta: string | null; prioridad: number };

/** Propone grupo y etiqueta: primero lo aprendido de tus apuntes, después las reglas en orden. */
export function sugerir(concepto: string, aprendido: Map<string, { grupoId: number; etiqueta: string | null }>, reglas: Regla[]) {
  const k = normalizar(concepto);
  const ap = aprendido.get(k);
  if (ap) return { ...ap, fuente: "aprendido" as const };
  for (const r of [...reglas].sort((a, b) => a.prioridad - b.prioridad)) {
    let ok: boolean;
    try {
      ok = new RegExp(r.patron, "i").test(k);
    } catch {
      ok = k.includes(normalizar(r.patron));
    }
    if (ok) return { grupoId: r.grupoId, etiqueta: r.etiqueta, fuente: "regla" as const, regla: r };
  }
  return null;
}

/** Posible duplicado al importar: misma fecha de cargo, mismo importe y mismo concepto. */
export const claveDuplicado = (m: Pick<Mov, "fechaCargo" | "importeCent"> & { concepto: string }) =>
  `${m.fechaCargo}|${m.importeCent}|${normalizar(m.concepto)}`;
