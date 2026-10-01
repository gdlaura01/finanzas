import { describe, expect, it } from "vitest";
import { analisisInversion, estadoColchon, flujosMes, gastoMedio, haceDias, interesPrevisto, serieCuenta } from "./cuentas";
import type { Mov } from "./reglas";

const mov = (p: Partial<Mov> & Pick<Mov, "tipo" | "importeCent" | "fechaCargo">): Mov => ({ fechaCompra: p.fechaCargo, medio: "imagin", ...p });
const paso = (fecha: string, importe: number) => mov({ tipo: "interno", importeCent: importe, fechaCargo: fecha, cuentaOrigen: "ahorro_tr", cuentaDestino: "inversion_tr", medio: "trade_republic" });

const D = {
  cuadres: [
    { cuenta: "imagin" as const, fecha: "2026-04-30", saldoRealCent: 35151 },
    { cuenta: "ahorro_tr" as const, fecha: "2026-08-31", saldoRealCent: 191166 },
    { cuenta: "hucha_revolut" as const, fecha: "2026-08-31", saldoRealCent: 0 },
  ],
  movs: [
    mov({ tipo: "ingreso", importeCent: 133191, fechaCargo: "2026-09-01" }),
    mov({ tipo: "ahorro", importeCent: 80000, fechaCargo: "2026-09-01", cuentaOrigen: "imagin", cuentaDestino: "ahorro_tr", medio: "trade_republic" }),
    paso("2026-05-01", 20000),
    paso("2026-06-01", 30000),
    paso("2026-09-02", 30000),
    mov({ tipo: "gasto", importeCent: 50000, fechaCargo: "2026-07-10" }),
    mov({ tipo: "gasto", importeCent: 60000, fechaCargo: "2026-08-10" }),
    mov({ tipo: "gasto", importeCent: 40000, fechaCargo: "2026-09-10" }),
    mov({ tipo: "traspaso", importeCent: 15000, fechaCargo: "2026-10-05", cuentaOrigen: "imagin", cuentaDestino: "hucha_revolut", medio: "revolut" }),
  ],
  intereses: [{ cuenta: "ahorro_tr" as const, mes: "2026-10", importeCent: 462 }],
  valoraciones: [
    { fecha: "2026-05-31", valorCent: 20378 },
    { fecha: "2026-06-30", valorCent: 50374 },
    { fecha: "2026-09-30", valorCent: 85000 },
  ],
};

describe("cuentas y ahorro", () => {
  it("saldo de cada mes; antes del saldo de partida no hay", () => {
    expect(serieCuenta("ahorro_tr", D, "2026-07", "2026-10-10")).toEqual([
      { mes: "2026-08", saldo: 191166 },
      { mes: "2026-09", saldo: 191166 + 80000 - 30000 },
      { mes: "2026-10", saldo: 191166 + 50000 + 462 },
    ]);
  });
  it("lo que entra y sale de una cuenta en un mes", () => {
    expect(flujosMes("imagin", D.movs, "2026-09")).toEqual({ entra: 133191, sale: 80000 + 40000 });
    expect(flujosMes("ahorro_tr", D.movs, "2026-09")).toEqual({ entra: 80000, sale: 30000 });
  });
  it("gasto medio de los tres últimos meses con movimientos", () => {
    expect(gastoMedio(D.movs, "2026-10-10")).toBe(50000);
  });
  it("colchón: Ahorro TR + hucha frente a N meses de gasto", () => {
    const c = estadoColchon(D, "2026-10-10", 3);
    expect(c).toMatchObject({ medio: 50000, objetivo: 150000, liquido: 241628 + 15000 });
    expect(c.sobra).toBe(256628 - 150000);
    expect(estadoColchon(D, "2026-10-10", 6).cubierto).toBeLessThan(1);
  });
  it("Inversión TR: aportado, ganancia, TIR y frente a dejarlo en la cuenta", () => {
    const a = analisisInversion(D, 0.025)!;
    expect(a).toMatchObject({ fecha: "2026-09-30", valor: 85000, aportado: 80000, ganancia: 5000 });
    expect(a.tir).toBeGreaterThan(0);
    expect(a.alternativa).toBeGreaterThan(80000);
    expect(a.alternativa).toBeLessThan(81500);
    expect(a.serie.map((s) => s.aportado)).toEqual([20000, 50000, 80000]);
    // De junio a septiembre se aportaron 300 €: el rendimiento no los cuenta
    expect(a.valores[2]).toMatchObject({ aportadoEntre: 30000, rendimiento: 85000 - 50374 - 30000 });
  });
  it("sin valores anotados no hay análisis", () => {
    expect(analisisInversion({ ...D, valoraciones: [] }, 0.025)).toBeNull();
  });
  it("interés previsto y fechas en palabras", () => {
    expect(interesPrevisto(240000, 0.025)).toBe(4860);
    expect(haceDias("2026-10-09", "2026-10-10")).toBe("ayer");
    expect(haceDias("2026-10-01", "2026-10-10")).toBe("hace 9 días");
  });
});
