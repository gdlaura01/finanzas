/**
 * Escribe el libro de respaldo: cinco hojas con los valores ya calculados (nunca fórmulas),
 * con la paleta de la app para que se lea de un vistazo.
 */
import ExcelJS from "exceljs";
import type { DatosLibro } from "@/db/libro";
import { mayuscula, MESES, nombreMes } from "@/lib/formato";

const C = { oliva: "FF607456", olivaOsc: "FF46553F", terracota: "FFBA6A4C", burdeos: "FF7B2525", crema: "FFEEE0CC", papel: "FFF8F1E6", linea: "FFDCC8AC", tinta3: "FF857B69", blanco: "FFFFFFFF", ambar: "FFBE8A2A" };
const EUROS = '#,##0.00 "€"';
const FECHA = "dd/mm/yyyy";

type Columna = { titulo: string; ancho: number; tipo?: "euros" | "fecha" | "texto" | "numero" };
type Valor = string | number | null;

const euros = (cent: number | null) => (cent == null ? null : Math.round(cent) / 100);
/** Fecha ISO como fecha de Excel (sin zona horaria). */
const fechaExcel = (iso: string) => new Date(`${iso}T00:00:00Z`);

function hoja(wb: ExcelJS.Workbook, nombre: string, color: string, titulo: string, nota: string, columnas: Columna[], filas: Valor[][], total?: Valor[]) {
  const ws = wb.addWorksheet(nombre, { properties: { tabColor: { argb: color } }, views: [{ state: "frozen", ySplit: 4 }] });
  ws.columns = columnas.map((c) => ({ width: c.ancho }));
  ws.getCell("A1").value = titulo;
  ws.getCell("A1").font = { name: "Calibri", size: 16, bold: true, color: { argb: C.olivaOsc } };
  ws.getCell("A2").value = nota;
  ws.getCell("A2").font = { name: "Calibri", size: 10, italic: true, color: { argb: C.tinta3 } };

  const cab = ws.getRow(4);
  columnas.forEach((c, i) => {
    const celda = cab.getCell(i + 1);
    celda.value = c.titulo;
    celda.font = { bold: true, color: { argb: C.blanco } };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.oliva } };
    celda.alignment = { vertical: "middle", horizontal: c.tipo === "euros" || c.tipo === "numero" ? "right" : "left", wrapText: true };
  });
  cab.height = 22;

  const escribir = (fila: ExcelJS.Row, valores: Valor[], esTotal = false, par = false) => {
    valores.forEach((v, i) => {
      const celda = fila.getCell(i + 1);
      const tipo = columnas[i]?.tipo ?? "texto";
      celda.value = tipo === "fecha" && typeof v === "string" && v ? fechaExcel(v) : v;
      if (tipo === "euros") celda.numFmt = EUROS;
      if (tipo === "fecha") celda.numFmt = FECHA;
      celda.font = { bold: esTotal, color: { argb: typeof v === "number" && v < 0 && tipo === "euros" ? C.burdeos : "FF2A2820" } };
      if (par && !esTotal) celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.papel } };
      if (esTotal) celda.border = { top: { style: "thin", color: { argb: C.linea } } };
    });
  };
  filas.forEach((f, i) => escribir(ws.getRow(5 + i), f, false, i % 2 === 1));
  if (total) escribir(ws.getRow(5 + filas.length), total, true);
  if (filas.length) ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + filas.length, column: columnas.length } };
  return ws;
}

