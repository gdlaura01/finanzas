import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { leerLibro } from "./excel";
import { capitalizar, leerHojaSeguimiento, NOTA_FECHA_SUPUESTA, type Libro } from "./hoja";
import { buscarDuplicado } from "./duplicados";

// Libro inventado con la misma forma que la hoja de seguimiento
const LIBRO: Libro = {
  "Hoja 1": [
    ["Mes", "Ingresos (Sueldo)", "Gastos Fijos", "Gastos Variables", "Aportación al Ahorro", "Interés Devengado", "Saldo Final Ahorro", "Inversión"],
    ["Agosto", 1331.91, 28.27, 534.57, 500, 3.12, 1911.66, 300],
    ["Septiembre", 1331.91, 53.77, 460.71, 500, 3.69, 2415.35, 300],
    ["Octubre", 1331.91, null, null, 500, null, null, 150],
  ],
  "Gastos Fijos": [
    [2026],
    ["Mes", "Fecha", "Concepto", "Gasto", "Mes", "Fecha", "Concepto", "Gasto", "Mes", "Fecha", "Concepto", "Gasto"],
    ["AGOSTO", "2026-08-03", "ViryiNails", 0, "SEPTIEMBRE", "2026-09-10", "UDEMY", 20, "OCTUBRE", "2026-09-10", "UDEMY", 20],
    [null, "2026-08-16", "Claude", 21.78, null, "2026-09-16", "Claude", 21.78, null, "2026-10-16", "Claude", 21.78],
    [null, null, "TOTAL", 21.78, null, null, "TOTAL", 41.78, null, null, "TOTAL", 41.78],
  ],
  "Gastos Variables": [
    ["Mes", "Fecha", "Concepto", "Gasto", "Mes", "Fecha", "Concepto", "Gasto", "Mes", "Fecha", "Concepto", "Gasto"],
    ["AGOSTO", "2026-08-05", "Gasolina", 50, "SEPTIEMBRE", "2026-09-03", "REVOLUT", 49.55, "OCTUBRE", "2026-10-01", "GASOLINA", 91.37],
    [null, "2026-08-13", "Gasolina", 50, null, "2026-09-21", "BAR MIRASIERRA", 8.9, null, "2026-10-02", "SHEIN", 23.01],
    [null, "2026-08-30", "BIZUM", -2.5, null, null, null, null, null, null, null, null],
  ],
  "Gastos gasolina": [
    ["Fecha", "Importe"],
    ["2026-08-03", 50],
    ["2026-08-06", 50],
    ["2026-08-11", 50],
    ["Total Agosto", 150],
    ["2026-10-01", 91.37],
  ],
};
const OPC = { anio: 2026, mesRecurrentes: "2026-10" };

