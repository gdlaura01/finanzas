import { describe, expect, it } from "vitest";
import { conMesDeCuentas, esNomina, mesDe, resumenMes, type Mov } from "./reglas";

const mov = (fechaCargo: string, tipo: Mov["tipo"], importeCent: number, concepto: string) => ({ fechaCompra: fechaCargo, fechaCargo, tipo, medio: "imagin" as const, importeCent, concepto, cuentaDestino: "imagin" as const });

describe("nómina a final de mes", () => {
  // El caso de octubre de 2026: la del trabajo anterior a primeros y la nueva el 23
  const movs = conMesDeCuentas([
    mov("2026-10-05", "ingreso", 133191, "NOMINA (TRF)"),
    mov("2026-10-23", "ingreso", 90000, "NOMINA (TRF)"),
    mov("2026-10-24", "ingreso", 2500, "Devolución Hacienda"),
    mov("2026-11-02", "gasto", 3000, "Mercadona"),
  ]);

  it("la cobrada desde el día 20 cuenta para el mes siguiente; la de primeros, para el suyo", () => {
    expect(movs.map(mesDe)).toEqual(["2026-10", "2026-11", "2026-10", "2026-11"]);
    expect(resumenMes(movs, "2026-10").ingresos).toBe(133191 + 2500);
    expect(resumenMes(movs, "2026-11").ingresos).toBe(90000);
  });
  it("de diciembre pasa a enero del año siguiente; el día 19 aún cuenta para su mes", () => {
    expect(conMesDeCuentas([mov("2026-12-22", "ingreso", 1, "Nómina")]).map(mesDe)).toEqual(["2027-01"]);
    expect(conMesDeCuentas([mov("2026-11-19", "ingreso", 1, "Nómina")]).map(mesDe)).toEqual(["2026-11"]);
  });
  it("solo la nómina: ni otros ingresos ni gastos con esa palabra", () => {
    expect(esNomina({ tipo: "ingreso", concepto: "Nómina noviembre" })).toBe(true);
    expect(esNomina({ tipo: "ingreso", concepto: "BIZUM RECIBIDO" })).toBe(false);
    expect(esNomina({ tipo: "gasto", concepto: "Gestoría nómina" })).toBe(false);
  });
  it("con otro día de corte", () => {
    expect(conMesDeCuentas([mov("2026-10-23", "ingreso", 1, "Nómina")], 25).map(mesDe)).toEqual(["2026-10"]);
  });
});
