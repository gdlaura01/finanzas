"use server";

import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { vaciarDatos } from "@/db/vaciar";
import { conSesion, type Resultado } from "@/lib/auth/exigir";
import { trasCambio } from "@/lib/cambios";
import { hoy } from "@/lib/formato";

// Un archivo "use server" solo exporta acciones
const CONFIRMACION_VACIAR = "VACIAR";

/** Guarda una copia de la base de datos y la deja a cero (ver vaciarDatos). */
export async function vaciarTodo(confirmacion: string): Promise<Resultado> {
  return conSesion(async () => {
    if (confirmacion.trim().toUpperCase() !== CONFIRMACION_VACIAR) return { ok: false, error: `Escribe ${CONFIRMACION_VACIAR} para confirmar.` };
    const base = db();
    // Copia antes de borrar nada, junto a la base de datos
    const carpeta = join(dirname(resolve(process.env.DB_PATH ?? "./data/finanzas.db")), "copias");
    mkdirSync(carpeta, { recursive: true });
    const sello = new Date().toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
    const copia = join(carpeta, `antes-de-vaciar-${sello}.db`);
    // Copia coherente de la base abierta (incluye lo que aún esté en el WAL)
    base.run(sql.raw(`VACUUM INTO '${copia.replace(/'/g, "''")}'`));
    const r = vaciarDatos(base, hoy());
    trasCambio();
    return { ok: true, mensaje: `Datos vaciados (${r.movimientos} movimientos). Copia guardada en ${copia}` };
  });
}
