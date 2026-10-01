import { describe, expect, it } from "vitest";
import { avisosPanel, cierrePendiente, resumenCierre, type EntradaAvisos } from "./avisos";
import { eur, fechaCorta, porcentaje } from "./formato";
import { filasGrupos, proximosEventos, type EventoPanel, type GrupoPanel, type MovPanel } from "./panel";

const g = (id: number, nombre: string, presupuestoCent: number | null): GrupoPanel => ({ id, nombre, color: "#000", activo: true, presupuestoCent, esDinamico: presupuestoCent == null });
const GRUPOS = [g(1, "Gasolina", 43500), g(5, "Regalos", null), g(8, "Caprichos", 17000), g(10, "Otros", 7000)];
const mov = (p: Partial<MovPanel> & Pick<MovPanel, "tipo" | "importeCent">): MovPanel => ({ concepto: "x", fechaCompra: p.fechaCargo ?? "2026-10-05", fechaCargo: "2026-10-05", medio: "imagin", ...p });
const EVENTOS: EventoPanel[] = [
  { id: 2, nombre: "Cumple Ana", mes: 10, dia: 12, grupoId: 5, etiqueta: "Cumple Ana", importePrevistoCent: 4000, color: null },
  { id: 3, nombre: "Cumple Luis", mes: 10, dia: 3, grupoId: 5, etiqueta: "Cumple Luis", importePrevistoCent: 3000, color: null },
  { id: 4, nombre: "Navidad", mes: 12, grupoId: 5, etiqueta: "Navidad", importePrevistoCent: 20000, color: null },
];
const MOVS = [
  mov({ tipo: "gasto", importeCent: 14000, grupoId: 8 }),
  mov({ tipo: "gasto", importeCent: 7500, grupoId: 10 }),
  mov({ tipo: "gasto", importeCent: 3500, grupoId: 5, etiqueta: "Cumple Luis" }),
];

function entrada(p: Partial<EntradaAvisos> = {}): EntradaAvisos {
  return {
    filas: filasGrupos(GRUPOS, EVENTOS, MOVS, "2026-10"),
    proximos: proximosEventos(EVENTOS, MOVS, "2026-10-05"),
    eventosMes: [
      { id: 2, nombre: "Cumple Ana", importePrevistoCent: 4000, gastado: 0 },
      { id: 3, nombre: "Cumple Luis", importePrevistoCent: 3000, gastado: 3500 },
    ],
    atrasados: [],
    porRevisar: 0,
    nombreMes: "octubre",
    mes: "2026-10",
    eur,
    pct: porcentaje,
    fechaCorta,
    ...p,
  };
}

describe("avisos del panel", () => {
  it("grupo al 80 %: ámbar; por encima: burdeos con lo que te has pasado", () => {
    const a = avisosPanel(entrada());
    expect(a.find((x) => x.titulo === "Caprichos")).toMatchObject({ tono: "ambar" });
    expect(a.find((x) => x.titulo === "Caprichos")!.texto).toBe("va por el 82,4 % de su presupuesto de octubre: 140,00 € de 170,00 €.");
    expect(a.find((x) => x.titulo === "Otros")!.texto).toContain("Te has pasado 5,00 €");
    expect(a.some((x) => x.titulo === "Gasolina")).toBe(false);
  });
  it("evento a menos de dos semanas; si ya te has pasado en él, aviso en burdeos en su lugar", () => {
    const a = avisosPanel(entrada());
    expect(a.find((x) => x.clave === "e2")!.texto).toBe("es en 7 días. Previsto 40,00 €, gastado 0,00 €.");
    expect(a.find((x) => x.clave === "ep3")).toMatchObject({ tono: "rojo" });
    expect(a.find((x) => x.clave === "ep3")!.texto).toContain("te has pasado 5,00 €");
    expect(a.some((x) => x.titulo === "Navidad")).toBe(false);
  });
  it("recurrentes atrasados y carga por revisar, con su enlace", () => {
    const a = avisosPanel(entrada({ atrasados: [{ id: 1, concepto: "Nómina", fechaPrevista: "2026-10-01" }], porRevisar: 4 }));
    expect(a.find((x) => x.clave === "atrasados")).toMatchObject({ titulo: "1 recurrente sin confirmar", texto: "cuya fecha ya pasó: Nómina (01/10).", enlace: { href: "/movimientos?mes=2026-10#pendientes" } });
    expect(a.find((x) => x.clave === "revisar")?.enlace?.href).toBe("/revisar");
  });
  it("lo grave primero", () => {
    const a = avisosPanel(entrada({ porRevisar: 4 }));
    expect(a.map((x) => x.tono)).toEqual(["rojo", "rojo", "ambar", "ambar", "oliva"]);
  });
});

describe("resumen de cierre", () => {
  const hay = () => true;
  it("se ofrece los 10 primeros días del mes nuevo, hasta que lo marcas como visto", () => {
    expect(cierrePendiente("2026-10-01", null, hay)).toBe("2026-09");
    expect(cierrePendiente("2026-10-10", "2026-08", hay)).toBe("2026-09");
    expect(cierrePendiente("2026-10-11", null, hay)).toBeNull();
    expect(cierrePendiente("2026-10-02", "2026-09", hay)).toBeNull();
    expect(cierrePendiente("2027-01-03", null, hay)).toBe("2026-12");
  });
  it("sin movimientos en el mes pasado no hay cierre que enseñar", () => {
    expect(cierrePendiente("2026-10-01", null, () => false)).toBeNull();
  });
  it("desviaciones por grupo, de la peor a la mejor, y lo que sobró", () => {
    const movs = [
      mov({ tipo: "ahorro", importeCent: 80000, fechaCargo: "2026-09-01" }),
      mov({ tipo: "ahorro", importeCent: 50000, fechaCargo: "2026-08-01" }),
      mov({ tipo: "gasto", importeCent: 9000, grupoId: 10, fechaCargo: "2026-09-10" }),
      mov({ tipo: "gasto", importeCent: 40000, grupoId: 1, fechaCargo: "2026-09-12" }),
    ];
    const r = resumenCierre(movs, "2026-09", filasGrupos(GRUPOS, [], movs, "2026-09"));
    expect(r.ahorrado).toEqual({ valor: 80000, cambio: 30000 });
    expect(r.desviaciones[0]).toMatchObject({ grupo: "Otros", diferencia: 2000 });
    expect(r.pasados.map((d) => d.grupo)).toEqual(["Otros"]);
    expect(r.sobrante).toBe(3500 + 17000);
  });
});
