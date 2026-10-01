import { describe, expect, it } from "vitest";
import {
  avisosPanel,
  cierreMes,
  comprasSinCargar,
  fechaReferencia,
  filasGrupos,
  proximosEventos,
  rendimientoInversion,
  resumenPanel,
  saldos,
  serieAhorro,
  serieAnual,
  type EventoPanel,
  type GrupoPanel,
  type MovPanel,
} from "./panel";
import { eur } from "./formato";

const g = (id: number, nombre: string, presupuestoCent: number | null, extra: Partial<GrupoPanel> = {}): GrupoPanel => ({
  id, nombre, color: "#000", activo: true, presupuestoCent, esDinamico: presupuestoCent == null, ...extra,
});
const GRUPOS = [g(1, "Gasolina", 43500, { efectivoPrevistoCent: 20000 }), g(5, "Regalos", null), g(10, "Otros", 7000), g(11, "Viejo", 1000, { activo: false })];
const mov = (p: Partial<MovPanel> & Pick<MovPanel, "tipo" | "importeCent">): MovPanel => ({
  concepto: "x", fechaCompra: p.fechaCargo ?? "2026-10-05", fechaCargo: "2026-10-05", medio: "imagin", ...p,
});
const EVENTOS: EventoPanel[] = [
  { id: 1, nombre: "Navidad", mes: 12, grupoId: 5, etiqueta: "Navidad", importePrevistoCent: 20000, color: null },
  { id: 2, nombre: "Cumple Ana", mes: 10, dia: 12, grupoId: 5, etiqueta: "Cumple Ana", importePrevistoCent: 4000, color: null },
  { id: 3, nombre: "Cumple Luis", mes: 10, dia: 1, grupoId: 5, etiqueta: "Cumple Luis", importePrevistoCent: 4000, color: null },
  { id: 4, nombre: "Aniversario", mes: null, grupoId: 5, etiqueta: "Aniversario", importePrevistoCent: 4000, color: null },
  { id: 5, nombre: "Fiesta", mes: 10, grupoId: 10, etiqueta: "Fiesta", importePrevistoCent: 3000, color: null },
];

describe("resumen del panel", () => {
  const movs = [
    mov({ tipo: "ingreso", importeCent: 133191 }),
    mov({ tipo: "gasto", importeCent: 6000, grupoId: 1, medio: "efectivo" }),
    mov({ tipo: "gasto", importeCent: 9137, grupoId: 1 }),
    mov({ tipo: "gasto", importeCent: 2301, grupoId: 10 }),
    mov({ tipo: "gasto", importeCent: 3500, grupoId: 5, etiqueta: "Cumple Ana" }),
    mov({ tipo: "gasto", importeCent: 500, grupoId: 11 }),
  ];
  it("separa la gasolina del resto del gasto", () => {
    const r = resumenPanel(movs, "2026-10", GRUPOS);
    expect(r.gastoGasolina).toBe(15137);
    expect(r.gastoSinGasolina).toBe(2301 + 3500 + 500);
    expect(r.disponible).toBe(133191 - (15137 + 2301 + 3500 + 500 - 6000));
  });
  it("cada grupo con su presupuesto del mes (Regalos sale de sus eventos) y su efectivo", () => {
    const f = filasGrupos(GRUPOS, EVENTOS, movs, "2026-10");
    const por = Object.fromEntries(f.map((x) => [x.grupo.nombre, x]));
    expect(por.Gasolina).toMatchObject({ presupuesto: 43500, real: 15137, efectivo: 6000, estado: "verde" });
    expect(por.Regalos).toMatchObject({ presupuesto: 8000, real: 3500 });
    expect(por.Otros.presupuesto).toBe(10000);
    // El archivado sale porque tiene gasto este mes
    expect(por.Viejo.real).toBe(500);
    expect(filasGrupos(GRUPOS, EVENTOS, [], "2026-10").some((x) => x.grupo.nombre === "Viejo")).toBe(false);
  });
  it("avisa de grupos cerca o por encima del presupuesto y de eventos cercanos", () => {
    const filas = filasGrupos(GRUPOS, EVENTOS, [...movs, mov({ tipo: "gasto", importeCent: 8000, grupoId: 10 })], "2026-10");
    const proximos = proximosEventos(EVENTOS, movs, "2026-10-01");
    const a = avisosPanel({ filas, proximos, porRevisar: 3, nombreMes: "octubre", eur, pct: (x) => `${Math.round(x * 100)} %` });
    expect(a[0]).toMatchObject({ tono: "oliva", titulo: "3 apuntes de la carga inicial" });
    expect(a.find((x) => x.titulo === "Otros")).toMatchObject({ tono: "rojo" });
    expect(a.find((x) => x.titulo === "Otros")!.texto).toContain("Te has pasado 3,01 €");
    expect(a.find((x) => x.titulo === "Cumple Ana")!.texto).toBe("es en 11 días. Previsto 40,00 €, gastado 35,00 €.");
    expect(a.find((x) => x.titulo === "Cumple Luis")!.texto).toMatch(/^es hoy/);
    expect(a.some((x) => x.titulo === "Navidad")).toBe(false);
  });
});

