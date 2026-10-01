import { describe, expect, it } from "vitest";
import { etiquetaDesdeNombre, eventosDeMes, mesesCalendario, planMes, resumenCalendario, validarEvento, validarParametro } from "./plan";

const grupos = [
  { id: 1, presupuestoCent: 43500, esDinamico: false, activo: true, efectivoPrevistoCent: 20000 },
  { id: 5, presupuestoCent: null, esDinamico: true, activo: true, efectivoPrevistoCent: 5000 },
  { id: 9, presupuestoCent: 1000, esDinamico: false, activo: true },
  { id: 12, presupuestoCent: 9999, esDinamico: false, activo: false },
];
const eventos = [
  { id: 1, nombre: "Navidad", mes: 12, grupoId: 5, etiqueta: "Navidad", importePrevistoCent: 20000 },
  { id: 2, nombre: "Cofradía", mes: 3, dia: 15, grupoId: 9, etiqueta: "Cofradía", importePrevistoCent: 3000 },
  { id: 3, nombre: "Boda", mes: 6, anio: 2027, grupoId: 5, etiqueta: "Boda", importePrevistoCent: 15000 },
  { id: 4, nombre: "Aniversario", mes: null, grupoId: 5, etiqueta: "Aniversario", importePrevistoCent: 4000 },
  { id: 5, nombre: "Amigo invisible", mes: 12, dia: 20, grupoId: 5, etiqueta: "Amigo invisible", importePrevistoCent: 1500 },
];
const base = { grupos, eventos, nominaCent: 133191, traspasoTrCent: 80000, huchaCent: 15000 };

describe("plan del mes", () => {
  it("octubre: presupuesto de los grupos activos menos lo previsto en efectivo", () => {
    const p = planMes({ ...base, mes: "2026-10" });
    expect(p.presupuesto).toBe(43500 + 1000);
    // Regalos no tiene presupuesto en octubre: su efectivo previsto no puede restar
    expect(p.efectivo).toBe(20000);
    expect(p.conNomina).toBe(24500);
    expect(p.margen).toBe(133191 - 80000 - 15000 - 24500);
    expect(p.estado).toBe("cierra");
  });
  it("diciembre: los eventos suben el presupuesto y el plan puede no cerrar", () => {
    const p = planMes({ ...base, mes: "2026-12" });
    expect(p.presupuesto).toBe(43500 + 21500 + 1000);
    expect(p.efectivo).toBe(25000);
    expect(p.margen).toBe(133191 - 95000 - (66000 - 25000));
    expect(p.estado).toBe("no_cierra");
  });
  it("menos de 50 € de margen es «muy justo»", () => {
    expect(planMes({ ...base, mes: "2026-10", nominaCent: 80000 + 15000 + 24500 + 4999 }).estado).toBe("justo");
  });
});

describe("calendario", () => {
  it("próximos 12 meses desde el actual, o el año natural", () => {
    const p = mesesCalendario("proximos", "2026-10", 2026);
    expect(p[0]).toBe("2026-10");
    expect(p[11]).toBe("2027-09");
    expect(mesesCalendario("anio", "2026-10", 2027)[0]).toBe("2027-01");
  });
  it("eventos de un mes por día; los de un solo año solo ese año", () => {
    expect(eventosDeMes(eventos, "2026-12").map((e) => e.nombre)).toEqual(["Navidad", "Amigo invisible"]);
    expect(eventosDeMes(eventos, "2026-06")).toEqual([]);
    expect(eventosDeMes(eventos, "2027-06").map((e) => e.nombre)).toEqual(["Boda"]);
  });
  it("previsto y gastado en los próximos 12 meses, y lo que conviene apartar", () => {
    const meses = mesesCalendario("proximos", "2026-10", 2026);
    const r = resumenCalendario(eventos, meses, (e, anio) => (e.nombre === "Navidad" && anio === 2026 ? 18000 : 0));
    expect(r.previsto).toBe(20000 + 1500 + 3000 + 15000);
    expect(r.gastado).toBe(18000);
    expect(r.apartarAlMes).toBe(Math.round(39500 / 12));
  });
});

describe("eventos", () => {
  const ctx = { grupos: [1, 5, 9], etiquetasDeOtros: ["Navidad", "Cumple 1"] };
  const f = { nombre: "Cuota de hermano de la cofradía", mes: "3", dia: "15", grupoId: "9", importe: "30", anio: "2026" };
  it("la etiqueta, si la dejas vacía, es el nombre; con «solo este año», guarda el año", () => {
    const r = validarEvento({ ...f, soloEsteAnio: "on" }, ctx);
    expect(r.ok && r.datos).toMatchObject({ etiqueta: "Cuota de hermano de la cofradía", anio: 2026, mes: 3, dia: 15, importePrevistoCent: 3000 });
    const sin = validarEvento(f, ctx);
    expect(sin.ok && sin.datos.anio).toBeNull();
  });
  it("sin mes es válido (queda en la bandeja de «sin mes»)", () => {
    const r = validarEvento({ ...f, mes: "", dia: "" }, ctx);
    expect(r.ok && r.datos.mes).toBeNull();
  });
  it("avisa de etiqueta repetida, día imposible, grupo e importe", () => {
    const r = validarEvento({ ...f, etiqueta: "navidad", dia: "30", mes: "2", grupoId: "99", importe: "-1" }, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errores.etiqueta).toMatch(/Ya hay otro evento/);
      expect(r.errores.dia).toBe("febrero no tiene día 30.");
      expect(r.errores.grupoId).toBeDefined();
      expect(r.errores.importe).toBeDefined();
    }
  });
  it("propone la etiqueta con las tres primeras palabras", () => {
    expect(etiquetaDesdeNombre("cuota de hermano de la cofradía")).toBe("Cuota de hermano");
  });
});

describe("parámetros del plan", () => {
  it("lo que pasa a Inversión TR no puede superar el traspaso", () => {
    expect(validarParametro("paso_inversion_cent", "900", { traspaso_tr_cent: 80000 })).toMatchObject({ ok: false });
    expect(validarParametro("traspaso_tr_cent", "100", { paso_inversion_cent: 15000 })).toMatchObject({ ok: false });
    expect(validarParametro("traspaso_tr_cent", "650", { paso_inversion_cent: 15000 })).toEqual({ ok: true, valor: 65000 });
    expect(validarParametro("otra", "1", {})).toMatchObject({ ok: false });
  });
});
