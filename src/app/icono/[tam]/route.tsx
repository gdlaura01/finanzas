import { ImageResponse } from "next/og";

/** Icono de la app: un «€» claro sobre el verde oliva de la app. Sin archivos de imagen en el repositorio. */
function dibujarIcono(tam: number) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#607456", color: "#f8f1e6", fontSize: tam * 0.56, fontWeight: 700 }}>
        €
      </div>
    ),
    { width: tam, height: tam },
  );
}

const TAMANOS = [180, 192, 512];

export function generateStaticParams() {
  return TAMANOS.map((t) => ({ tam: String(t) }));
}
export const dynamicParams = false;

export async function GET(_: Request, { params }: { params: Promise<{ tam: string }> }) {
  return dibujarIcono(Number((await params).tam));
}
