import { describe, expect, it } from "vitest";
import {
  colchon,
  esDevolucion,
  eventoAplica,
  gastoGrupoMes,
  mesDe,
  normalizar,
  presupuestoGrupo,
  provisionMensual,
  resumenMes,
  saldoCuenta,
  semaforo,
  sugerir,
  tir,
  valorInversion,
  type Evento,
  type Mov,
} from "./reglas";

const GASOLINA = 1, REGALOS = 5, IGLESIA = 9, OTROS = 10, CAPRICHOS = 8;
const mov = (p: Partial<Mov> & Pick<Mov, "tipo" | "importeCent">): Mov => ({
  fechaCompra: p.fechaCargo ?? "2026-09-10",
  fechaCargo: "2026-09-10",
  medio: "imagin",
  ...p,
});

describe("disponible del mes", () => {
  it("el efectivo cuenta en el gasto pero no resta de la nómina", () => {
    const movs = [
      mov({ tipo: "ingreso", importeCent: 133191 }),
      mov({ tipo: "ahorro", importeCent: 80000, cuentaOrigen: "imagin", cuentaDestino: "ahorro_tr" }),
      mov({ tipo: "gasto", importeCent: 6000, medio: "efectivo", grupoId: GASOLINA }),
      mov({ tipo: "gasto", importeCent: 9031, grupoId: GASOLINA }),
    ];
    const r = resumenMes(movs, "2026-09");
    expect(r.gastoTotal).toBe(15031);
    expect(r.gastoEfectivo).toBe(6000);
    // 1.331,91 − 800 − (150,31 − 60) = 441,60
    expect(r.disponible).toBe(44160);
    expect(gastoGrupoMes(movs, GASOLINA, "2026-09")).toBe(15031);
  });

  it("reproduce septiembre de la plantilla: 17,43 € disponibles", () => {
    const movs = [
      mov({ tipo: "ingreso", importeCent: 133191 }),
      mov({ tipo: "ahorro", importeCent: 80000 }),
      mov({ tipo: "traspaso", importeCent: 11249, medio: "revolut" }),
      mov({ tipo: "gasto", importeCent: 56199 - 16000 }),
      mov({ tipo: "gasto", importeCent: 16000, medio: "efectivo" }),
    ];
    expect(resumenMes(movs, "2026-09").disponible).toBe(1743);
  });

  it("lo pagado con Revolut no se resta dos veces (ya salió al traspasarlo a la hucha)", () => {
    const movs = [
      mov({ tipo: "ingreso", importeCent: 100000 }),
      mov({ tipo: "traspaso", importeCent: 15000, medio: "revolut" }),
      mov({ tipo: "gasto", importeCent: 4000, medio: "revolut", grupoId: REGALOS }),
    ];
    const r = resumenMes(movs, "2026-09");
    expect(r.disponible).toBe(85000);
    expect(r.gastoTotal).toBe(4000);
  });

  it("sacar de la hucha devuelve el dinero al disponible", () => {
    const movs = [
      mov({ tipo: "ingreso", importeCent: 100000 }),
      mov({ tipo: "gasto", importeCent: 4000, grupoId: REGALOS }),
      mov({ tipo: "interno", importeCent: 4000, medio: "revolut", cuentaOrigen: "hucha_revolut", cuentaDestino: "imagin" }),
    ];
    const r = resumenMes(movs, "2026-09");
    expect(r.retiradas).toBe(4000);
    expect(r.disponible).toBe(100000);
  });

  it("una devolución netea el gasto de su grupo y no infla los ingresos", () => {
    const movs = [
      mov({ tipo: "gasto", importeCent: 1852, grupoId: CAPRICHOS }),
      mov({ tipo: "gasto", importeCent: -1852, grupoId: CAPRICHOS }),
    ];
    expect(esDevolucion(movs[1])).toBe(true);
    expect(gastoGrupoMes(movs, CAPRICHOS, "2026-09")).toBe(0);
    expect(resumenMes(movs, "2026-09").ingresos).toBe(0);
  });

  it("el mes lo decide la fecha de cargo, no la de compra", () => {
    const m = mov({ tipo: "gasto", importeCent: 5000, fechaCompra: "2026-09-30", fechaCargo: "2026-10-02" });
    expect(mesDe(m)).toBe("2026-10");
    expect(resumenMes([m], "2026-09").gastoTotal).toBe(0);
    expect(resumenMes([m], "2026-10").gastoTotal).toBe(5000);
  });
});

