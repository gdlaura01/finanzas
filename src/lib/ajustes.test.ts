import { describe, expect, it } from "vitest";
import { mover, palabrasAPatron, patronAEditable, patronAPalabras, validarAtajo, validarGrupo, validarRecurrente } from "./ajustes";
import { sugerir } from "./reglas";

describe("orden", () => {
  it("sube y baja una posición, sin salirse", () => {
    expect(mover([1, 2, 3], 2, -1)).toEqual([2, 1, 3]);
    expect(mover([1, 2, 3], 2, 1)).toEqual([1, 3, 2]);
    expect(mover([1, 2, 3], 1, -1)).toEqual([1, 2, 3]);
    expect(mover([1, 2, 3], 3, 1)).toEqual([1, 2, 3]);
  });
});

describe("recurrentes", () => {
  const ctx = { grupos: [1, 3, 8], nuevo: true, vinculado: false };
  it("un gasto nuevo con su grupo, día e importe", () => {
    const r = validarRecurrente({ concepto: " Netflix ", clase: "gasto", grupoId: "8", importe: "9,99", dia: "5", medio: "imagin" }, ctx);
    expect(r.ok && r.datos).toMatchObject({ concepto: "Netflix", clase: "gasto", grupoId: 8, importeCent: 999, dia: 5, auto: false, activo: true });
  });
  it("«se apunta solo» necesita día e importe", () => {
    const r = validarRecurrente({ concepto: "Netflix", clase: "gasto", grupoId: "8", importe: "", dia: "", auto: "on" }, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errores.dia).toMatch(/día fijo/);
      expect(r.errores.importe).toMatch(/importe/);
    }
  });
  it("los ligados a un parámetro (nómina) no cambian su importe aquí", () => {
    const r = validarRecurrente({ concepto: "Nómina", importe: "1", dia: "", activo: "on" }, { grupos: [], nuevo: false, clase: "entrada", vinculado: true });
    expect(r.ok && r.datos.importeCent).toBeNull();
  });
  it("avisa de día imposible, grupo y tipo", () => {
    const r = validarRecurrente({ concepto: "x", clase: "otro", dia: "32" }, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errores).sort()).toEqual(["clase", "dia"]);
    const g = validarRecurrente({ concepto: "x", clase: "gasto", grupoId: "99" }, ctx);
    expect(!g.ok && g.errores.grupoId).toBeTruthy();
  });
  it("apagado con «activo» en off; el medio por defecto según el tipo", () => {
    const r = validarRecurrente({ concepto: "Hucha extra", clase: "hucha", importe: "20", activo: "off" }, ctx);
    expect(r.ok && r.datos).toMatchObject({ activo: false, medio: "revolut", grupoId: null });
  });
});

describe("atajos", () => {
  it("importe vacío = variable; una entrada como ingreso no lleva grupo", () => {
    const a = validarAtajo({ textoBoton: "Café", concepto: "Cafetería", clase: "gasto", grupoId: "8", importe: "", medio: "imagin" }, [8]);
    expect(a.ok && a.datos).toMatchObject({ importeCent: null, grupoId: 8 });
    const b = validarAtajo({ textoBoton: "Bizum", concepto: "Bizum de mamá", clase: "entrada", entradaComo: "ingreso", grupoId: "8" }, [8]);
    expect(b.ok && b.datos).toMatchObject({ entradaComo: "ingreso", grupoId: null });
  });
  it("necesita texto y concepto", () => {
    const a = validarAtajo({ clase: "gasto" }, []);
    expect(!a.ok && Object.keys(a.errores).sort()).toEqual(["concepto", "textoBoton"]);
  });
});

describe("grupos", () => {
  it("nombre único sin mirar tildes ni mayúsculas, color y presupuesto inicial", () => {
    expect(validarGrupo({ nombre: "formacion", color: "#607456" }, { nombresDeOtros: ["Formación"], nuevo: true }).ok).toBe(false);
    const g = validarGrupo({ nombre: "Coche", color: "#607456", presupuesto: "50" }, { nombresDeOtros: ["Formación"], nuevo: true });
    expect(g.ok && g.datos).toEqual({ nombre: "Coche", color: "#607456", presupuestoCent: 5000 });
    expect(validarGrupo({ nombre: "Coche", color: "rojo" }, { nombresDeOtros: [], nuevo: false }).ok).toBe(false);
  });
});

describe("reglas", () => {
  it("de palabras a patrón y vuelta, sin tildes y escapando lo raro", () => {
    expect(palabrasAPatron("Repsol, CEPSA,  , gasolinera.es, ^bar")).toBe("repsol|cepsa|gasolinera\\.es|^bar");
    expect(patronAPalabras("repsol|^bar|^hm$")).toEqual(["repsol", "«bar» al inicio", "«hm» exacto"]);
    expect(patronAEditable("repsol|gasolinera\\.es")).toBe("repsol, gasolinera.es");
  });
  it("el patrón funciona igual al proponer", () => {
    const reglas = [{ patron: palabrasAPatron("gasolinera.es, ^bar"), grupoId: 1, etiqueta: null, prioridad: 1 }];
    expect(sugerir("GASOLINERA.ES 123", new Map(), reglas)?.grupoId).toBe(1);
    expect(sugerir("Gasolineraxes", new Map(), reglas)).toBeNull();
    expect(sugerir("Bar Pepe", new Map(), reglas)?.grupoId).toBe(1);
  });
});
