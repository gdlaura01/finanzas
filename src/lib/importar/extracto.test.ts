import { describe, expect, it } from "vitest";
import { aFormulario, aplicarMapeo, claseDeLinea, leerCSV, leerFecha, patronSugerido, proponerLineas, proponerMapeo } from "./extracto";
import { validarMovimiento } from "@/lib/movimientos";

// Extracto inventado con forma de banco español
const CSV = `﻿Movimientos de la cuenta ES00 0000;;;;
Fecha operación;Fecha valor;Concepto;Importe;Saldo
30/09/2026;01/10/2026;"COMPRA TARJ. REPSOL 1234; MADRID";-91,37;1.240,10
01/10/2026;01/10/2026;NOMINA EMPRESA SL;1.331,91;2.572,01
02/10/2026;02/10/2026;TRANSFERENCIA A TRADE REPUBLIC;-800,00;1.772,01
03/10/2026;03/10/2026;BIZUM DE ANA CENA;15,00;1.787,01
04/10/2026;04/10/2026;COMPRA TARJ. CAFE CENTRAL;-3,20;1.783,81
05/10/2026;;SIN IMPORTE;;
`;

describe("leer el extracto", () => {
  const tabla = leerCSV(CSV);
  it("detecta el separador, respeta las comillas y quita el BOM", () => {
    expect(tabla[1]).toEqual(["Fecha operación", "Fecha valor", "Concepto", "Importe", "Saldo"]);
    expect(tabla[2][2]).toBe("COMPRA TARJ. REPSOL 1234; MADRID");
  });
  it("propone el mapeo por los nombres de las columnas", () => {
    expect(proponerMapeo(tabla)).toEqual({ filaCabecera: 1, fecha: 0, fechaValor: 1, concepto: 2, importe: 3, cargo: null, abono: null, formatoFecha: "dma" });
  });
  it("la fecha de operación es la de compra y la fecha valor, la de cargo", () => {
    const { lineas, errores } = aplicarMapeo(tabla, proponerMapeo(tabla));
    expect(lineas[0]).toEqual({ fila: 3, fechaCompra: "2026-09-30", fechaCargo: "2026-10-01", concepto: "COMPRA TARJ. REPSOL 1234; MADRID", importeCent: -9137 });
    expect(lineas[1].importeCent).toBe(133191);
    expect(errores).toEqual([{ fila: 8, motivo: "importe ilegible o cero" }]);
  });
  it("también con columnas separadas de cargo y abono", () => {
    const t = leerCSV("Fecha,Descripción,Cargo,Abono\n2026-10-01,Mercadona,12.40,\n2026-10-02,Devolución,,5\n");
    const m = proponerMapeo(t);
    expect(m).toMatchObject({ importe: null, cargo: 2, abono: 3, formatoFecha: "amd" });
    expect(aplicarMapeo(t, m).lineas.map((l) => l.importeCent)).toEqual([-1240, 500]);
  });
  it("fechas en varios formatos", () => {
    expect(leerFecha("1/10/26", "dma")).toBe("2026-10-01");
    expect(leerFecha("2026-10-01T00:00:00", "dma")).toBe("2026-10-01");
    expect(leerFecha(46296, "dma")).toBe("2026-10-01");
    expect(leerFecha("31/02/2026", "dma")).toBeNull();
  });
});

describe("propuestas", () => {
  const tabla = leerCSV(CSV);
  const { lineas } = aplicarMapeo(tabla, proponerMapeo(tabla));
  const reglas = [{ patron: "gasolina|repsol", grupoId: 1, etiqueta: "Trabajo", prioridad: 10 }];
  const existentes = [
    { id: 7, fechaCargo: "2026-10-01", importeCent: 9137, concepto: "Gasolina", tipo: "gasto" },
    { id: 8, fechaCargo: "2026-10-03", importeCent: 133191, concepto: "Nómina", tipo: "ingreso" },
  ];
  const p = proponerLineas(lineas, { existentes, aprendido: new Map([["compra tarj. cafe central", { grupoId: 8, etiqueta: null }]]), reglas, grupoPorDefecto: 10 });

  it("cada línea, con su tipo por el signo y el concepto", () => {
    expect(p.map((x) => [x.clase, x.entradaComo])).toEqual([
      ["gasto", null],
      ["entrada", "ingreso"],
      ["ahorro", null],
      ["entrada", "devolucion"],
      ["gasto", null],
    ]);
    expect(claseDeLinea({ concepto: "TRASPASO DESDE REVOLUT", importeCent: 4000 }).clase).toBe("retirada");
  });
  it("grupo por lo aprendido o por las reglas; si no, el de por defecto", () => {
    expect(p[0]).toMatchObject({ grupoId: 1, etiqueta: "Trabajo", fuente: "regla" });
    expect(p[4]).toMatchObject({ grupoId: 8, fuente: "aprendido" });
    expect(p[3]).toMatchObject({ grupoId: 10, fuente: "nada" });
  });
  it("lo que ya tenías llega desmarcado como posible duplicado", () => {
    expect(p[0]).toMatchObject({ aceptar: false, duplicado: { tipo: "posible", con: { id: 7 } } });
    expect(p[1]).toMatchObject({ aceptar: false, duplicado: { tipo: "posible", con: { id: 8 } } });
    expect(p[2]).toMatchObject({ aceptar: true, duplicado: null });
  });
  it("cada propuesta pasa la misma validación que el formulario", () => {
    for (const x of p) expect(validarMovimiento(aFormulario(x), [1, 8, 10]).ok).toBe(true);
    const r = validarMovimiento(aFormulario(p[3]), [1, 8, 10]);
    expect(r.ok && r.datos).toMatchObject({ tipo: "gasto", importeCent: -1500, grupoId: 10 });
  });
  it("patrón para una regla nueva", () => {
    expect(patronSugerido("COMPRA TARJ. CAFE CENTRAL 4432")).toBe("cafe central");
    expect(patronSugerido("PAGO MOVIL EN MERCADONA, S.A.")).toBe("mercadona");
  });
});

