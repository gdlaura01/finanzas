/**
 * Cálculos del panel. Funciones puras sobre los datos ya leídos.
 * Importes en céntimos; el mes de cada movimiento lo decide su fecha de cargo.
 */
import type { Cuenta } from "@/db/schema";
import { diasDelMes, fechaEnMes, sumarMeses } from "./formato";
import {
  eventoAplica,
  flujoCuenta,
  gastoGrupoMes,

  movsDelMes,
  normalizar,
  presupuestoGrupo,
  resumenMes,
  saldoCuenta,
  semaforo,
  valorInversion,
  type Cuadre,
  type Evento,
  type Grupo,
  type Interes,
  type Mov,
  type Valoracion,
} from "./reglas";

export type GrupoPanel = Grupo & { nombre: string; color: string; activo: boolean };
export type EventoPanel = Evento & { id: number; nombre: string; color: string | null };
export type MovPanel = Mov & { concepto: string };

export const finDeMes = (mes: string) => `${mes}-${String(diasDelMes(mes)).padStart(2, "0")}`;

/** Fecha a la que se miran los saldos: hoy en el mes en curso, el último día en los demás. */
export const fechaReferencia = (mes: string, hoyISO: string) => (mes === hoyISO.slice(0, 7) ? hoyISO : finDeMes(mes));

/** Resumen del mes con el desglose que enseña el panel. */
export function resumenPanel(movs: MovPanel[], mes: string, grupos: GrupoPanel[]) {
  const r = resumenMes(movs, mes);
  const gasolina = grupos.find((g) => normalizar(g.nombre) === "gasolina");
  const gastoGasolina = gasolina ? gastoGrupoMes(movs, gasolina.id, mes) : 0;
  return { ...r, gastoGasolina, gastoSinGasolina: r.gastoTotal - gastoGasolina };
}

export type FilaGrupo = {
  grupo: GrupoPanel;
  presupuesto: number;
  real: number;
  efectivo: number;
  estado: ReturnType<typeof semaforo>;
};

/** Presupuesto (fijo + eventos del mes) frente a lo gastado, por grupo. Los archivados salen solo si tienen gasto. */
export function filasGrupos(grupos: GrupoPanel[], eventos: Evento[], movs: Mov[], mes: string): FilaGrupo[] {
  const delMes = movsDelMes(movs, mes);
  return grupos
    .map((g) => {
      const presupuesto = presupuestoGrupo(g, mes, eventos);
      const real = gastoGrupoMes(delMes, g.id, mes);
      const efectivo = delMes.filter((m) => m.tipo === "gasto" && m.grupoId === g.id && m.medio === "efectivo").reduce((a, m) => a + m.importeCent, 0);
      return { grupo: g, presupuesto, real, efectivo, estado: semaforo(real, presupuesto) };
    })
    .filter((f) => f.grupo.activo || f.real !== 0);
}

/** Gastos con tarjeta ya hechos pero que el banco aún no ha cargado. */
export const comprasSinCargar = (movs: Mov[], hoyISO: string) =>
  movs.filter((m) => m.tipo === "gasto" && m.importeCent > 0 && m.medio !== "efectivo" && m.fechaCompra <= hoyISO && m.fechaCargo > hoyISO);

/** Lo gastado con la etiqueta de un evento en un año. */
export const gastadoEnEvento = (movs: Mov[], etiqueta: string, anio: number) =>
  movs
    .filter((m) => m.tipo === "gasto" && m.fechaCargo.startsWith(String(anio)) && m.etiqueta && normalizar(m.etiqueta) === normalizar(etiqueta))
    .reduce((a, m) => a + m.importeCent, 0);

export type Proximo = EventoPanel & { fecha: string; dias: number; gastado: number };

/**
 * Eventos de los próximos 12 meses, por fecha. Sin día, cuentan desde el día 1 de su mes
 * y siguen apareciendo hasta que acaba ese mes.
 */
