/**
 * Sesión en una cookie firmada (JWT HS256) y httpOnly.
 * Solo usa `jose`, así que funciona también en el middleware.
 */
import { SignJWT, jwtVerify } from "jose";

export const COOKIE_SESION = "finanzas_sesion";
export const DURACION_SESION_S = 60 * 60 * 24 * 30; // 30 días

function clave(secreto: string) {
  if (!secreto || secreto.length < 32) throw new Error("SESSION_SECRET debe tener al menos 32 caracteres. Ejecuta `npm run crear-acceso`.");
  return new TextEncoder().encode(secreto);
}

export async function firmarSesion(email: string, secreto: string, ahora = Date.now()) {
  return new SignJWT({ sub: email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(Math.floor(ahora / 1000))
    .setExpirationTime(Math.floor(ahora / 1000) + DURACION_SESION_S)
    .sign(clave(secreto));
}

/** Devuelve el correo de la sesión si la firma es válida y no ha caducado; si no, null. */
export async function verificarSesion(token: string | undefined, secreto: string, emailEsperado?: string): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, clave(secreto), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string") return null;
    if (emailEsperado && payload.sub !== normalizarEmail(emailEsperado)) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export const normalizarEmail = (e: string) => e.trim().toLowerCase();

/** Solo deja volver a rutas internas de la app tras entrar. */
export function destinoSeguro(desde: string | null | undefined) {
  if (!desde || !desde.startsWith("/") || desde.startsWith("//") || desde.startsWith("/\\") || desde.startsWith("/entrar")) return "/";
  return desde;
}

export const opcionesCookie = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  // La app corre en tu ordenador por http://localhost: solo se marca «secure» si lo pides.
  secure: process.env.COOKIE_SECURE === "true",
  path: "/",
  maxAge: DURACION_SESION_S,
});
