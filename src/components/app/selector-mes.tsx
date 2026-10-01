import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { mayuscula, nombreMes, sumarMeses } from "@/lib/formato";

/** ‹ Octubre 2026 › — cambia el `?mes=` de la página. */
export function SelectorMes({ ruta, mes, texto }: { ruta: string; mes: string; texto?: string }) {
  const enlace = (k: number) => `${ruta}?mes=${sumarMeses(mes, k)}`;
  return (
    <nav aria-label="Mes" className="flex items-center rounded-full border border-linea bg-papel">
      <Link href={enlace(-1)} className="grid size-10 place-items-center rounded-full hover:bg-papel-2" aria-label="Mes anterior">
        <ChevronLeft className="size-4" />
      </Link>
      <span className="min-w-36 text-center font-titulo font-bold">{texto ?? mayuscula(nombreMes(mes))}</span>
      <Link href={enlace(1)} className="grid size-10 place-items-center rounded-full hover:bg-papel-2" aria-label="Mes siguiente">
        <ChevronRight className="size-4" />
      </Link>
    </nav>
  );
}
