import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Cabecera } from "@/components/app/marco";
import { Calendario } from "@/components/calendario/calendario";
import { db } from "@/db";
import { todosLosGrupos } from "@/db/movimientos";
import * as t from "@/db/schema";
import { hoy } from "@/lib/formato";
import { gastadoEnEvento } from "@/lib/panel";
import { mesesCalendario, resumenCalendario, type VistaCalendario } from "@/lib/plan";
import { cn } from "@/lib/utils";

export const metadata = { title: "Calendario anual · Finanzas" };

export default async function PaginaCalendario({ searchParams }: { searchParams: Promise<{ vista?: string; anio?: string }> }) {
  const sp = await searchParams;
  const hoyISO = hoy();
  const mesHoy = hoyISO.slice(0, 7);
  const vista: VistaCalendario = sp.vista === "anio" ? "anio" : "proximos";
  const anio = Number(sp.anio) >= 2000 && Number(sp.anio) <= 2100 ? Number(sp.anio) : Number(mesHoy.slice(0, 4));
  const base = db();
  const eventos = base.select().from(t.eventos).all();
  const movs = base.select().from(t.movimientos).all();
  const grupos = todosLosGrupos(base).map(({ id, nombre, color, activo }) => ({ id, nombre, color, activo }));

  const meses = mesesCalendario(vista, mesHoy, anio);
  const anios = [...new Set(meses.map((m) => Number(m.slice(0, 4))))];
  // Lo gastado con la etiqueta de cada evento, por año
  const gastado: Record<string, number> = {};
  for (const e of eventos) for (const a of anios) gastado[`${e.id}|${a}`] = gastadoEnEvento(movs, e.etiqueta, a);
  const resumen = resumenCalendario(eventos, meses, (e, a) => gastado[`${e.id}|${a}`] ?? 0);

  const pestana = (v: VistaCalendario, texto: string) => (
    <Link
      href={v === "anio" ? `/calendario?vista=anio&anio=${anio}` : "/calendario"}
      role="radio"
      aria-checked={vista === v}
      className={cn("rounded-md px-3.5 py-1.5 text-sm font-bold", vista === v ? "bg-oliva text-[#f7efe3]" : "text-tinta-2 hover:bg-linea-suave")}
    >
      {texto}
    </Link>
  );

  return (
    <main className="pb-12">
      <Cabecera titulo="Calendario anual">
        {vista === "anio" && (
          <nav aria-label="Año" className="flex items-center rounded-full border border-linea bg-papel">
            <Link href={`/calendario?vista=anio&anio=${anio - 1}`} className="grid size-10 place-items-center rounded-full hover:bg-papel-2" aria-label="Año anterior">
              <ChevronLeft className="size-4" />
            </Link>
            <span className="min-w-20 text-center font-titulo font-bold">{anio}</span>
            <Link href={`/calendario?vista=anio&anio=${anio + 1}`} className="grid size-10 place-items-center rounded-full hover:bg-papel-2" aria-label="Año siguiente">
              <ChevronRight className="size-4" />
            </Link>
          </nav>
        )}
        <div role="radiogroup" aria-label="Qué meses ver" className="flex gap-1 rounded-lg border border-linea-suave bg-papel-2 p-1">
          {pestana("proximos", "Próximos 12 meses")}
          {pestana("anio", "Año natural")}
        </div>
      </Cabecera>
      <div className="px-4 pt-3 sm:px-8">
        <Calendario key={`${vista}-${anio}`} vista={vista} meses={meses} mesHoy={mesHoy} anioPorDefecto={vista === "anio" ? anio : Number(mesHoy.slice(0, 4))} eventos={eventos} grupos={grupos} gastado={gastado} resumen={resumen} />
      </div>
    </main>
  );
}
