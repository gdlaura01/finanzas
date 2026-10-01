/** Reúne, ya calculado, todo lo que va al libro de respaldo de Drive. */
import type { BaseDatos } from ".";
import * as t from "./schema";
import { leerParametros } from "./movimientos";
import { MESES, sumarMeses } from "@/lib/formato";
import { CLASES, claseDe, NOMBRE_MEDIO, sentido } from "@/lib/movimientos";
import { finDeMes, gastadoEnEvento, saldos } from "@/lib/panel";
import { gastoGrupoMes, presupuestoGrupo, resumenMes } from "@/lib/reglas";

export type DatosLibro = ReturnType<typeof datosLibro>;

export function datosLibro(db: BaseDatos, hoyISO: string) {
  const grupos = db.select().from(t.grupos).orderBy(t.grupos.orden).all();
  const movs = db.select().from(t.movimientos).orderBy(t.movimientos.fechaCargo, t.movimientos.id).all();
  const eventos = db.select().from(t.eventos).all();
  const p = leerParametros(db) as Record<string, number | string>;
  const datosSaldos = { cuadres: db.select().from(t.cuadres).all(), movs, intereses: db.select().from(t.intereses).all(), valoraciones: db.select().from(t.valoracionesInversion).all() };
  const grupo = (id: number | null) => grupos.find((g) => g.id === id)?.nombre ?? "";
  const mesHoy = hoyISO.slice(0, 7);
  const anio = Number(mesHoy.slice(0, 4));

  // Resumen: del primer mes con movimientos al actual
  const primero = movs[0]?.fechaCargo.slice(0, 7) ?? mesHoy;
  const meses: string[] = [];
  for (let m = primero < mesHoy ? primero : mesHoy; m <= mesHoy; m = sumarMeses(m, 1)) meses.push(m);
  const conGasto = grupos.filter((g) => g.activo || movs.some((m) => m.grupoId === g.id));
  const resumen = meses.map((mes) => {
    const r = resumenMes(movs, mes);
    return {
      mes,
      ingresos: r.ingresos,
      ahorro: r.ahorro,
      hucha: r.traspasos - r.retiradas,
      porGrupo: conGasto.map((g) => gastoGrupoMes(movs, g.id, mes)),
      gastoTotal: r.gastoTotal,
      efectivo: r.gastoEfectivo,
      disponible: r.disponible,
    };
  });

  const movimientos = movs.map((m) => ({
    fechaCompra: m.fechaCompra,
    fechaCargo: m.fechaCargo,
    concepto: m.concepto,
    grupo: grupo(m.grupoId),
    etiqueta: m.etiqueta ?? "",
    tipo: CLASES[claseDe(m)],
    medio: NOMBRE_MEDIO[m.medio],
    importe: sentido(m) === 0 ? Math.abs(m.importeCent) : sentido(m) * Math.abs(m.importeCent),
    notas: m.notas ?? "",
  }));

  const mesesAnio = MESES.map((_, i) => `${anio}-${String(i + 1).padStart(2, "0")}`);
  const presupuesto = {
    anio,
    parametros: [
      ["Nómina neta mensual", Number(p.nomina_cent ?? 0)],
      ["Traspaso mensual a Trade Republic", Number(p.traspaso_tr_cent ?? 0)],
      ["De ello, pasa a Inversión TR", Number(p.paso_inversion_cent ?? 0)],
      ["Objetivo mensual de la hucha", Number(p.objetivo_hucha_cent ?? 0)],
    ] as [string, number][],
    grupos: grupos.filter((g) => g.activo).map((g) => ({
      nombre: g.nombre,
      fijo: g.esDinamico ? null : (g.presupuestoCent ?? 0),
      efectivo: g.efectivoPrevistoCent,
      meses: mesesAnio.map((m) => presupuestoGrupo(g, m, eventos)),
    })),
  };

  const anuales = eventos
    .map((e) => {
      const gastado = gastadoEnEvento(movs, e.etiqueta, anio);
      return { nombre: e.nombre, mes: e.mes ? MESES[e.mes - 1] : "sin asignar", mesN: e.mes ?? 13, dia: e.dia, grupo: grupo(e.grupoId), etiqueta: e.etiqueta, previsto: e.importePrevistoCent, gastado, diferencia: e.importePrevistoCent - gastado, soloAnio: e.anio };
    })
    .filter((e) => !e.soloAnio || e.soloAnio === anio)
    .sort((a, b) => a.mesN - b.mesN || (a.dia ?? 0) - (b.dia ?? 0) || a.nombre.localeCompare(b.nombre, "es"));

  // Ahorro: saldo de cada cuenta al cierre de cada mes desde el saldo de partida
  const corte = String(p.fecha_corte ?? "2026-08-31");
  const ahorro: { mes: string; ahorroTr: number | null; intereses: number; inversionTr: number | null; hucha: number | null; total: number }[] = [];
  for (let mes = corte.slice(0, 7); mes <= mesHoy; mes = sumarMeses(mes, 1)) {
    const fecha = mes === mesHoy ? hoyISO : mes === corte.slice(0, 7) ? corte : finDeMes(mes);
    const s = saldos(datosSaldos, fecha);
    const intereses = datosSaldos.intereses.filter((i) => i.mes === mes).reduce((a, i) => a + i.importeCent, 0);
    ahorro.push({ mes, ahorroTr: s.ahorro_tr, intereses, inversionTr: s.inversion_tr, hucha: s.hucha_revolut, total: (s.ahorro_tr ?? 0) + (s.inversion_tr ?? 0) + (s.hucha_revolut ?? 0) });
  }

  return { generado: hoyISO, grupos: conGasto.map((g) => g.nombre), resumen, movimientos, presupuesto, anuales, ahorro };
}
