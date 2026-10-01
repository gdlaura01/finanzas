import { NextResponse } from "next/server";
import { exigirSesion } from "@/lib/auth/exigir";
import { estadoDrive } from "@/lib/drive/servidor";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await exigirSesion();
  } catch {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }
  return NextResponse.json(estadoDrive());
}
