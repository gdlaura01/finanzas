import { describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { sql } from "drizzle-orm";
import { abrirBaseDatos } from ".";
import { crearMovimiento } from "./movimientos";
import { datosPanel } from "./panel";
import { sembrar } from "./semilla";
import { vaciarDatos } from "./vaciar";
import * as t from "./schema";
import { saldos } from "@/lib/panel";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const n = (db: ReturnType<typeof abrirBaseDatos>, tabla: any): number => db.select({ n: sql<number>`count(*)` }).from(tabla).get()!.n;

describe("vaciar datos", () => {
  it("borra movimientos, importaciones, saldos, intereses y valores; conserva la configuración; todo a cero", () => {
    const db = abrirBaseDatos(":memory:");
    migrate(db, { migrationsFolder: "./drizzle" });
    sembrar(db);
    const base = { fechaCompra: "2026-10-01", fechaCargo: "2026-10-01", tipo: "gasto" as const, medio: "imagin" as const, etiqueta: null, notas: null, cuentaOrigen: null, cuentaDestino: null };
    // Un gasto cubierto con la hucha (crea además la retirada enlazada)
    crearMovimiento(db, { ...base, concepto: "Zapatillas", importeCent: 6000, grupoId: 7, cubrirConHucha: true });
    crearMovimiento(db, { ...base, concepto: "Nómina", tipo: "ingreso", importeCent: 133191, grupoId: null, cuentaDestino: "imagin", cubrirConHucha: false });
    const config = [t.grupos, t.eventos, t.recurrentes, t.atajos, t.reglasImportacion, t.parametros].map((x) => n(db, x));
    expect(n(db, t.movimientos)).toBe(3);

    const r = vaciarDatos(db, "2026-10-05");
    expect(r).toEqual({ movimientos: 3, partida: "2025-12-31" });
    for (const x of [t.movimientos, t.importaciones, t.intereses, t.valoracionesInversion, t.recurrentesOmitidos]) expect(n(db, x)).toBe(0);
    expect([t.grupos, t.eventos, t.recurrentes, t.atajos, t.reglasImportacion, t.parametros].map((x) => n(db, x))).toEqual(config);

    const d = datosPanel(db, "2026-10", "2026-10-05");
    expect(saldos({ cuadres: d.cuadres, movs: d.movs, intereses: d.intereses, valoraciones: d.valoraciones }, "2026-10-05")).toEqual({ imagin: 0, ahorro_tr: 0, inversion_tr: null, hucha_revolut: 0 });
  });
});