export async function escribirLibro(d: DatosLibro): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Finanzas";
  wb.created = new Date(`${d.generado}T12:00:00Z`);
  const generado = `Copia generada por la app el ${d.generado.split("-").reverse().join("/")}. Solo valores: se sobrescribe en cada cambio.`;
  const sum = (xs: (number | null)[]) => xs.reduce<number>((a, x) => a + (x ?? 0), 0);

  // Resumen: una fila por mes
  hoja(
    wb, "Resumen", C.terracota, "RESUMEN MENSUAL", generado,
    [
      { titulo: "Mes", ancho: 16 },
      { titulo: "Ingresos", ancho: 12, tipo: "euros" },
      { titulo: "Ahorro TR", ancho: 12, tipo: "euros" },
      { titulo: "Hucha", ancho: 11, tipo: "euros" },
      ...d.grupos.map((g) => ({ titulo: g, ancho: Math.max(10, g.length + 2), tipo: "euros" as const })),
      { titulo: "Gasto total", ancho: 13, tipo: "euros" },
      { titulo: "Pagado en efectivo", ancho: 13, tipo: "euros" },
      { titulo: "Disponible", ancho: 13, tipo: "euros" },
    ],
    d.resumen.map((r) => [mayuscula(nombreMes(r.mes)), euros(r.ingresos), euros(r.ahorro), euros(r.hucha), ...r.porGrupo.map(euros), euros(r.gastoTotal), euros(r.efectivo), euros(r.disponible)]),
    [
      "Total",
      euros(sum(d.resumen.map((r) => r.ingresos))),
      euros(sum(d.resumen.map((r) => r.ahorro))),
      euros(sum(d.resumen.map((r) => r.hucha))),
      ...d.grupos.map((_, i) => euros(sum(d.resumen.map((r) => r.porGrupo[i])))),
      euros(sum(d.resumen.map((r) => r.gastoTotal))),
      euros(sum(d.resumen.map((r) => r.efectivo))),
      euros(sum(d.resumen.map((r) => r.disponible))),
    ],
  );

  // Movimientos: el registro completo
  hoja(
    wb, "Movimientos", C.oliva, "REGISTRO DE MOVIMIENTOS", `${generado} El mes lo decide la fecha de cargo. Lo que sale, en negativo.`,
    [
      { titulo: "Fecha de compra", ancho: 13, tipo: "fecha" },
      { titulo: "Fecha de cargo", ancho: 13, tipo: "fecha" },
      { titulo: "Concepto", ancho: 34 },
      { titulo: "Grupo", ancho: 13 },
      { titulo: "Etiqueta", ancho: 16 },
      { titulo: "Tipo", ancho: 18 },
      { titulo: "Medio", ancho: 15 },
      { titulo: "Importe", ancho: 13, tipo: "euros" },
      { titulo: "Notas", ancho: 40 },
    ],
    d.movimientos.map((m) => [m.fechaCompra, m.fechaCargo, m.concepto, m.grupo, m.etiqueta, m.tipo, m.medio, euros(m.importe), m.notas]),
  );

  // Presupuesto: parámetros y presupuesto de cada grupo mes a mes
  const ws = hoja(
    wb, "Presupuesto", C.ambar, `PRESUPUESTO ${d.presupuesto.anio}`, `${generado} Cada mes suma a su grupo los eventos del calendario.`,
    [
      { titulo: "Grupo", ancho: 16 },
      { titulo: "Fijo", ancho: 11, tipo: "euros" },
      { titulo: "En efectivo", ancho: 11, tipo: "euros" },
      ...MESES.map((m) => ({ titulo: mayuscula(m.slice(0, 3)), ancho: 10, tipo: "euros" as const })),
    ],
    d.presupuesto.grupos.map((g) => [g.nombre, euros(g.fijo), euros(g.efectivo), ...g.meses.map(euros)]),
    ["Total", euros(sum(d.presupuesto.grupos.map((g) => g.fijo))), euros(sum(d.presupuesto.grupos.map((g) => g.efectivo))), ...MESES.map((_, i) => euros(sum(d.presupuesto.grupos.map((g) => g.meses[i]))))],
  );
  const inicio = 7 + d.presupuesto.grupos.length;
  ws.getCell(`A${inicio}`).value = "Ingresos y ahorro";
  ws.getCell(`A${inicio}`).font = { bold: true, color: { argb: C.olivaOsc } };
  d.presupuesto.parametros.forEach(([texto, cent], i) => {
    ws.getCell(`A${inicio + 1 + i}`).value = texto;
    const c = ws.getCell(`C${inicio + 1 + i}`);
    c.value = euros(cent);
    c.numFmt = EUROS;
  });

  // Anuales: el calendario con lo gastado por etiqueta
  hoja(
    wb, "Anuales", C.burdeos, `CALENDARIO ANUAL ${d.presupuesto.anio}`, `${generado} Lo gastado se enlaza por la etiqueta del evento.`,
    [
      { titulo: "Mes", ancho: 12 },
      { titulo: "Día", ancho: 6, tipo: "numero" },
      { titulo: "Evento", ancho: 30 },
      { titulo: "Grupo", ancho: 13 },
      { titulo: "Etiqueta", ancho: 18 },
      { titulo: "Previsto", ancho: 12, tipo: "euros" },
      { titulo: "Gastado", ancho: 12, tipo: "euros" },
      { titulo: "Diferencia", ancho: 12, tipo: "euros" },
      { titulo: "Solo el año", ancho: 11, tipo: "numero" },
    ],
    d.anuales.map((e) => [mayuscula(e.mes), e.dia, e.nombre, e.grupo, e.etiqueta, euros(e.previsto), euros(e.gastado), euros(e.diferencia), e.soloAnio]),
    ["Total", null, null, null, null, euros(sum(d.anuales.map((e) => e.previsto))), euros(sum(d.anuales.map((e) => e.gastado))), euros(sum(d.anuales.map((e) => e.diferencia))), null],
  );

  // Ahorro: saldos al cierre de cada mes
  hoja(
    wb, "Ahorro", "FF8C9C7C", "EVOLUCIÓN DEL AHORRO", `${generado} Saldos al cierre de cada mes (el actual, a hoy).`,
    [
      { titulo: "Mes", ancho: 16 },
      { titulo: "Ahorro TR", ancho: 13, tipo: "euros" },
      { titulo: "Intereses del mes", ancho: 13, tipo: "euros" },
      { titulo: "Inversión TR", ancho: 13, tipo: "euros" },
      { titulo: "Hucha", ancho: 12, tipo: "euros" },
      { titulo: "Total", ancho: 13, tipo: "euros" },
    ],
    d.ahorro.map((a) => [mayuscula(nombreMes(a.mes)), euros(a.ahorroTr), euros(a.intereses), euros(a.inversionTr), euros(a.hucha), euros(a.total)]),
  );

  return Buffer.from(await wb.xlsx.writeBuffer());
}
