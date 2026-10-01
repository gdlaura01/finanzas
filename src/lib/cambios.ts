import "server-only";
import { revalidatePath } from "next/cache";
import { marcarCambio } from "@/lib/drive/servidor";

/** Tras guardar en local: refresca las pantallas y programa la copia en Drive. */
export function trasCambio() {
  revalidatePath("/", "layout");
  marcarCambio();
}
