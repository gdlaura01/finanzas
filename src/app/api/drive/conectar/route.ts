import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { exigirSesion } from "@/lib/auth/exigir";
import { COOKIE_ESTADO, leerCredenciales, urlAutorizacion } from "@/lib/drive/google";
import { esEsteOrdenador, origenDe } from "@/lib/red";

export const dynamic = "force-dynamic";

/** Lleva a Google a pedir permiso. El `state` va también en una cookie para comprobarlo a la vuelta. */
export async function GET(req: NextRequest) {
  await exigirSesion();
  // Google solo admite volver a localhost: el permiso se da desde el ordenador
  if (!esEsteOrdenador(origenDe(req.headers).hostname)) return NextResponse.redirect(new URL("/ajustes?drive=desde-el-ordenador", origenDe(req.headers)));
  const c = leerCredenciales();
  if (!c) return NextResponse.redirect(new URL("/ajustes?drive=sin-credenciales", origenDe(req.headers)));
  const estado = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(urlAutorizacion(c, new URL("/api/drive/callback", origenDe(req.headers)).toString(), estado));
  res.cookies.set(COOKIE_ESTADO, estado, { httpOnly: true, sameSite: "lax", path: "/api/drive", maxAge: 600, secure: process.env.COOKIE_SECURE === "true" });
  return res;
}
