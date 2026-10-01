import Link from "next/link";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Cabecera } from "@/components/app/marco";
import { SelectorMes } from "@/components/app/selector-mes";
import { Pendientes, type PendienteVista } from "@/components/movimientos/pendientes";
import { TablaMovimientos } from "@/components/movimientos/tabla";
import { db } from "@/db";
import * as m from "@/db/movimientos";
import { esMes, hoy } from "@/lib/formato";
import { describirRecurrente } from "@/lib/movimientos";

export const metadata = { title: "Movimientos · Finanzas" };

export default async function Movimientos({ searchParams }: { searchParams: Promise<{ mes?: string; editar?: string }> }) {
  const { mes: param, editar } = await searchParams;
  const base = db();
  const hoyISO = hoy();
  const todos = param === "todos";
  const mes = esMes(param) ? param : hoyISO.slice(0, 7);

  const grupos = m.todosLosGrupos(base).map(({ id, nombre, color, activo }) => ({ id, nombre, color, activo }));
  const nombreGrupo = (id: number | null) => grupos.find((g) => g.id === id)?.nombre;
  const pendientes: PendienteVista[] = m.pendientes(base, mes, hoyISO).map((p) => ({ ...p, descripcion: describirRecurrente(p.recurrente, nombreGrupo(p.recurrente.grupoId)) }));


  return (
    <main>
      <Cabecera titulo="Movimientos">
        <Button asChild variant="outline">
          <Link href="/importar">
            <FileUp /> Importar extracto
          </Link>
        </Button>
        <SelectorMes ruta="/movimientos" mes={mes} texto={todos ? "Todos los meses" : undefined} />
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
          editarInicial={Number(editar) || undefined}
        />
      </div>
    </main>
  );
}