describe("extracto de Imagin", () => {
  // Mismo formato que el CSV que descarga Imagin (datos inventados)
  const IMAGIN = [
    "Concepto;Fecha;Importe;Saldo",
    "PAGO TRANSFERENCIAS;05/10/2026;-150,00EUR;1.219,55EUR",
    "NOMINA (TRF);05/10/2026;1.331,91EUR;1.369,55EUR",
    "PAYPAL *SHEINCOM;02/10/2026;-23,01EUR;37,64EUR",
    "Revolut**0317*;12/09/2026;-12,95EUR;462,90EUR",
    "Revolut**0317*;01/09/2026;12,95EUR;475,85EUR",
    "ahorro;01/09/2026;-800,00EUR;666,50EUR",
    "inversion;11/05/2026;-200,00EUR;595,80EUR",
    "REINT.CAJERO;27/08/2026;-50,00EUR;254,83EUR",
    "INGRESO CAJERO;07/04/2026;310,00EUR;614,19EUR",
    "BIZUM RECIBIDO;21/09/2026;2,50EUR;252,52EUR",
    "",
  ].join("\r\n");
  const tabla = leerCSV(IMAGIN);
  const m = proponerMapeo(tabla);
  const { lineas, errores } = aplicarMapeo(tabla, m);

  it("lee los importes con «EUR» pegado y la única fecha como compra y cargo", () => {
    expect(m).toMatchObject({ concepto: 0, fecha: 1, importe: 2, fechaValor: null, formatoFecha: "dma" });
    expect(errores).toEqual([]);
    expect(lineas[0]).toMatchObject({ fechaCompra: "2026-10-05", fechaCargo: "2026-10-05", concepto: "PAGO TRANSFERENCIAS", importeCent: -15000 });
    expect(lineas[1].importeCent).toBe(133191);
  });
  it("cada línea, con el tipo que corresponde a tu forma de llevar las cuentas", () => {
    const p = proponerLineas(lineas, { existentes: [], aprendido: new Map(), reglas: [], grupoPorDefecto: 10 });
    expect(p.map((x) => [x.linea.concepto, x.clase, x.entradaComo, x.aceptar])).toEqual([
      ["PAGO TRANSFERENCIAS", "hucha", null, true],
      ["NOMINA (TRF)", "entrada", "ingreso", true],
      ["PAYPAL *SHEINCOM", "gasto", null, true],
      ["Revolut**0317*", "gasto", null, true],
      ["Revolut**0317*", "entrada", "devolucion", true],
      ["ahorro", "ahorro", null, true],
      ["inversion", "ahorro", null, true],
      ["REINT.CAJERO", "gasto", null, false],
      ["INGRESO CAJERO", "entrada", "ingreso", true],
      ["BIZUM RECIBIDO", "entrada", "devolucion", true],
    ]);
    expect(p[7].aviso).toMatch(/efectivo/);
  });
  it("el ahorro y la nómina ya apuntados se reconocen como duplicados", () => {
    const existentes = [
      { id: 1, fechaCargo: "2026-09-01", importeCent: 80000, concepto: "Traspaso a Trade Republic", tipo: "ahorro" },
      { id: 2, fechaCargo: "2026-10-04", importeCent: 133191, concepto: "Nómina", tipo: "ingreso" },
      { id: 3, fechaCargo: "2026-10-05", importeCent: 15000, concepto: "Traspaso a la hucha", tipo: "traspaso" },
    ];
    const p = proponerLineas(lineas, { existentes, aprendido: new Map(), reglas: [], grupoPorDefecto: 10 });
    expect(p.filter((x) => x.duplicado).map((x) => x.linea.concepto)).toEqual(["PAGO TRANSFERENCIAS", "NOMINA (TRF)", "ahorro"]);
  });
  it("lo del resumen mensual de tu hoja (sin día real) se reconoce en todo el mes y por sumas", () => {
    const existentes = [
      { id: 1, fechaCargo: "2026-05-01", importeCent: 106553, concepto: "Nómina", tipo: "ingreso", delMes: true },
      { id: 2, fechaCargo: "2026-05-01", importeCent: 60000, concepto: "Traspaso a Trade Republic", tipo: "ahorro", delMes: true },
      { id: 3, fechaCargo: "2026-06-01", importeCent: 70000, concepto: "Traspaso a Trade Republic", tipo: "ahorro", delMes: true },
    ];
    const csv = ["Concepto;Fecha;Importe;Saldo", "NOMINA (TRF);04/05/2026;1.065,53EUR;0", "ahorro;05/05/2026;-400,00EUR;0", "inversion;11/05/2026;-200,00EUR;0", "ahorro;02/06/2026;-500,00EUR;0", "ahorro;20/06/2026;-100,00EUR;0"].join("\n");
    const t2 = leerCSV(csv);
    const p = proponerLineas(aplicarMapeo(t2, proponerMapeo(t2)).lineas, { existentes, aprendido: new Map(), reglas: [], grupoPorDefecto: 10 });
    expect(p.map((x) => [x.linea.concepto, x.duplicado?.con.id ?? null, !!x.duplicado?.parte, x.aceptar])).toEqual([
      ["NOMINA (TRF)", 1, false, false],
      ["ahorro", 2, true, false],
      ["inversion", 2, true, false],
      // En junio no suman los 700 €: son nuevas
      ["ahorro", null, false, true],
      ["ahorro", null, false, true],
    ]);
  });
});
