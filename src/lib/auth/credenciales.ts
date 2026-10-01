import bcrypt from "bcryptjs";
import { normalizarEmail } from "./sesion";

export type Acceso = { email: string; hash: string };

/** Lee el acceso de las variables de entorno y avisa con claridad si falta algo. */
export function accesoDesdeEntorno(env: Record<string, string | undefined> = process.env): Acceso {
  const email = env.APP_EMAIL, hash = env.APP_PASSWORD_HASH;
  if (!email || !hash) throw new Error("Faltan APP_EMAIL o APP_PASSWORD_HASH en .env.local. Ejecuta `npm run crear-acceso`.");
  if (!/^\$2[aby]\$\d{2}\$.{53}$/.test(hash))
    throw new Error("APP_PASSWORD_HASH no parece un hash bcrypt válido. Si lo escribiste a mano en .env.local, recuerda escapar cada $ como \\$.");
  return { email: normalizarEmail(email), hash };
}

/** Compara siempre el hash, aunque el correo no coincida, para no revelar cuál de los dos falla. */
export async function comprobarCredenciales(email: string, contrasena: string, acceso: Acceso) {
  const okHash = await bcrypt.compare(contrasena, acceso.hash);
  return okHash && normalizarEmail(email) === acceso.email;
}
