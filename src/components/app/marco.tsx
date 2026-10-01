"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, LayoutGrid, ListChecks, LogOut, Menu as Lista, Euro, Settings, TrendingUp } from "lucide-react";
import { salir } from "@/app/entrar/acciones";
import type { EstadoDrive } from "@/lib/drive/servidor";
import { cn } from "@/lib/utils";
import { EstadoDriveIndicador } from "./estado-drive";

type Seccion = { ruta: string; nombre: string; corto: string; icono: React.ElementType; lista?: boolean };

// Las secciones sin pantalla todavía aparecen apagadas hasta su fase.
const SECCIONES: Seccion[] = [
  { ruta: "/", nombre: "Panel", corto: "Panel", icono: LayoutGrid, lista: true },
  { ruta: "/movimientos", nombre: "Movimientos", corto: "Movs.", icono: Lista, lista: true },
  { ruta: "/presupuesto", nombre: "Presupuesto", corto: "Presup.", icono: Euro, lista: true },
  { ruta: "/calendario", nombre: "Calendario anual", corto: "Calend.", icono: CalendarDays, lista: true },
  { ruta: "/cuentas", nombre: "Cuentas y ahorro", corto: "Cuentas", icono: TrendingUp, lista: true },
  { ruta: "/revisar", nombre: "Revisar carga inicial", corto: "Revisar", icono: ListChecks, lista: true },
  { ruta: "/ajustes", nombre: "Ajustes", corto: "Ajustes", icono: Settings, lista: true },
];

export function Marco({ porRevisar, drive, children }: { porRevisar: number; drive: EstadoDrive; children: React.ReactNode }) {
  const ruta = usePathname();
  const activa = (s: Seccion) => (s.ruta === "/" ? ruta === "/" : ruta.startsWith(s.ruta));
  const insignia = (s: Seccion) =>
    s.ruta === "/revisar" && porRevisar > 0 ? (
      <span className="num rounded-full bg-terracota px-1.5 text-[11px] font-bold leading-[18px] text-white">{porRevisar}</span>
    ) : null;

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col bg-oliva px-4 py-7 text-[#f3ead9] md:flex">
        <div className="px-3">
          <p className="font-titulo text-xl font-bold">Finanzas</p>
          <p className="text-xs text-[#d8dccb]">Tus cuentas, en tu ordenador</p>
        </div>
        <nav aria-label="Secciones" className="mt-7 flex flex-col gap-1">
          {SECCIONES.map((s, i) => {
            const Icono = s.icono;
            const clases = "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px]";
            const contenido = (
              <>
                <Icono className="size-[18px] shrink-0" aria-hidden />
                <span className="flex-1">{s.nombre}</span>
                {insignia(s)}
              </>
            );
            return (
              <div key={s.ruta}>
                {i === 5 && <hr className="mx-3 my-3 border-[#7d8f71]" />}
                {s.lista ? (
                  <Link href={s.ruta} aria-current={activa(s) ? "page" : undefined} className={cn(clases, activa(s) ? "bg-crema font-semibold text-oliva-osc" : "hover:bg-[#6d8162]")}>
                    {contenido}
                  </Link>
                ) : (
                  <span className={cn(clases, "cursor-default opacity-55")} title="Llega en una fase próxima">
                    {contenido}
                  </span>
                )}
              </div>
            );
          })}
        </nav>
        <div className="mt-auto px-2 pb-3">
          <EstadoDriveIndicador inicial={drive} oscuro />
        </div>
        <form action={salir} className="px-1">
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[#e3e6d8] hover:bg-[#6d8162]">
            <LogOut className="size-4" aria-hidden /> Salir
          </button>
        </form>
      </aside>

      <div className="min-w-0 pb-24">
        <div className="flex justify-end px-4 pt-3 md:hidden">
          <EstadoDriveIndicador inicial={drive} />
        </div>
        {children}
      </div>

      <nav aria-label="Secciones" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-7 bg-oliva px-1 pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5 text-[#f3ead9] md:hidden">
        {SECCIONES.map((s) => {
          const Icono = s.icono;
          const clases = "relative flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px]";
          const contenido = (
            <>
              <Icono className="size-5" aria-hidden />
              {s.corto}
              {insignia(s) && <span className="absolute -top-1 right-0">{insignia(s)}</span>}
            </>
          );
          return s.lista ? (
            <Link key={s.ruta} href={s.ruta} aria-current={activa(s) ? "page" : undefined} className={cn(clases, activa(s) && "bg-crema font-semibold text-oliva-osc")}>
              {contenido}
            </Link>
          ) : (
            <span key={s.ruta} className={cn(clases, "opacity-50")} aria-disabled>
              {contenido}
            </span>
          );
        })}
      </nav>
    </div>
  );
}

/** Cabecera de página: título a la izquierda y controles a la derecha. */
export function Cabecera({ titulo, children }: { titulo: string; children?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-4 pb-2 pt-6 sm:px-8 sm:pt-8">
      <h1 className="text-3xl font-bold">{titulo}</h1>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}
