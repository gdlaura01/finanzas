import { describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { abrirBaseDatos } from ".";
import { sembrar } from "./semilla";
import * as t from "./schema";
import {
  borrarMovimiento,
  cambiarDiaRecurrente,
  confirmarRecurrente,
  crearMovimiento,
  editarMovimiento,
  omitirRecurrente,
  pendientes,
  registrarAutomaticos,
  ultimosPorConcepto,
} from "./movimientos";
import { validarMovimiento, type EntradaFormulario } from "@/lib/movimientos";

function nueva() {
  const db = abrirBaseDatos(":memory:");
  migrate(db, { migrationsFolder: "./drizzle" });
  sembrar(db);
  return db;
}
const datos = (e: EntradaFormulario) => {
  const r = validarMovimiento({ clase: "gasto", fechaCompra: "2026-10-03", fechaCargo: "2026-10-03", concepto: "Regalo", importe: "40", grupoId: "5", medio: "imagin", ...e }, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  if (!r.ok) throw new Error(JSON.stringify(r.errores));
  return r.datos;
};
const movs = (db: ReturnType<typeof nueva>) => db.select().from(t.movimientos).all();

describe("cubrir un gasto con la hucha", () => {
  it("crea una retirada enlazada por el mismo importe", () => {
    const db = nueva();
    const id = crearMovimiento(db, datos({ cubrirConHucha: "on" }));
    const [g, r] = movs(db);
    expect(g.id).toBe(id);
    expect(r).toMatchObject({ tipo: "interno", importeCent: 4000, cuentaOrigen: "hucha_revolut", cuentaDestino: "imagin", vinculadoId: id, medio: "revolut" });
  });
  it("al editar el gasto, la retirada se ajusta; si deja de ser gasto, se borra", () => {
    const db = nueva();
    const id = crearMovimiento(db, datos({ cubrirConHucha: "on" }));
    expect(editarMovimiento(db, id, datos({ importe: "55", fechaCargo: "2026-10-05" })).retirada).toBe("ajustada");
    expect(movs(db)[1]).toMatchObject({ importeCent: 5500, fechaCargo: "2026-10-05" });
    expect(editarMovimiento(db, id, datos({ medio: "revolut" })).retirada).toBe("borrada");
    expect(movs(db)).toHaveLength(1);
  });
  it("al borrar el gasto, se borra también su retirada", () => {
    const db = nueva();
    const id = crearMovimiento(db, datos({ cubrirConHucha: "on" }));
    borrarMovimiento(db, id);
    expect(movs(db)).toHaveLength(0);
  });
});

describe("recurrentes", () => {
  const nomina = (db: ReturnType<typeof nueva>) => db.select().from(t.recurrentes).where(eq(t.recurrentes.concepto, "Nómina")).get()!;

  it("en octubre aparecen todos los de la semilla menos los intereses, ya anotados", () => {
    const db = nueva();
    const l = pendientes(db, "2026-10", "2026-10-01");
    expect(l).toHaveLength(7);
    expect(l.find((p) => p.recurrente.concepto === "Nómina")?.importeCent).toBe(133191);
    expect(l.find((p) => p.recurrente.vinculo === "traspaso_tr")?.importeCent).toBe(80000);
  });
  it("confirmar la nómina la registra con tu fecha e importe, una sola vez", () => {
    const db = nueva();
    const r = nomina(db);
    confirmarRecurrente(db, { recurrenteId: r.id, periodo: "2026-10", fecha: "2026-10-30", importeCent: 140000, notas: "con extra" });
    expect(movs(db)[0]).toMatchObject({ tipo: "ingreso", importeCent: 140000, fechaCargo: "2026-10-30", origen: "recurrente", periodo: "2026-10", notas: "con extra" });
    expect(() => confirmarRecurrente(db, { recurrenteId: r.id, periodo: "2026-10", fecha: "2026-10-31", importeCent: 1, notas: null })).toThrow(/ya está registrado/);
    expect(pendientes(db, "2026-10", "2026-10-31").some((p) => p.recurrente.id === r.id)).toBe(false);
  });
  it("una segunda nómina en el mismo mes se apunta como entrada normal", () => {
    const db = nueva();
    confirmarRecurrente(db, { recurrenteId: nomina(db).id, periodo: "2026-10", fecha: "2026-10-01", importeCent: 133191, notas: null });
    crearMovimiento(db, datos({ clase: "entrada", concepto: "Nómina (atrasos)", importe: "200", grupoId: "", notas: "segunda nómina" }));
    expect(movs(db).filter((m) => m.tipo === "ingreso")).toHaveLength(2);
  });
  it("los intereses y el valor de Inversión TR van a sus tablas", () => {
    const db = nueva();
    const valor = db.select().from(t.recurrentes).where(eq(t.recurrentes.clase, "valoracion")).get()!;
    confirmarRecurrente(db, { recurrenteId: valor.id, periodo: "2026-10", fecha: "2026-10-28", importeCent: 160000, notas: null });
    expect(db.select().from(t.valoracionesInversion).where(eq(t.valoracionesInversion.fecha, "2026-10-28")).get()?.valorCent).toBe(160000);
    const interes = db.select().from(t.recurrentes).where(eq(t.recurrentes.clase, "interes")).get()!;
    confirmarRecurrente(db, { recurrenteId: interes.id, periodo: "2026-10", fecha: "2026-10-01", importeCent: 470, notas: null });
    expect(db.select().from(t.intereses).where(eq(t.intereses.mes, "2026-10")).get()?.importeCent).toBe(470);
    expect(movs(db)).toHaveLength(0);
  });
  it("omitir lo quita solo de ese mes", () => {
    const db = nueva();
    const r = nomina(db);
    omitirRecurrente(db, r.id, "2026-10");
    expect(pendientes(db, "2026-10", "2026-10-15").some((p) => p.recurrente.id === r.id)).toBe(false);
  });
  it("cambiar el día; sin día deja de apuntarse solo", () => {
    const db = nueva();
    const r = nomina(db);
    db.update(t.recurrentes).set({ auto: true, dia: 28 }).where(eq(t.recurrentes.id, r.id)).run();
    expect(cambiarDiaRecurrente(db, r.id, null)).toMatchObject({ dia: null, auto: false });
    expect(cambiarDiaRecurrente(db, r.id, 27)?.dia).toBe(27);
  });
  it("los que se apuntan solos se registran al llegar su fecha, sin duplicarse", () => {
    const db = nueva();
    db.update(t.recurrentes).set({ auto: true }).where(eq(t.recurrentes.concepto, "Spotify")).run();
    expect(registrarAutomaticos(db, "2026-10-27")).toBe(0);
    expect(registrarAutomaticos(db, "2026-10-28")).toBe(1);
    expect(registrarAutomaticos(db, "2026-10-29")).toBe(0);
    expect(movs(db)[0]).toMatchObject({ concepto: "Spotify", importeCent: 1199, fechaCargo: "2026-10-28", origen: "recurrente" });
  });
});

describe("propuestas al registrar", () => {
  it("recuerda cómo clasificaste cada concepto la última vez, sin las retiradas enlazadas", () => {
    const db = nueva();
    crearMovimiento(db, datos({ concepto: "Mercadona", grupoId: "10" }));
    crearMovimiento(db, datos({ concepto: "MERCADONA", grupoId: "8", cubrirConHucha: "on" }));
    const u = ultimosPorConcepto(db);
    expect(u.find((x) => x.conceptoNorm === "mercadona")?.grupoId).toBe(8);
    expect(u.some((x) => x.conceptoNorm.startsWith("retirada"))).toBe(false);
  });
});
