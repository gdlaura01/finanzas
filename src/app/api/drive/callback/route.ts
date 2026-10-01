import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { exigirSesion } from "@/lib/auth/exigir";
import { canjearCodigo, COOKIE_ESTADO, guardarToken, leerCredenciales } from "@/lib/drive/google";
import { origenDe } from "@/lib/red";
import { sincronizador } from "@/lib/drive/servidor";

export const dynamic = "force-dynamic";

const iguales = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Vuelta de Google: comprueba el `state`, canjea el código y guarda el permiso fuera del repositorio. */
export async function GET(req: NextRequest) {
  await exigirSesion();
  const volver = (r: string) => {
    const res = NextResponse.redirect(new URL(`/ajustes?drive=${r}`, origenDe(req.headers)));
    res.cookies.delete({ name: COOKIE_ESTADO, path: "/api/drive" });
    return res;
  };
  const p = req.nextUrl.searchParams;
  const esperado = req.cookies.get(COOKIE_ESTADO)?.value ?? "";
  if (p.get("error")) return volver("cancelado");
  if (!esperado || !iguales(esperado, p.get("state") ?? "")) return volver("estado");
  const c = leerCredenciales();
  if (!c) return volver("sin-credenciales");
  try {
    guardarToken(await canjearCodigo(c, p.get("code") ?? "", new URL("/api/drive/callback", origenDe(req.headers)).toString()));
  } catch (e) {
    console.error("Drive:", (e as Error).message);
    return volver("error");
  }
  // Primera copia en cuanto se conecta
  void sincronizador().sincronizarAhora();
  return volver("conectado");
}
