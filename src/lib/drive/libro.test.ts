import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { abrirBaseDatos } from "@/db";
import { sembrar } from "@/db/semilla";
import { crearMovimiento } from "@/db/movimientos";
import { datosLibro } from "@/db/libro";
import { validarMovimiento, type EntradaFormulario } from "@/lib/movimientos";
import { escribirLibro } from "./libro";

function base() {
  const db = abrirBaseDatos(":memory:");
  migrate(db, { migrationsFolder: "./drizzle" });
  sembrar(db);
  const add = (e: EntradaFormulario) => {
    const r = validarMovimiento({ medio: "imagin", grupoId: "10", fechaCompra: e.fechaCargo, ...e }, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    if (!r.ok) throw new Error(JSON.stringify(r.errores));
    crearMovimiento(db, r.datos);
  };
  add({ clase: "entrada", concepto: "Nómina", importe: "1331,91", fechaCargo: "2026-10-01", grupoId: "" });
  add({ clase: "ahorro", concepto: "Traspaso a Trade Republic", importe: "800", fechaCargo: "2026-10-01", medio: "trade_republic", grupoId: "" });
  add({ clase: "gasto", concepto: "Gasolina", importe: "91,37", fechaCargo: "2026-10-01", grupoId: "1" });
  add({ clase: "gasto", concepto: "Gasolina", importe: "50", fechaCargo: "2026-10-01", grupoId: "1", medio: "efectivo" });
  add({ clase: "entrada", concepto: "Bizum cena", importe: "15", fechaCargo: "2026-10-02" });
  return db;
}

describe("libro de respaldo", async () => {
  const db = base();
  const datos = datosLibro(db, "2026-10-05");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await escribirLibro(datos)) as unknown as ArrayBuffer);
  const ws = (n: string) => wb.getWorksheet(n)!;
  const fila = (n: string, r: number) => (ws(n).getRow(r).values as unknown[]).slice(1);

  it("tiene las cinco hojas", () => {
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Resumen", "Movimientos", "Presupuesto", "Anuales", "Ahorro"]);
  });
  it("solo valores, nunca fórmulas", () => {
    for (const w of wb.worksheets) w.eachRow((r) => r.eachCell((c) => expect(c.formula).toBeFalsy()));
  });
  it("Resumen: una fila por mes con ingresos, ahorro, hucha, una columna por grupo, gasto, efectivo y disponible", () => {
    const cab = fila("Resumen", 4);
    expect(cab.slice(0, 5)).toEqual(["Mes", "Ingresos", "Ahorro TR", "Hucha", "Gasolina"]);
    expect(cab.slice(-3)).toEqual(["Gasto total", "Pagado en efectivo", "Disponible"]);
    const oct = fila("Resumen", 5);
    expect(oct[0]).toBe("Octubre 2026");
    expect(oct[1]).toBe(1331.91);
    expect(oct[4]).toBe(141.37);
    // 1.331,91 − 800 − (141,37 − 15 de devolución − 50 en efectivo)
    expect(oct[oct.length - 1]).toBe(455.54);
  });
  it("Movimientos: fechas de verdad y lo que sale en negativo", () => {
    const g = fila("Movimientos", 7);
    expect(g[0]).toBeInstanceOf(Date);
    expect(ws("Movimientos").getCell("A5").numFmt).toBe("dd/mm/yyyy");
    expect(g.slice(2, 8)).toEqual(["Gasolina", "Gasolina", "", "Gasto", "Imagin", -91.37]);
    expect(fila("Movimientos", 9).slice(5, 8)).toEqual(["Devolución", "Imagin", 15]);
    expect(ws("Movimientos").getCell("H7").numFmt).toBe('#,##0.00 "€"');
    expect(ws("Movimientos").getCell("H7").font.color?.argb).toBe("FF7B2525");
  });
  it("Presupuesto: Regalos sin parte fija y con Navidad en diciembre", () => {
    const regalos = ws("Presupuesto").getRows(5, 12)!.find((r) => r.getCell(1).value === "Regalos")!;
    expect(regalos.getCell(2).value).toBeNull();
    expect(regalos.getCell(3 + 12).value).toBe(200);
  });
  it("Anuales y Ahorro", () => {
    expect(fila("Anuales", 4)).toContain("Gastado");
    expect(fila("Ahorro", 5)[0]).toBe("Agosto 2026");
    expect(fila("Ahorro", 5)[1]).toBe(1911.66);
  });
  it("cabeceras en oliva", () => {
    expect((ws("Resumen").getCell("A4").fill as ExcelJS.FillPattern).fgColor?.argb).toBe("FF607456");
  });
});
