/**
 * Avisos del panel (nunca ventanas emergentes). Funciones puras sobre datos ya calculados.
 *
 * - Un grupo llega al 80 % de su presupuesto del mes (o lo supera, o gasta sin tenerlo).
 * - Faltan menos de dos semanas para un evento del calendario; o ya te has pasado en uno de este mes.
 * - Recurrentes cuya fecha prevista ya pasó y no has confirmado.
 * - Apuntes de la carga inicial por revisar.
 * - Al empezar un mes, el resumen de cierre del anterior.
 */
import { diasDelMes, sumarMeses } from "./formato";
import type { FilaGrupo, Proximo } from "./panel";
import { cierreMes } from "./panel";
import type { Mov } from "./reglas";

export type Aviso = { tono: "oliva" | "ambar" | "rojo"; clave: string; titulo: string; texto: string; enlace?: { href: string; texto: string } };

export type EntradaAvisos = {
  filas: FilaGrupo[];
  proximos: Proximo[];
  /** Eventos del mes en curso con lo gastado en ellos. */
  eventosMes: { id: number; nombre: string; importePrevistoCent: number; gastado: number }[];
  atrasados: { id: number; concepto: string; fechaPrevista: string }[];
  porRevisar: number;
  nombreMes: string;
  mes: string;
  eur: (c: number) => string;
  pct: (x: number) => string;
  fechaCorta: (iso: string) => string;
};

/** Ordenados por gravedad: primero lo que ya se ha pasado, después lo que se acerca, al final lo que toca hacer. */
export function avisosPanel(p: EntradaAvisos): Aviso[] {
  const rojos: Aviso[] = [], ambar: Aviso[] = [], oliva: Aviso[] = [];

  for (const f of p.filas) {
    if (f.presupuesto > 0 && f.real / f.presupuesto >= 0.8) {
      const pasado = f.real > f.presupuesto;
      (pasado ? rojos : ambar).push({
        tono: pasado ? "rojo" : "ambar",
        clave: `g${f.grupo.id}`,
        titulo: f.grupo.nombre,
        texto: `va por el ${p.pct(f.real / f.presupuesto)} de su presupuesto de ${p.nombreMes}: ${p.eur(f.real)} de ${p.eur(f.presupuesto)}.${pasado ? ` Te has pasado ${p.eur(f.real - f.presupuesto)}.` : ""}`,
      });
    } else if (f.presupuesto === 0 && f.real > 0) {
      rojos.push({ tono: "rojo", clave: `g${f.grupo.id}`, titulo: f.grupo.nombre, texto: `tiene ${p.eur(f.real)} de gasto en un mes sin presupuesto.` });
    }
  }

  for (const e of p.eventosMes)
    if (e.gastado > e.importePrevistoCent)
      rojos.push({ tono: "rojo", clave: `ep${e.id}`, titulo: e.nombre, texto: `lleva ${p.eur(e.gastado)} gastados de ${p.eur(e.importePrevistoCent)} previstos: te has pasado ${p.eur(e.gastado - e.importePrevistoCent)}.`, enlace: { href: "/calendario", texto: "Ver calendario" } });

  const yaPasados = new Set(p.eventosMes.filter((e) => e.gastado > e.importePrevistoCent).map((e) => e.id));
  for (const e of p.proximos) {
    if (e.dias >= 14 || yaPasados.has(e.id)) continue;
    const cuando = e.dias <= 0 ? (e.dia ? "es hoy" : "es este mes") : e.dias === 1 ? "es mañana" : `es en ${e.dias} días`;
    ambar.push({ tono: "ambar", clave: `e${e.id}`, titulo: e.nombre, texto: `${cuando}. Previsto ${p.eur(e.importePrevistoCent)}, gastado ${p.eur(e.gastado)}.` });
  }

  if (p.atrasados.length) {
    const nombres = p.atrasados.slice(0, 3).map((a) => `${a.concepto} (${p.fechaCorta(a.fechaPrevista)})`).join(", ");
    oliva.push({
      tono: "ambar",
      clave: "atrasados",
      titulo: p.atrasados.length === 1 ? "1 recurrente sin confirmar" : `${p.atrasados.length} recurrentes sin confirmar`,
      texto: `cuya fecha ya pasó: ${nombres}${p.atrasados.length > 3 ? "…" : ""}.`,
      enlace: { href: `/movimientos?mes=${p.mes}#pendientes`, texto: "Confirmarlos" },
    });
  }

  if (p.porRevisar > 0)
    oliva.push({ tono: "oliva", clave: "revisar", titulo: `${p.porRevisar} apuntes de la carga inicial`, texto: "pendientes de clasificar.", enlace: { href: "/revisar", texto: "Revisarlos por lotes" } });

  return [...rojos, ...ambar, ...oliva];
}

/* ---------- Resumen de cierre ---------- */

/** Días del mes nuevo durante los que se ofrece el cierre del anterior, si no lo has marcado como visto. */
export const DIAS_CIERRE = 10;

/** ¿Toca enseñar el cierre del mes pasado? Devuelve ese mes, o null. */
export function cierrePendiente(hoyISO: string, visto: string | null, hayMovimientos: (mes: string) => boolean): string | null {
  const anterior = sumarMeses(hoyISO.slice(0, 7), -1);
  if (Number(hoyISO.slice(8, 10)) > Math.min(DIAS_CIERRE, diasDelMes(hoyISO.slice(0, 7)))) return null;
  if (visto && visto >= anterior) return null;
  return hayMovimientos(anterior) ? anterior : null;
}

export type ResumenCierre = ReturnType<typeof resumenCierre>;

/** Cierre de un mes: total ahorrado, gasto y disponible frente al anterior, y las desviaciones por grupo. */
export function resumenCierre(movs: Mov[], mes: string, filas: FilaGrupo[]) {
  const c = cierreMes(movs, mes);
  const desviaciones = filas
    .filter((f) => f.presupuesto || f.real)
    .map((f) => ({ grupo: f.grupo.nombre, color: f.grupo.color, presupuesto: f.presupuesto, real: f.real, diferencia: f.real - f.presupuesto }))
    .sort((a, b) => b.diferencia - a.diferencia);
  return {
    mes,
    ...c,
    desviaciones,
    pasados: desviaciones.filter((d) => d.diferencia > 0),
    sobrante: desviaciones.filter((d) => d.diferencia < 0).reduce((a, d) => a - d.diferencia, 0),
  };
}