describe("presupuesto por grupo", () => {
  const regalos = { id: REGALOS, presupuestoCent: null, esDinamico: true };
  const iglesia = { id: IGLESIA, presupuestoCent: 1000, esDinamico: false };
  const eventos: Evento[] = [
    { mes: 12, grupoId: REGALOS, etiqueta: "Navidad", importePrevistoCent: 20000 },
    { mes: 12, dia: 5, grupoId: REGALOS, etiqueta: "Cumple 1", importePrevistoCent: 4000 },
    { mes: null, grupoId: REGALOS, etiqueta: "Aniversario", importePrevistoCent: 4000 },
    { mes: 3, grupoId: IGLESIA, etiqueta: "Cofradía", importePrevistoCent: 3000 },
    { mes: 6, anio: 2027, grupoId: REGALOS, etiqueta: "Boda", importePrevistoCent: 15000 },
  ];

  it("Regalos es cero en un mes sin eventos", () => {
    expect(presupuestoGrupo(regalos, "2026-10", eventos)).toBe(0);
  });
  it("Regalos suma los eventos de ese mes, y no los que no tienen mes", () => {
    expect(presupuestoGrupo(regalos, "2026-12", eventos)).toBe(24000);
  });
  it("un grupo fijo suma sus eventos del mes a su presupuesto", () => {
    expect(presupuestoGrupo(iglesia, "2027-03", eventos)).toBe(4000);
    expect(presupuestoGrupo(iglesia, "2027-04", eventos)).toBe(1000);
  });
  it("un evento de un solo año no aparece otros años", () => {
    expect(eventoAplica({ anio: 2027 }, 2026)).toBe(false);
    expect(presupuestoGrupo(regalos, "2027-06", eventos)).toBe(15000);
    expect(presupuestoGrupo(regalos, "2026-06", eventos)).toBe(0);
  });
  it("provisión mensual: lo previsto en 12 meses entre 12", () => {
    const meses = Array.from({ length: 12 }, (_, i) => `2027-${String(i + 1).padStart(2, "0")}`);
    expect(provisionMensual(eventos, meses)).toBe(Math.round((20000 + 4000 + 3000 + 15000) / 12));
  });
  it("semáforo: verde hasta el 80 %, ámbar hasta el 100 %, burdeos por encima", () => {
    expect(semaforo(7900, 10000)).toBe("verde");
    expect(semaforo(8000, 10000)).toBe("ambar");
    expect(semaforo(10000, 10000)).toBe("ambar");
    expect(semaforo(10001, 10000)).toBe("rojo");
    expect(semaforo(500, 0)).toBe("rojo");
  });
});

