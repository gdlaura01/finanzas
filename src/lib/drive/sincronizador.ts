/**
 * Sincronización con Drive tolerante a fallos:
 * - agrupa los cambios: espera unos segundos tras el último antes de subir;
 * - si falla (sin internet, Drive caído), reintenta con espera creciente;
 * - nunca bloquea: guardar en local no espera a Drive.
 */
import { ErrorDrive } from "./google";

export type EstadoSync = {
  estado: "ok" | "pendiente" | "error";
  pendiente: boolean;
  intentos: number;
  proximoIntento: string | null;
  ultimoError: string | null;
  ultimoOk: string | null;
  fileId: string | null;
};

export type Dependencias = {
  leer: () => EstadoSync;
  guardar: (cambios: Partial<EstadoSync>) => void;
  /** ¿Hay credenciales y permiso de Google? Sin eso, los cambios quedan pendientes. */
  configurado: () => boolean;
  generar: () => Promise<Buffer>;
  subir: (fileId: string | null, datos: Buffer) => Promise<string>;
  ahora: () => number;
  programar: (fn: () => void, ms: number) => unknown;
  cancelar: (t: unknown) => void;
};

export type Opciones = { retardoMs?: number; esperaBaseMs?: number; esperaMaxMs?: number };

/** Espera antes del intento n (1, 2, 3…): 10 s, 20 s, 40 s… hasta 30 min. */
export const espera = (intento: number, base = 10_000, max = 30 * 60_000) => Math.min(base * 2 ** (intento - 1), max);

export function crearSincronizador(d: Dependencias, o: Opciones = {}) {
  const retardo = o.retardoMs ?? 3000;
  let temporizador: unknown = null;
  let enCurso: Promise<void> | null = null;
  let version = 0;

  function programar(ms: number) {
    if (temporizador) d.cancelar(temporizador);
    temporizador = d.programar(() => {
      temporizador = null;
      void ejecutar();
    }, ms);
  }

  async function ejecutar(): Promise<void> {
    if (enCurso) {
      // Ya hay una subida: al acabar se mira si hubo cambios mientras tanto
      await enCurso;
      return;
    }
    if (!d.configurado()) return;
    const subiendo = version;
    enCurso = (async () => {
      try {
        const datos = await d.generar();
        const id = await d.subir(d.leer().fileId, datos);
        const otraVez = version !== subiendo;
        d.guardar({ estado: otraVez ? "pendiente" : "ok", pendiente: otraVez, intentos: 0, proximoIntento: null, ultimoError: null, ultimoOk: new Date(d.ahora()).toISOString(), fileId: id });
        if (otraVez) programar(retardo);
      } catch (e) {
        const intentos = d.leer().intentos + 1;
        const permanente = e instanceof ErrorDrive && e.permanente;
        const ms = espera(intentos, o.esperaBaseMs, o.esperaMaxMs);
        d.guardar({
          estado: "error",
          pendiente: true,
          intentos,
          ultimoError: (e as Error).message || "No se ha podido subir la copia.",
          proximoIntento: permanente ? null : new Date(d.ahora() + ms).toISOString(),
        });
        if (!permanente) programar(ms);
      }
    })();
    try {
      await enCurso;
    } finally {
      enCurso = null;
    }
  }

  return {
    /** Llamar tras cada cambio guardado en local. No espera a nada. */
    marcarCambio() {
      version++;
      const s = d.leer();
      d.guardar({ pendiente: true, estado: s.estado === "error" ? "error" : "pendiente" });
      if (!d.configurado()) return;
      // Si está esperando un reintento, no se adelanta: se sube todo junto cuando toque
      const resta = s.proximoIntento ? Date.parse(s.proximoIntento) - d.ahora() : 0;
      programar(Math.max(retardo, resta));
    },
    /** Botón «Reintentar»: sube ya, aunque estuviera esperando. */
    async sincronizarAhora() {
      if (temporizador) d.cancelar(temporizador);
      temporizador = null;
      d.guardar({ proximoIntento: null });
      await ejecutar();
    },
    /** Al arrancar la app: si quedó algo pendiente (p. ej. sin internet), se retoma. */
    reanudar() {
      const s = d.leer();
      if (!s.pendiente || !d.configurado()) return;
      const resta = s.proximoIntento ? Date.parse(s.proximoIntento) - d.ahora() : 0;
      programar(Math.max(retardo, resta));
    },
  };
}
