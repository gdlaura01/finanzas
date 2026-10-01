import { and, eq, sql } from "drizzle-orm";
import { Cabecera } from "@/components/app/marco";
import { Revision } from "@/components/importar/revision";
import { db } from "@/db";
import { pendientesDeRevisar } from "@/db/importar";
import { etiquetasUsadas, todosLosGrupos, ultimosPorConcepto } from "@/db/movimientos";
import * as t from "@/db/schema";
import { agruparRevision } from "@/lib/importar/revision";

export const metadata = { title: "Revisar carga inicial · Finanzas" };

export default function PaginaRevisar() {
  const base = db();
  const grupos = todosLosGrupos(base).map(({ id, nombre, color, activo }) => ({ id, nombre, color, activo }));
  const otros = grupos.find((g) => g.nombre === "Otros")?.id ?? grupos[0].id;
  const aprendido = new Map(ultimosPorConcepto(base).filter((u) => u.tipo === "gasto" && u.grupoId && u.importeCent > 0).map((u) => [u.conceptoNorm, { grupoId: u.grupoId!, etiqueta: u.etiqueta }]));
  const filas = pendientesDeRevisar(base).map(({ id, fechaCompra, fechaCargo, concepto, tipo, medio, importeCent, grupoId, etiqueta, notas }) => ({ id, fechaCompra, fechaCargo, concepto, tipo, medio, importeCent, grupoId, etiqueta, notas }));
  const datos = agruparRevision(filas, { aprendido, reglas: base.select().from(t.reglasImportacion).all(), grupoPorDefecto: otros });
  const total = base.select({ n: sql<number>`count(*)` }).from(t.movimientos).where(and(eq(t.movimientos.origen, "carga_inicial"))).get()!.n;

  return (
    <main className="pb-12">
      <Cabecera titulo="Revisar carga inicial" />
      <div className="px-4 pt-3 sm:px-8">
        <Revision datos={datos} total={total} pendientes={filas.length} grupos={grupos} etiquetas={etiquetasUsadas(base)} />
      </div>
    </main>
  );
}
