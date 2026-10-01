"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { accesoDesdeEntorno, comprobarCredenciales } from "@/lib/auth/credenciales";
import { limitador } from "@/lib/auth/limite";
import { COOKIE_SESION, destinoSeguro, firmarSesion, opcionesCookie } from "@/lib/auth/sesion";

export type EstadoEntrar = { error?: string; email?: string };

export async function entrar(_prev: EstadoEntrar, datos: FormData): Promise<EstadoEntrar> {
  const email = String(datos.get("email") ?? "");
  const contrasena = String(datos.get("contrasena") ?? "");
  const lim = limitador();

  const bloqueo = lim.bloqueadoHasta();
  if (bloqueo) {
    const s = Math.ceil((bloqueo - Date.now()) / 1000);
    return { email, error: `Demasiados intentos fallidos. Espera ${s} segundos y vuelve a probar.` };
  }
  if (!email || !contrasena) return { email, error: "Escribe tu correo y tu contraseña." };

  let acceso;
  try {
    acceso = accesoDesdeEntorno();
  } catch (e) {
    return { email, error: (e as Error).message };
  }

  if (!(await comprobarCredenciales(email, contrasena, acceso))) {
    lim.fallo();
    return { email, error: "El correo o la contraseña no son correctos." };
  }

  lim.exito();
  let token;
  try {
    token = await firmarSesion(acceso.email, process.env.SESSION_SECRET ?? "");
  } catch (e) {
    return { email, error: (e as Error).message };
  }
  (await cookies()).set(COOKIE_SESION, token, opcionesCookie());
  redirect(destinoSeguro(String(datos.get("desde") ?? "")));
}

export async function salir() {
  (await cookies()).delete(COOKIE_SESION);
  redirect("/entrar");
}
