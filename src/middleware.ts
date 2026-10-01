import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, verificarSesion } from "@/lib/auth/sesion";

/** Toda la app exige sesión, salvo la pantalla de acceso. */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const secreto = process.env.SESSION_SECRET ?? "";
  const email = await verificarSesion(req.cookies.get(COOKIE_SESION)?.value, secreto, process.env.APP_EMAIL).catch(() => null);
  const enEntrar = pathname === "/entrar";

  if (!email && !enEntrar) {
    const url = new URL("/entrar", req.url);
    if (pathname !== "/") url.searchParams.set("desde", pathname + search);
    return NextResponse.redirect(url);
  }
  if (email && enEntrar) return NextResponse.redirect(new URL("/", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|webmanifest)$).*)"],
};
