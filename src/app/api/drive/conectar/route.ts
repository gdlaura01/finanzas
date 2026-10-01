import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { exigirSesion } from "@/lib/auth/exigir";
import { COOKIE_ESTADO, leerCredenciales, urlAutorizacion } from "@/lib/drive/google";

export const dynamic = "force-dynamic";


/** Lleva a Google a pedir permiso. El `state` va también en una cookie para comprobarlo a la vuelta. */
export async function GET(req: NextRequest) {
  await exigirSesion();
  const c = leerCredenciales();
  if (!c) return NextResponse.redirect(new URL("/ajustes?drive=sin-credenciales", req.url));
  const estado = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(urlAutorizacion(c, new URL("/api/drive/callback", req.url).toString(), estado));
  res.cookies.set(COOKIE_ESTADO, estado, { httpOnly: true, sameSite: "lax", path: "/api/drive", maxAge: 600, secure: process.env.COOKIE_SECURE === "true" });
  return res;
}
