import { NextResponse } from "next/server";
import { db } from "@/db";
import { datosLibro } from "@/db/libro";
import { exigirSesion } from "@/lib/auth/exigir";
import { hoy } from "@/lib/formato";
import { escribirLibro } from "@/lib/drive/libro";

export const dynamic = "force-dynamic";

/** El mismo libro que va a Drive, para descargarlo cuando quieras. */
export async function GET() {
  try {
    await exigirSesion();
  } catch {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }
  const datos = await escribirLibro(datosLibro(db(), hoy()));
  return new NextResponse(new Uint8Array(datos), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="finanzas-${hoy()}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
