import { describe, expect, it } from "vitest";
import { agruparRevision, type FilaRevision } from "./revision";

const f = (p: Partial<FilaRevision> & Pick<FilaRevision, "id" | "concepto">): FilaRevision => ({
  fechaCompra: p.fechaCargo ?? "2026-08-05", fechaCargo: "2026-08-05", tipo: "gasto", medio: "imagin", importeCent: 1000, grupoId: 10, etiqueta: null, notas: null, ...p,
});
const filas = [
  f({ id: 1, concepto: "Nómina", tipo: "ingreso", importeCent: 133191, fechaCargo: "2026-08-01", grupoId: null }),
  f({ id: 2, concepto: "Traspaso a Trade Republic", tipo: "ahorro", importeCent: 80000, fechaCargo: "2026-08-01", grupoId: null }),
  f({ id: 3, concepto: "Nómina", tipo: "ingreso", importeCent: 133191, fechaCargo: "2026-09-01", grupoId: null }),
  f({ id: 4, concepto: "Gasolina", importeCent: 5000, fechaCargo: "2026-09-11" }),
  f({ id: 5, concepto: "GASOLINA", importeCent: 9137, fechaCargo: "2026-08-15" }),
  f({ id: 6, concepto: "Bizum", importeCent: -250 }),
  f({ id: 7, concepto: "Claude", importeCent: 2178 }),
  f({ id: 8, concepto: "Zapatería Pepe", importeCent: 4500 }),
];
const ctx = {
  aprendido: new Map([["claude", { grupoId: 3, etiqueta: "Suscripción" }]]),
  reglas: [{ patron: "gasolina|repsol", grupoId: 1, etiqueta: "Trabajo", prioridad: 10 }],
  grupoPorDefecto: 10,
};

describe("revisión de la carga inicial", () => {
  const r = agruparRevision(filas, ctx);
  it("nóminas y traspasos, un grupo por mes", () => {
    expect(r.meses.map((m) => [m.mes, m.filas.map((x) => x.id)])).toEqual([
      ["2026-08", [1, 2]],
      ["2026-09", [3]],
    ]);
  });
  it("gastos por concepto sin mirar mayúsculas, los más repetidos primero, por fecha", () => {
    expect(r.conceptos[0]).toMatchObject({ clave: "gasolina", total: -14137, meses: ["2026-08", "2026-09"] });
    expect(r.conceptos[0].filas.map((x) => x.id)).toEqual([5, 4]);
  });
  it("propuesta: lo aprendido, después las reglas, y si no, «Otros»", () => {
    const de = (k: string) => r.conceptos.find((c) => c.clave === k)!.sugerencia;
    expect(de("claude")).toEqual({ grupoId: 3, etiqueta: "Suscripción", fuente: "aprendido" });
    expect(de("gasolina")).toEqual({ grupoId: 1, etiqueta: "Trabajo", fuente: "regla" });
    expect(de("zapateria pepe")).toEqual({ grupoId: 10, etiqueta: null, fuente: "nada" });
  });
  it("una devolución suma en positivo al total del concepto", () => {
    expect(r.conceptos.find((c) => c.clave === "bizum")!.total).toBe(250);
  });
});
