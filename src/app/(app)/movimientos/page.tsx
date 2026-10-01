import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Cabecera } from "@/components/app/marco";
import { Pendientes, type PendienteVista } from "@/components/movimientos/pendientes";
import { TablaMovimientos } from "@/components/movimientos/tabla";
import { db } from "@/db";
import * as m from "@/db/movimientos";
import { esMes, hoy, mayuscula, nombreMes, sumarMeses } from "@/lib/formato";
import { describirRecurrente } from "@/lib/movimientos";

export const metadata = { title: "Movimientos · Finanzas" };

export default async function Movimientos({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes: param } = await searchParams;
  const base = db();
  const hoyISO = hoy();
  const todos = param === "todos";
  const mes = esMes(param) ? param : hoyISO.slice(0, 7);

  const grupos = m.todosLosGrupos(base).map(({ id, nombre, color, activo }) => ({ id, nombre, color, activo }));
  const nombreGrupo = (id: number | null) => grupos.find((g) => g.id === id)?.nombre;
  const pendientes: PendienteVista[] = m.pendientes(base, mes, hoyISO).map((p) => ({ ...p, descripcion: describirRecurrente(p.recurrente, nombreGrupo(p.recurrente.grupoId)) }));

  const enlaceMes = (k: number) => `/movimientos?mes=${sumarMeses(mes, k)}`;

  return (
    <main>
      <Cabecera titulo="Movimientos">
        <nav aria-label="Mes" className="flex items-center rounded-full border border-linea bg-papel">
          <Link href={enlaceMes(-1)} className="grid size-10 place-items-center rounded-full hover:bg-papel-2" aria-label="Mes anterior">
            <ChevronLeft className="size-4" />
          </Link>
          <span className="min-w-36 text-center font-titulo font-bold">{todos ? "Todos los meses" : mayuscula(nombreMes(mes))}</span>
          <Link href={enlaceMes(1)} className="grid size-10 place-items-center rounded-full hover:bg-papel-2" aria-label="Mes siguiente">
            <ChevronRight className="size-4" />
          </Link>
        </nav>
      </Cabecera>
      <div className="flex flex-col gap-5 px-4 pb-10 pt-3 sm:px-8">
        {!todos && <Pendientes key={mes} lista={pendientes} mes={mes} hoy={hoyISO} />}
        <TablaMovimientos
          key={todos ? "todos" : mes}
          movimientos={m.listarMovimientos(base, todos ? null : mes)}
          grupos={grupos}
          etiquetas={m.etiquetasUsadas(base)}
          meses={m.mesesConMovimientos(base)}
          mes={todos ? null : mes}
          hoy={hoyISO}
        />
      </div>
    </main>
  );
}