describe("próximos eventos", () => {
  it("los de los próximos 12 meses, por fecha; los pasados con día no salen, los de mes sin día sí durante el mes", () => {
    const p = proximosEventos(EVENTOS, [], "2026-10-05");
    expect(p.map((e) => e.nombre)).toEqual(["Fiesta", "Cumple Ana", "Navidad"]);
    expect(p[0]).toMatchObject({ fecha: "2026-10-01", dias: -4 });
  });
  it("un evento de un solo año no se repite", () => {
    const solo = [{ ...EVENTOS[0], anio: 2026 }];
    expect(proximosEventos(solo, [], "2026-12-30").length).toBe(1);
    expect(proximosEventos(solo, [], "2027-01-02").length).toBe(0);
  });
});

describe("cuentas", () => {
  const d = {
    cuadres: [
      { cuenta: "imagin" as const, fecha: "2026-09-30", saldoRealCent: 15202 },
      { cuenta: "ahorro_tr" as const, fecha: "2026-08-31", saldoRealCent: 191166 },
      { cuenta: "hucha_revolut" as const, fecha: "2026-08-31", saldoRealCent: 0 },
    ],
    movs: [
      mov({ tipo: "ingreso", importeCent: 133191, fechaCargo: "2026-10-01" }),
      mov({ tipo: "ahorro", importeCent: 80000, fechaCargo: "2026-10-01", cuentaOrigen: "imagin", cuentaDestino: "ahorro_tr", medio: "trade_republic" }),
      mov({ tipo: "interno", importeCent: 15000, fechaCargo: "2026-10-02", cuentaOrigen: "ahorro_tr", cuentaDestino: "inversion_tr", medio: "trade_republic" }),
      mov({ tipo: "traspaso", importeCent: 15000, fechaCargo: "2026-10-05", cuentaOrigen: "imagin", cuentaDestino: "hucha_revolut", medio: "revolut" }),
    ],
    intereses: [{ cuenta: "ahorro_tr" as const, mes: "2026-09", importeCent: 369 }, { cuenta: "ahorro_tr" as const, mes: "2026-10", importeCent: 462 }],
    valoraciones: [{ fecha: "2026-09-30", valorCent: 144888 }],
  };
  it("saldo de cada cuenta a una fecha", () => {
    expect(saldos(d, "2026-10-05")).toEqual({
      imagin: 15202 + 133191 - 80000 - 15000,
      ahorro_tr: 191166 + 369 + 462 + 80000 - 15000,
      inversion_tr: 144888 + 15000,
      hucha_revolut: 15000,
    });
  });
  it("lo ahorrado al cierre de cada mes desde el saldo de partida", () => {
    const s = serieAhorro(d, "2026-08-31", "2026-10", "2026-10-05");
    expect(s.map((x) => x.fecha)).toEqual(["2026-08-31", "2026-09-30", "2026-10-05"]);
    expect(s[0].total).toBe(191166);
    expect(s[1].total).toBe(191166 + 369 + 144888);
    expect(s[2].total).toBe(191166 + 369 + 462 + 80000 + 144888 + 15000);
  });
  it("la ganancia de Inversión TR solo se calcula si hay aportaciones anotadas", () => {
    expect(rendimientoInversion(d, "2026-10-05")).toMatchObject({ valor: 144888, aportado: 0, ganancia: null });
    const conAportes = { ...d, movs: [...d.movs, mov({ tipo: "ahorro", importeCent: 140000, fechaCargo: "2026-09-01", cuentaOrigen: "imagin", cuentaDestino: "inversion_tr" })] };
    expect(rendimientoInversion(conAportes, "2026-10-05")?.ganancia).toBe(4888);
  });
  it("hoy en el mes en curso, último día en los demás", () => {
    expect(fechaReferencia("2026-10", "2026-10-05")).toBe("2026-10-05");
    expect(fechaReferencia("2026-09", "2026-10-05")).toBe("2026-09-30");
  });
});

describe("más datos del panel", () => {
  it("compras con tarjeta aún sin cargar; el efectivo no cuenta", () => {
    const movs = [
      mov({ tipo: "gasto", importeCent: 2301, fechaCompra: "2026-10-01", fechaCargo: "2026-10-03" }),
      mov({ tipo: "gasto", importeCent: 5000, fechaCompra: "2026-10-01", fechaCargo: "2026-10-03", medio: "efectivo" }),
      mov({ tipo: "gasto", importeCent: 100, fechaCompra: "2026-10-01", fechaCargo: "2026-10-01" }),
    ];
    expect(comprasSinCargar(movs, "2026-10-02").map((m) => m.importeCent)).toEqual([2301]);
  });
  it("serie anual de ingresos y gasto", () => {
    const s = serieAnual([mov({ tipo: "ingreso", importeCent: 100 }), mov({ tipo: "gasto", importeCent: 40, fechaCargo: "2026-03-02" })], 2026);
    expect(s).toHaveLength(12);
    expect(s[9]).toEqual({ mes: "2026-10", ingresos: 100, gasto: 0 });
    expect(s[2].gasto).toBe(40);
  });
  it("cierre frente al mes anterior", () => {
    const movs = [
      mov({ tipo: "ahorro", importeCent: 80000, fechaCargo: "2026-09-01" }),
      mov({ tipo: "ahorro", importeCent: 50000, fechaCargo: "2026-08-01" }),
      mov({ tipo: "gasto", importeCent: 1000, fechaCargo: "2026-09-10" }),
    ];
    const c = cierreMes(movs, "2026-09");
    expect(c.ahorrado).toEqual({ valor: 80000, cambio: 30000 });
    expect(c.gasto).toEqual({ valor: 1000, cambio: 1000 });
  });
});
