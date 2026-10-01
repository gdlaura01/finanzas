/**
 * Cierre automático de la app abierta con el icono: se apaga tras unos minutos sin que
 * ninguna pestaña (del ordenador o del móvil) dé señales. Nunca a mitad de una copia en Drive.
 */
export function crearVigilia(d: {
  ahora: () => number;
  /** Minutos sin señales antes de cerrar. */
  minutos: number;
  /** Si hay algo que no conviene cortar (una subida a Drive en curso). */
  ocupado: () => boolean;
  salir: () => void;
  /** Como mucho, cuánto más se espera a que deje de estar ocupado (minutos). */
  esperaMaxima?: number;
}) {
  let ultimo = d.ahora();
  const limite = d.minutos * 60_000;
  const tope = limite + (d.esperaMaxima ?? 10) * 60_000;
  return {
    latido: () => void (ultimo = d.ahora()),
    /** Se llama cada poco: devuelve true si ha cerrado. */
    revisar() {
      const quieto = d.ahora() - ultimo;
      if (quieto < limite) return false;
      if (quieto < tope && d.ocupado()) return false;
      d.salir();
      return true;
    },
  };
}
