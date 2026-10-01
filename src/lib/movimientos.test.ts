import { describe, expect, it } from "vitest";
import {
  automaticosPendientes,
  claseDe,
  clasificarEntrada,
  pendientesMes,
  sentido,
  validarMovimiento,
  type EntradaFormulario,
  type Hechos,
  type Recurrente,
} from "./movimientos";
import { resumenMes } from "./reglas";

const GRUPOS = [1, 5, 10];
const base: EntradaFormulario = { clase: "gasto", fechaCompra: "2026-10-01", fechaCargo: "2026-10-01", concepto: "Gasolina", importe: "50", grupoId: "1", medio: "imagin" };
const ok = (e: EntradaFormulario) => {
  const r = validarMovimiento({ ...base, ...e }, GRUPOS);
  if (!r.ok) throw new Error(JSON.stringify(r.errores));
  return r.datos;
};

describe("registrar: lo que eliges se traduce al modelo", () => {
  it("gasto: importe positivo con su grupo", () => {
    const d = ok({ importe: "91,37" });
    expect(d).toMatchObject({ tipo: "gasto", importeCent: 9137, grupoId: 1 });
  });
  it("entrada de dinero que parece nómina: ingreso sin grupo", () => {
    const d = ok({ clase: "entrada", concepto: "Nómina octubre", importe: "1.331,91", grupoId: "" });
    expect(d).toMatchObject({ tipo: "ingreso", importeCent: 133191, grupoId: null, cuentaDestino: "imagin" });
  });
  it("cualquier otra entrada es una devolución: gasto negativo en su grupo", () => {
    const d = ok({ clase: "entrada", concepto: "Bizum recibido cena", importe: "15", grupoId: "10" });
    expect(d).toMatchObject({ tipo: "gasto", importeCent: -1500, grupoId: 10 });
    expect(claseDe(d)).toBe("devolucion");
  });
  it("puedes forzar que una entrada sea ingreso o devolución", () => {
    expect(ok({ clase: "entrada", concepto: "Bizum de mamá", entradaComo: "ingreso", grupoId: "" }).tipo).toBe("ingreso");
    expect(ok({ clase: "entrada", concepto: "Nómina mal cobrada", entradaComo: "devolucion", grupoId: "10" }).importeCent).toBe(-5000);
  });
  it("ahorro va de Imagin a Ahorro TR o a Inversión TR", () => {
    expect(ok({ clase: "ahorro", medio: "trade_republic" })).toMatchObject({ tipo: "ahorro", cuentaOrigen: "imagin", cuentaDestino: "ahorro_tr", grupoId: null });
    expect(ok({ clase: "ahorro", cuentaDestino: "inversion_tr" }).cuentaDestino).toBe("inversion_tr");
  });
  it("a la hucha y sacar de la hucha", () => {
    expect(ok({ clase: "hucha", medio: "revolut" })).toMatchObject({ tipo: "traspaso", cuentaDestino: "hucha_revolut" });
    const r = ok({ clase: "retirada", medio: "revolut" });
    expect(r).toMatchObject({ tipo: "interno", cuentaOrigen: "hucha_revolut", cuentaDestino: "imagin" });
    expect(claseDe(r)).toBe("retirada");
    expect(sentido(r)).toBe(1);
  });
  it("cubrir con la hucha solo vale en gastos que no se pagan con Revolut", () => {
    expect(ok({ cubrirConHucha: "on" }).cubrirConHucha).toBe(true);
    expect(ok({ cubrirConHucha: "on", medio: "revolut" }).cubrirConHucha).toBe(false);
    expect(ok({ clase: "hucha", cubrirConHucha: "on" }).cubrirConHucha).toBe(false);
  });
  it("lo que registras cuadra con el disponible del mes", () => {
    const movs = [
      ok({ clase: "entrada", concepto: "Nómina", importe: "1000", grupoId: "" }),
      ok({ importe: "60", medio: "efectivo" }),
      ok({ importe: "40" }),
      ok({ clase: "entrada", concepto: "Bizum gasolina", importe: "10" }),
      ok({ clase: "retirada", importe: "40", medio: "revolut" }),
    ];
    // 1.000 − (60 + 40 − 10 − 60 en efectivo) + 40 sacados de la hucha
    expect(resumenMes(movs, "2026-10").disponible).toBe(100000 - 3000 + 4000);
  });
});

