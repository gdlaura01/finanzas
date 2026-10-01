import type { Atajo, Evento, Grupo, Movimiento } from "@/db/movimientos";
import type { ultimosPorConcepto } from "@/db/movimientos";
import type { Regla } from "@/lib/reglas";

/** Lo que el servidor prepara para registrar movimientos desde cualquier pantalla. */
export type DatosRegistro = {
  hoy: string;
  grupos: Pick<Grupo, "id" | "nombre" | "color" | "activo">[];
  atajos: Atajo[];
  eventos: Evento[];
  recientes: Movimiento[];
  ultimos: ReturnType<typeof ultimosPorConcepto>;
  reglas: Regla[];
  etiquetas: string[];
};
