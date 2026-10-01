import { describe, expect, it } from "vitest";
import { eur, esFechaISO, marcasEje, menos, porcentaje, fecha, fechaEnMes, hoy, importeACampo, leerImporte, nombreMes, sumarDias, sumarMeses } from "./formato";

describe("importes", () => {
  it("se escriben con coma decimal, punto de miles y € detrás", () => {
    expect(eur(133191)).toBe("1.331,91 €");
    expect(eur(-2301)).toBe("−23,01 €");
    expect(eur(5)).toBe("0,05 €");
    expect(eur(123456789)).toBe("1.234.567,89 €");
    expect(eur(43550, 0)).toBe("436 €");
  });
  it("lo que sale lleva menos, salvo el cero", () => {
    expect(menos(15000)).toBe("−150,00 €");
    expect(menos(0)).toBe("0,00 €");
  });
  it("marcas de eje redondas", () => {
    expect(marcasEje(0, 133191)).toEqual([0, 50000, 100000, 150000]);
    expect(marcasEje(257500, 526800)).toEqual([200000, 300000, 400000, 500000, 600000]);
    expect(marcasEje(0, 0)).toEqual([0, 25, 50, 75, 100]);
  });
  it("porcentajes con coma", () => {
    expect(porcentaje(1.634)).toBe("163,4 %");
    expect(porcentaje(0)).toBe("0,0 %");
    expect(porcentaje(0.256, 0)).toBe("26 %");
  });
  it("se leen como los escribirías", () => {
    expect(leerImporte("12,5")).toBe(1250);
    expect(leerImporte("1.234,56")).toBe(123456);
    expect(leerImporte("1234.56")).toBe(123456);
    expect(leerImporte("1.234")).toBe(123400);
    expect(leerImporte(" 21,78 € ")).toBe(2178);
    expect(leerImporte("−3")).toBe(-300);
    expect(leerImporte("")).toBeNull();
    expect(Number.isNaN(leerImporte("doce"))).toBe(true);
    expect(Number.isNaN(leerImporte("1,2,3"))).toBe(true);
  });
  it("vuelven al campo de edición sin miles", () => {
    expect(importeACampo(133191)).toBe("1331,91");
    expect(importeACampo(-500)).toBe("-5,00");
    expect(importeACampo(null)).toBe("");
  });
});

describe("fechas", () => {
  it("dd/mm/aaaa y meses en español", () => {
    expect(fecha("2026-10-02")).toBe("02/10/2026");
    expect(nombreMes("2026-10")).toBe("octubre 2026");
  });
  it("cuentas de meses y días", () => {
    expect(sumarMeses("2026-12", 1)).toBe("2027-01");
    expect(sumarMeses("2026-01", -1)).toBe("2025-12");
    expect(fechaEnMes("2026-11", 31)).toBe("2026-11-30");
    expect(fechaEnMes("2028-02", 30)).toBe("2028-02-29");
    expect(sumarDias("2026-09-30", 2)).toBe("2026-10-02");
  });
  it("valida fechas de verdad", () => {
    expect(esFechaISO("2026-02-29")).toBe(false);
    expect(esFechaISO("2026-10-01")).toBe(true);
    expect(esFechaISO("01/10/2026")).toBe(false);
  });
  it("hoy es el de España", () => {
    expect(hoy(new Date("2026-09-30T22:30:00Z"))).toBe("2026-10-01");
  });
});
