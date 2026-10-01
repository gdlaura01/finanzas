/** El sincronizador de la app: uno por proceso, con la base de datos y Google de verdad. */
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { datosLibro } from "@/db/libro";
import * as t from "@/db/schema";
import { hoy } from "@/lib/formato";
import { escribirLibro } from "./libro";
import { leerCredenciales, leerToken, subirLibro, tokenAcceso } from "./google";
import { crearSincronizador, type EstadoSync } from "./sincronizador";

const NOMBRE = () => process.env.DRIVE_NOMBRE_ARCHIVO || "Finanzas (copia de la app).xlsx";

function leer(): EstadoSync {
  const base = db();
  let s = base.select().from(t.syncDrive).where(eq(t.syncDrive.id, 1)).get();
  if (!s) {
    base.insert(t.syncDrive).values({ id: 1 }).onConflictDoNothing().run();
    s = base.select().from(t.syncDrive).where(eq(t.syncDrive.id, 1)).get()!;
  }
  const { estado, pendiente, intentos, proximoIntento, ultimoError, ultimoOk, fileId } = s;
  return { estado, pendiente, intentos, proximoIntento, ultimoError, ultimoOk, fileId };
}

function credencialesSeguras() {
  try {
    return leerCredenciales();
  } catch {
    return null;
  }
}

export const driveConfigurado = () => !!credencialesSeguras() && !!leerToken();

function crear() {
  const s = crearSincronizador({
    leer,
    guardar: (c) => db().update(t.syncDrive).set(c).where(eq(t.syncDrive.id, 1)).run(),
    configurado: driveConfigurado,
    generar: async () => escribirLibro(datosLibro(db(), hoy())),
    subir: async (fileId, datos) => {
      const c = leerCredenciales()!;
      return subirLibro(await tokenAcceso(c, leerToken()!), fileId, NOMBRE(), datos);
    },
    ahora: () => Date.now(),
    programar: (fn, ms) => {
      const tm = setTimeout(fn, ms);
      tm.unref?.();
      return tm;
    },
    cancelar: (tm) => clearTimeout(tm as ReturnType<typeof setTimeout>),
  });
  // Lo que quedó pendiente la última vez (sin internet, app cerrada) se retoma al arrancar
  s.reanudar();
  return s;
}

const global_ = globalThis as unknown as { __sync?: ReturnType<typeof crear> };
export const sincronizador = () => (global_.__sync ??= crear());

/** Tras guardar algo en local: programa la copia en Drive. Nunca lanza ni espera. */
export function marcarCambio() {
  try {
    sincronizador().marcarCambio();
  } catch (e) {
    console.error("Drive: no se ha podido programar la copia", e);
  }
}

export type EstadoDrive = EstadoSync & { credenciales: boolean; conectado: boolean; nombre: string };

export function estadoDrive(): EstadoDrive {
  sincronizador();
  return { ...leer(), credenciales: !!credencialesSeguras(), conectado: !!leerToken(), nombre: NOMBRE() };
}