describe("carga inicial desde la hoja de seguimiento", () => {
  const { movimientos: m, avisos } = leerHojaSeguimiento(LIBRO, OPC);
  const de = (concepto: string) => m.filter((x) => x.concepto === concepto);

  it("nómina y Trade Republic de cada mes antes de los recurrentes, con fecha supuesta el día 1", () => {
    expect(avisos).toEqual([]);
    expect(de("Nómina").map((x) => x.fechaCargo)).toEqual(["2026-08-01", "2026-09-01"]);
    expect(de("Nómina")[0]).toMatchObject({ tipo: "ingreso", importeCent: 133191, notas: NOTA_FECHA_SUPUESTA });
    // Un único traspaso a Ahorro TR y el paso a Inversión TR, como en la app
    expect(de("Traspaso a Trade Republic (ahorro + inversión)")[0]).toMatchObject({ tipo: "ahorro", importeCent: 80000, cuentaDestino: "ahorro_tr" });
    expect(de("Paso de Ahorro TR a Inversión TR")[0]).toMatchObject({ tipo: "interno", importeCent: 30000, cuentaOrigen: "ahorro_tr", cuentaDestino: "inversion_tr" });
  });
  it("gastos fijos sin los de importe cero ni los de los meses con recurrentes", () => {
    expect(de("Claude").map((x) => x.fechaCargo)).toEqual(["2026-08-16", "2026-09-16"]);
    expect(de("Udemy")).toHaveLength(1);
    expect(de("ViryiNails")).toHaveLength(0);
  });
  it("gastos variables en «Otros», con mayúsculas suavizadas y devoluciones en negativo", () => {
    expect(de("Bar Mirasierra")[0]).toMatchObject({ grupo: "Otros", importeCent: 890 });
    expect(de("Bizum")[0].importeCent).toBe(-250);
    expect(de("Pago con Revolut")[0].notas).toMatch(/asigna el grupo/);
    expect(de("Shein")[0].fechaCargo).toBe("2026-10-02");
  });
  it("la gasolina toma la fecha de compra de la hoja de gasolina; lo que no se cargó, es efectivo", () => {
    const g = de("Gasolina");
    expect(g.filter((x) => x.medio === "imagin").map((x) => [x.fechaCompra, x.fechaCargo])).toEqual([
      ["2026-08-03", "2026-08-05"],
      ["2026-08-11", "2026-08-13"],
      ["2026-10-01", "2026-10-01"],
    ]);
    expect(g.filter((x) => x.medio === "efectivo")).toEqual([expect.objectContaining({ fechaCargo: "2026-08-06", importeCent: 5000, grupo: "Gasolina", etiqueta: "Trabajo" })]);
  });
  it("avisa si falta alguna hoja", () => {
    expect(leerHojaSeguimiento({}, OPC).avisos).toHaveLength(3);
  });
  it("capitaliza solo lo que está en mayúsculas", () => {
    expect(capitalizar("BAR LA IDEAL")).toBe("Bar La Ideal");
    expect(capitalizar("ViryiNails")).toBe("ViryiNails");
    expect(capitalizar("IMAE - Gran Teatro")).toBe("IMAE - Gran Teatro");
  });
});

describe("lectura de Excel", () => {
  it("convierte fechas, fórmulas y textos en celdas simples", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Gastos gasolina");
    ws.addRow(["Fecha", "Importe"]);
    ws.addRow([new Date(Date.UTC(2026, 7, 3)), 50]);
    ws.addRow(["Total", { formula: "B2", result: 50 }]);
    const libro = await leerLibro(await wb.xlsx.writeBuffer());
    expect(libro["Gastos gasolina"]).toEqual([["Fecha", "Importe"], ["2026-08-03", 50], ["Total", 50]]);
  });
});

describe("duplicados", () => {
  const ya = [{ id: 1, fechaCargo: "2026-10-01", importeCent: 9137, concepto: "Gasolina", tipo: "gasto" }];
  it("exacto: misma fecha, importe y concepto", () => {
    expect(buscarDuplicado({ fechaCargo: "2026-10-01", importeCent: 9137, concepto: "GASOLINA", tipo: "gasto" }, ya)?.tipo).toBe("exacto");
  });
  it("posible: mismo importe y cargo a 2 días o menos, aunque el concepto no se parezca", () => {
    expect(buscarDuplicado({ fechaCargo: "2026-10-03", importeCent: 9137, concepto: "COMPRA TARJ. REPSOL", tipo: "gasto" }, ya)?.tipo).toBe("posible");
    expect(buscarDuplicado({ fechaCargo: "2026-10-04", importeCent: 9137, concepto: "Gasolina", tipo: "gasto" }, ya)).toBeNull();
    expect(buscarDuplicado({ fechaCargo: "2026-10-01", importeCent: 9138, concepto: "Gasolina", tipo: "gasto" }, ya)).toBeNull();
  });
  it("un mismo apunte no sirve de duplicado dos veces", () => {
    const usados = new Set([ya[0]]);
    expect(buscarDuplicado({ fechaCargo: "2026-10-01", importeCent: 9137, concepto: "Gasolina", tipo: "gasto" }, ya, usados)).toBeNull();
  });
});