describe("registrar: avisos", () => {
  const errores = (e: EntradaFormulario) => {
    const r = validarMovimiento({ ...base, ...e }, GRUPOS);
    return r.ok ? {} : r.errores;
  };
  it("el cargo no puede ser anterior a la compra", () => {
    expect(errores({ fechaCargo: "2026-09-30" }).fechaCargo).toMatch(/anterior/);
  });
  it("importe vacío, cero, ilegible o negativo", () => {
    expect(errores({ importe: "" }).importe).toBeDefined();
    expect(errores({ importe: "0" }).importe).toBeDefined();
    expect(errores({ importe: "abc" }).importe).toBeDefined();
    expect(errores({ importe: "-5" }).importe).toMatch(/positivo/);
  });
  it("un gasto necesita un grupo que exista", () => {
    expect(errores({ grupoId: "" }).grupoId).toBeDefined();
    expect(errores({ grupoId: "99" }).grupoId).toBeDefined();
    expect(errores({ clase: "hucha", grupoId: "" }).grupoId).toBeUndefined();
  });
  it("concepto, fechas y medio", () => {
    expect(errores({ concepto: "   " }).concepto).toBeDefined();
    expect(errores({ fechaCompra: "2026-02-30" }).fechaCompra).toBeDefined();
    expect(errores({ medio: "bitcoin" }).medio).toBeDefined();
  });
  it("clasifica entradas por el concepto", () => {
    expect(clasificarEntrada("NÓMINA SEPTIEMBRE")).toBe("ingreso");
    expect(clasificarEntrada("Devolución Shein")).toBe("devolucion");
  });
});

describe("recurrentes pendientes", () => {
  const rec = (p: Partial<Recurrente>): Recurrente => ({
    id: 1, concepto: "X", clase: "gasto", grupoId: 1, etiqueta: null, medio: "imagin", cuentaOrigen: null, cuentaDestino: null,
    importeCent: 1000, vinculo: null, dia: null, auto: false, activo: true, desde: "2026-10", ...p,
  });
  const lista = [
    rec({ id: 1, concepto: "Nómina", clase: "entrada", vinculo: "nomina", importeCent: null }),
    rec({ id: 2, concepto: "Claude", dia: 16, importeCent: 2178 }),
    rec({ id: 3, concepto: "Intereses", clase: "interes", cuentaDestino: "ahorro_tr", importeCent: null, dia: 1 }),
    rec({ id: 4, concepto: "Valor", clase: "valoracion", importeCent: null, dia: 28 }),
    rec({ id: 5, concepto: "Antiguo", activo: false }),
    rec({ id: 6, concepto: "Del mes que viene", desde: "2026-11" }),
  ];
  const vacio = (): Hechos => ({ registrados: new Set(), omitidos: new Set(), intereses: new Set(), valoraciones: new Set() });
  const p = { nomina_cent: 133191 };

  it("lista los del mes con su fecha prevista; la nómina, sin día fijo", () => {
    const l = pendientesMes(lista, vacio(), "2026-10", "2026-10-01", p);
    expect(l.map((x) => x.recurrente.id)).toEqual([1, 3, 2, 4]);
    expect(l[0]).toMatchObject({ fechaPrevista: null, importeCent: 133191 });
    expect(l[2].fechaPrevista).toBe("2026-10-16");
  });
  it("desaparecen al registrarlos u omitirlos, y los intereses al anotarlos", () => {
    const h = vacio();
    h.registrados.add("1|2026-10");
    h.omitidos.add("2|2026-10");
    h.intereses.add("ahorro_tr|2026-10");
    h.valoraciones.add("2026-10");
    expect(pendientesMes(lista, h, "2026-10", "2026-10-20", p)).toEqual([]);
  });
  it("los meses futuros no tienen pendientes", () => {
    expect(pendientesMes(lista, vacio(), "2026-11", "2026-10-20", p)).toEqual([]);
  });
  it("«se apunta solo»: solo con día fijo, cuando llega la fecha y sin repetir", () => {
    const autos = [rec({ id: 7, concepto: "Spotify", auto: true, dia: 28, desde: "2026-09" }), rec({ id: 8, auto: true, dia: null })];
    expect(automaticosPendientes(autos, vacio(), "2026-10-27", p).map((a) => a.fecha)).toEqual(["2026-09-28"]);
    const h = vacio();
    h.registrados.add("7|2026-09");
    expect(automaticosPendientes(autos, h, "2026-10-28", p).map((a) => a.fecha)).toEqual(["2026-10-28"]);
  });
});
