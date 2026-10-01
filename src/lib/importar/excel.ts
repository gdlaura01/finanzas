/** Convierte un .xlsx en celdas simples para los importadores. Solo en el servidor. */
import ExcelJS from "exceljs";
import type { Celda, Libro } from "./hoja";

function valor(v: ExcelJS.CellValue): Celda {
  if (v == null) return null;
  // Las fechas de Excel no tienen zona horaria: ExcelJS las da en UTC.
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number" || typeof v === "string") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "object") {
    if ("result" in v) return valor(v.result as ExcelJS.CellValue);
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return String(v.text);
  }
  return null;
}

export async function leerLibro(datos: ArrayBuffer | Buffer): Promise<Libro> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(datos as ArrayBuffer);
  const libro: Libro = {};
  wb.eachSheet((ws) => {
    const filas: Celda[][] = [];
    ws.eachRow({ includeEmpty: true }, (fila, n) => {
      const celdas: Celda[] = [];
      fila.eachCell({ includeEmpty: true }, (c, col) => (celdas[col - 1] = valor(c.value)));
      filas[n - 1] = Array.from(celdas, (c) => c ?? null);
    });
    libro[ws.name] = Array.from(filas, (f) => f ?? []);
  });
  return libro;
}
