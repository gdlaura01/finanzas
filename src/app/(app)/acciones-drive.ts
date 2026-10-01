"use server";

import { revalidatePath } from "next/cache";
import { conSesion, type Resultado } from "@/lib/auth/exigir";
import { borrarToken, olvidarTokenAcceso } from "@/lib/drive/google";
import { estadoDrive, sincronizador } from "@/lib/drive/servidor";

export async function sincronizarDrive(): Promise<Resultado> {
  return conSesion(async () => {
    await sincronizador().sincronizarAhora();
    const e = estadoDrive();
    revalidatePath("/", "layout");
    return e.estado === "ok" ? { ok: true, mensaje: "Copia subida a Drive" } : { ok: false, error: e.ultimoError ?? "No se ha podido subir la copia." };
  });
}

export async function desconectarDrive(): Promise<Resultado> {
  return conSesion(() => {
    borrarToken();
    olvidarTokenAcceso();
    revalidatePath("/", "layout");
    return { ok: true, mensaje: "Drive desconectado. El archivo sigue en tu Drive." };
  });
}
