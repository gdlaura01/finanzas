/**
 * Freno ante intentos fallidos: tras 5 fallos seguidos, bloquea 30 s;
 * cada bloqueo nuevo dura el doble (máximo 15 min). Un acierto lo reinicia.
 */
export function crearLimitador({ maxFallos = 5, bloqueoMs = 30_000, maxBloqueoMs = 15 * 60_000 } = {}) {
  let fallos = 0, bloqueos = 0, hasta = 0;
  return {
    bloqueadoHasta: (ahora = Date.now()) => (ahora < hasta ? hasta : null),
    fallo(ahora = Date.now()) {
      fallos++;
      if (fallos >= maxFallos) {
        hasta = ahora + Math.min(bloqueoMs * 2 ** bloqueos, maxBloqueoMs);
        bloqueos++;
        fallos = 0;
      }
    },
    exito() {
      fallos = 0;
      bloqueos = 0;
      hasta = 0;
    },
  };
}

// Uno por proceso: la app tiene un único usuario.
const global_ = globalThis as unknown as { __limitador?: ReturnType<typeof crearLimitador> };
export const limitador = () => (global_.__limitador ??= crearLimitador());