export function proximosEventos(eventos: EventoPanel[], movs: Mov[], hoyISO: string, n = 6): Proximo[] {
  const out: Proximo[] = [];
  const mesHoy = hoyISO.slice(0, 7);
  for (let i = 0; i < 12; i++) {
    const mes = sumarMeses(mesHoy, i);
    const [anio, mm] = mes.split("-").map(Number);
    for (const e of eventos) {
      if (e.mes !== mm || !eventoAplica(e, anio)) continue;
      const fecha = fechaEnMes(mes, e.dia ?? 1);
      if (e.dia && fecha < hoyISO) continue;
      const dias = Math.round((Date.parse(`${fecha}T12:00:00Z`) - Date.parse(`${hoyISO}T12:00:00Z`)) / 864e5);
      out.push({ ...e, fecha, dias, gastado: gastadoEnEvento(movs, e.etiqueta, anio) });
    }
  }
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.nombre.localeCompare(b.nombre, "es")).slice(0, n);
}

/** Ingresos y gasto total de cada mes de un año. */
export function serieAnual(movs: Mov[], anio: number) {
  return Array.from({ length: 12 }, (_, i) => {
    const mes = `${anio}-${String(i + 1).padStart(2, "0")}`;
    const r = resumenMes(movs, mes);
    return { mes, ingresos: r.ingresos, gasto: r.gastoTotal };
  });
}

export type DatosSaldos = { cuadres: Cuadre[]; movs: Mov[]; intereses: Interes[]; valoraciones: Valoracion[] };

/** Saldo de las cuatro cuentas en una fecha. Null en las que no tienen saldo de partida anterior. */
export function saldos(d: DatosSaldos, fecha: string): Record<Cuenta, number | null> {
  const conInversion = d.valoraciones.some((v) => v.fecha <= fecha) || d.movs.some((m) => m.fechaCargo <= fecha && flujoCuenta("inversion_tr", m) !== 0);
  return {
    imagin: saldoCuenta("imagin", fecha, d),
    ahorro_tr: saldoCuenta("ahorro_tr", fecha, d),
    inversion_tr: conInversion ? valorInversion(fecha, d) : null,
    hucha_revolut: saldoCuenta("hucha_revolut", fecha, d),
  };
}

/** Lo ahorrado (Ahorro TR + Inversión TR + hucha) al cierre de cada mes, desde el saldo de partida hasta `hasta`. */
export function serieAhorro(d: DatosSaldos, desde: string, hasta: string, hoyISO: string) {
  const out: { mes: string; fecha: string; total: number }[] = [];
  for (let mes = desde.slice(0, 7); mes <= hasta; mes = sumarMeses(mes, 1)) {
    const fecha = mes === hoyISO.slice(0, 7) ? hoyISO : mes === desde.slice(0, 7) ? desde : finDeMes(mes);
    const s = saldos(d, fecha);
    if (s.ahorro_tr == null) continue;
    out.push({ mes, fecha, total: (s.ahorro_tr ?? 0) + (s.inversion_tr ?? 0) + (s.hucha_revolut ?? 0) });
  }
  return out;
}

/** Inversión TR: último valor anotado y cuánto ganas sobre lo aportado hasta ese día. */
export function rendimientoInversion(d: DatosSaldos, fecha: string) {
  const ultima = d.valoraciones.filter((v) => v.fecha <= fecha).sort((a, b) => a.fecha.localeCompare(b.fecha)).pop();
  if (!ultima) return null;
  const aportado = d.movs.filter((m) => m.fechaCargo <= ultima.fecha).reduce((a, m) => a + flujoCuenta("inversion_tr", m), 0);
  return { fecha: ultima.fecha, valor: ultima.valorCent, aportado, ganancia: aportado > 0 ? ultima.valorCent - aportado : null };
}

/** Cierre de un mes ya pasado frente al anterior. */
export function cierreMes(movs: Mov[], mes: string) {
  const r = resumenMes(movs, mes), a = resumenMes(movs, sumarMeses(mes, -1));
  const ahorrado = (x: typeof r) => x.ahorro + x.traspasos - x.retiradas;
  return {
    ahorrado: { valor: ahorrado(r), cambio: ahorrado(r) - ahorrado(a) },
    gasto: { valor: r.gastoTotal, cambio: r.gastoTotal - a.gastoTotal },
    disponible: { valor: r.disponible, cambio: r.disponible - a.disponible },
  };
}

