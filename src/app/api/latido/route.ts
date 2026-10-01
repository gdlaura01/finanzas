import { NextResponse } from "next/server";
import { latido } from "@/lib/vigilia-servidor";

export const dynamic = "force-dynamic";

/** Las pestañas abiertas avisan de que siguen ahí; el icono lo usa para saber si la app ya está abierta. */
export function GET() {
  latido();
  return NextResponse.json({ app: "finanzas" });
}
export const POST = GET;
