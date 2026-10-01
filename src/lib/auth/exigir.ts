import "server-only";
import { cookies } from "next/headers";
import { COOKIE_SESION, verificarSesion } from "./sesion";

/** Las acciones del servidor comprueban la sesión por su cuenta, además del middleware. */
export async function exigirSesion() {
  const token = (await cookies()).get(COOKIE_SESION)?.value;
  const email = await verificarSesion(token, process.env.SESSION_SECRET ?? "", process.env.APP_EMAIL).catch(() => null);
  if (!email) throw new Error("La sesión ha caducado. Vuelve a entrar.");
  return email;
}
