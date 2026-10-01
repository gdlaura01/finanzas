import { describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { abrirBaseDatos } from ".";
import { sembrar } from "./semilla";
import * as t from "./schema";
import { clasificarCarga, confirmarMesCarga, crearRegla, deshacerRevision, guardarCargaInicial, guardarExtracto, guardarMapeo, mapeosGuardados, pendientesDeRevisar } from "./importar";
import { crearMovimiento, porRevisar } from "./movimientos";
import type { MovCarga } from "@/lib/importar/hoja";

function nueva() {
  const db = abrirBaseDatos(":memory:");
  migrate(db, { migrationsFolder: "./drizzle" });
  sembrar(db);
  return db;
}
const mc = (p: Partial<MovCarga>): MovCarga => ({
  fechaCompra: p.fechaCargo ?? "2026-08-05", fechaCargo: "2026-08-05", concepto: "Mercadona", tipo: "gasto", medio: "imagin", importeCent: 1000,
  grupo: "Otros", etiqueta: null, cuentaOrigen: null, cuentaDestino: null, notas: null, ...p,
});
const CARGA = [
  mc({ concepto: "Nómina", tipo: "ingreso", importeCent: 133191, fechaCargo: "2026-08-01", grupo: null, cuentaDestino: "imagin", notas: "Fecha supuesta (día 1): x" }),
  mc({ concepto: "Traspaso a Trade Republic", tipo: "ahorro", importeCent: 80000, fechaCargo: "2026-08-01", grupo: null }),
  mc({ concepto: "Gasolina", importeCent: 5000, fechaCompra: "2026-08-03", fechaCargo: "2026-08-05" }),
  mc({ concepto: "Gasolina", importeCent: 5000, fechaCargo: "2026-08-13" }),
  mc({ concepto: "Mercadona" }),
  mc({ concepto: "Shein", importeCent: 2301, fechaCargo: "2026-10-02" }),
];

describe("carga inicial en la base de datos", () => {
  it("guarda todo pendiente de revisar, una sola vez, y no duplica lo que ya habías apuntado", () => {
    const db = nueva();
    // Ya habías apuntado Shein a mano, con otra fecha y otro nombre
    crearMovimiento(db, { fechaCompra: "2026-10-01", fechaCargo: "2026-10-01", concepto: "Ropa Shein", tipo: "gasto", medio: "imagin", importeCent: 2301, grupoId: 7, etiqueta: null, notas: null, cuentaOrigen: null, cuentaDestino: null, cubrirConHucha: false });
    const r = guardarCargaInicial(db, "Seguimiento.xlsx", CARGA);
    expect(r.cargados).toBe(5);
    expect(r.omitidos.map((o) => o.mov.concepto)).toEqual(["Shein"]);
    expect(porRevisar(db)).toBe(5);
    expect(db.select().from(t.importaciones).get()).toMatchObject({ archivo: "Carga inicial · Seguimiento.xlsx", aceptadas: 5, descartadas: 1 });
    expect(() => guardarCargaInicial(db, "otra.xlsx", CARGA)).toThrow(/ya está hecha/);
  });

  it("confirmar un mes pone el día real a la nómina y sus traspasos, y se puede deshacer", () => {
    const db = nueva();
    guardarCargaInicial(db, "x.xlsx", CARGA);
    const antes = confirmarMesCarga(db, "2026-08", "2026-08-29");
    expect(antes).toHaveLength(2);
    const nomina = db.select().from(t.movimientos).where(eq(t.movimientos.concepto, "Nómina")).get()!;
    expect(nomina).toMatchObject({ fechaCargo: "2026-08-29", fechaCompra: "2026-08-29", pendienteRevision: false, notas: null });
    deshacerRevision(db, antes);
    expect(db.select().from(t.movimientos).where(eq(t.movimientos.concepto, "Nómina")).get()).toMatchObject({ fechaCargo: "2026-08-01", pendienteRevision: true });
  });

  it("clasificar por lotes, con excepciones por apunte, y deshacer", () => {
    const db = nueva();
    guardarCargaInicial(db, "x.xlsx", CARGA);
    const gas = pendientesDeRevisar(db).filter((m) => m.concepto === "Gasolina");
    const antes = clasificarCarga(db, [{ ids: gas.map((m) => m.id), grupoId: 1, etiqueta: "Trabajo", excepciones: { [gas[1].id]: { medio: "efectivo" } } }]);
    const tras = db.select().from(t.movimientos).where(eq(t.movimientos.concepto, "Gasolina")).all();
    expect(tras.map((m) => [m.grupoId, m.etiqueta, m.medio, m.pendienteRevision])).toEqual([
      [1, "Trabajo", "imagin", false],
      [1, "Trabajo", "efectivo", false],
    ]);
    // La fecha de compra distinta del cargo se conserva
    expect(tras[0].fechaCompra).toBe("2026-08-03");
    deshacerRevision(db, antes);
    expect(db.select().from(t.movimientos).where(eq(t.movimientos.concepto, "Gasolina")).all().every((m) => m.pendienteRevision && m.grupoId === 10)).toBe(true);
  });
});

describe("extractos en la base de datos", () => {
  it("guarda el mapeo por nombre y lo sobrescribe", () => {
    const db = nueva();
    const a = guardarMapeo(db, "Imagin", { fecha: 0 });
    const b = guardarMapeo(db, "Imagin", { fecha: 1 });
    expect(a).toBe(b);
    expect(mapeosGuardados(db)[0].configuracion).toEqual({ fecha: 1 });
  });
  it("guarda las líneas aceptadas como importación, ya revisadas", () => {
    const db = nueva();
    const id = guardarExtracto(db, {
      archivo: "extracto.csv", mapeoId: null, filasLeidas: 3, descartadas: 2,
      movimientos: [{ fechaCompra: "2026-10-04", fechaCargo: "2026-10-04", concepto: "COMPRA CAFE", tipo: "gasto", medio: "imagin", importeCent: 320, grupoId: 8, etiqueta: null, notas: null, cuentaOrigen: null, cuentaDestino: null }],
    });
    const m = db.select().from(t.movimientos).get()!;
    expect(m).toMatchObject({ origen: "importacion", importacionId: id, pendienteRevision: false, conceptoNorm: "compra cafe" });
    expect(porRevisar(db)).toBe(0);
  });
  it("una regla nueva va por delante de las generales", () => {
    const db = nueva();
    crearRegla(db, "cafe central", 8, null);
    const reglas = db.select().from(t.reglasImportacion).orderBy(t.reglasImportacion.prioridad).all();
    expect(reglas[0]).toMatchObject({ patron: "cafe central", prioridad: 0 });
  });
});