describe("saldos de las cuentas", () => {
  const cuadres = [
    { cuenta: "hucha_revolut" as const, fecha: "2026-08-31", saldoRealCent: 0 },
    { cuenta: "ahorro_tr" as const, fecha: "2026-08-31", saldoRealCent: 191166 },
  ];
  const movs: Mov[] = [
    mov({ tipo: "traspaso", importeCent: 15000, medio: "revolut", fechaCargo: "2026-10-05", cuentaOrigen: "imagin", cuentaDestino: "hucha_revolut" }),
    mov({ tipo: "gasto", importeCent: 4000, medio: "revolut", grupoId: REGALOS, fechaCargo: "2026-10-12" }),
    mov({ tipo: "gasto", importeCent: 3000, medio: "imagin", grupoId: REGALOS, fechaCargo: "2026-10-13" }),
    mov({ tipo: "interno", importeCent: 2000, medio: "revolut", fechaCargo: "2026-10-20", cuentaOrigen: "hucha_revolut", cuentaDestino: "imagin" }),
    mov({ tipo: "ahorro", importeCent: 50000, medio: "trade_republic", fechaCargo: "2026-09-01", cuentaOrigen: "imagin", cuentaDestino: "ahorro_tr" }),
    mov({ tipo: "interno", importeCent: 15000, medio: "trade_republic", fechaCargo: "2026-10-02", cuentaOrigen: "ahorro_tr", cuentaDestino: "inversion_tr" }),
  ];
  const intereses = [
    { cuenta: "ahorro_tr" as const, mes: "2026-08", importeCent: 312 },
    { cuenta: "ahorro_tr" as const, mes: "2026-09", importeCent: 369 },
    { cuenta: "ahorro_tr" as const, mes: "2026-10", importeCent: 462 },
  ];

  it("la hucha sube con los traspasos y baja con lo pagado con Revolut y lo que sacas", () => {
    // 150 − 40 (Revolut) − 20 (retirada); el regalo pagado con Imagin no la toca
    expect(saldoCuenta("hucha_revolut", "2026-10-31", { cuadres, movs, intereses })).toBe(9000);
  });
  it("Ahorro TR: saldo de partida + aportaciones + intereses posteriores − lo que pasa a Inversión TR", () => {
    // 1.911,66 + 500 + 3,69 + 4,62 − 150 (el interés de agosto ya estaba en el saldo de partida)
    expect(saldoCuenta("ahorro_tr", "2026-10-31", { cuadres, movs, intereses })).toBe(191166 + 50000 + 369 + 462 - 15000);
  });
  it("sin cuadre previo no hay saldo", () => {
    expect(saldoCuenta("ahorro_tr", "2026-08-30", { cuadres, movs, intereses })).toBeNull();
  });
  it("Inversión TR: último valor anotado más lo aportado después", () => {
    const valoraciones = [{ fecha: "2026-09-30", valorCent: 144888 }];
    expect(valorInversion("2026-10-31", { valoraciones, movs })).toBe(144888 + 15000);
  });
});

describe("cartera y colchón", () => {
  it("TIR de tus aportaciones de mayo a septiembre", () => {
    const flujos = [
      { fecha: "2026-05-01", importe: -20000 },
      { fecha: "2026-06-01", importe: -30000 },
      { fecha: "2026-07-01", importe: -30000 },
      { fecha: "2026-08-01", importe: -30000 },
      { fecha: "2026-09-01", importe: -30000 },
      { fecha: "2026-09-30", importe: 144888 },
    ];
    const r = tir(flujos)!;
    expect(r).toBeGreaterThan(0.1);
    expect(r).toBeLessThan(0.25);
  });
  it("colchón de 3 meses", () => {
    const c = colchon(59335, 3, 241997);
    expect(c.objetivo).toBe(178005);
    expect(c.sobra).toBe(63992);
    expect(c.cubierto).toBeCloseTo(1.359, 3);
  });
});

describe("sugerencias de clasificación", () => {
  const reglas = [
    { patron: "bizum|mercadona", grupoId: OTROS, etiqueta: null, prioridad: 90 },
    { patron: "gasolina|repsol", grupoId: GASOLINA, etiqueta: "Trabajo", prioridad: 10 },
    { patron: "^bar", grupoId: CAPRICHOS, etiqueta: null, prioridad: 40 },
  ];
  it("normaliza tildes y mayúsculas", () => {
    expect(normalizar("  Cafetería  ÁLVARO ")).toBe("cafeteria alvaro");
  });
  it("lo aprendido gana a las reglas", () => {
    const ap = new Map([["repsol", { grupoId: OTROS, etiqueta: null }]]);
    expect(sugerir("REPSOL", ap, reglas)?.fuente).toBe("aprendido");
  });
  it("las reglas se prueban por prioridad", () => {
    expect(sugerir("REPSOL ESTACION 123", new Map(), reglas)?.grupoId).toBe(GASOLINA);
    expect(sugerir("Bar Mirasierra", new Map(), reglas)?.grupoId).toBe(CAPRICHOS);
    expect(sugerir("Zapatería", new Map(), reglas)).toBeNull();
  });
});
