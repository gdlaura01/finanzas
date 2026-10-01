import { eq, sql } from "drizzle-orm";
import { Cabecera } from "@/components/app/marco";
import { CargaInicial } from "@/components/importar/carga-inicial";
import { ImportarExtracto } from "@/components/importar/extracto";
import { db } from "@/db";
import { porRevisar, todosLosGrupos } from "@/db/movimientos";
import * as t from "@/db/schema";

export const metadata = { title: "Importar · Finanzas" };

export default function PaginaImportar() {
  const base = db();
  const apuntes = base.select({ n: sql<number>`count(*)` }).from(t.movimientos).where(eq(t.movimientos.origen, "carga_inicial")).get()!.n;
  const grupos = todosLosGrupos(base).map(({ id, nombre, activo }) => ({ id, nombre, activo }));
  return (
    <main className="pb-12">
      <Cabecera titulo="Importar" />
      <div className="flex flex-col gap-6 px-4 pt-3 sm:px-8">
        <section className="rounded-xl border border-linea-suave bg-papel p-5 sm:p-6">
          <h2 className="mb-2 text-xl font-bold">Extracto del banco</h2>
          <ImportarExtracto grupos={grupos} />
        </section>
        <section className="rounded-xl border border-linea-suave bg-papel p-5 sm:p-6">
          <h2 className="mb-2 text-xl font-bold">Carga inicial desde tu hoja de seguimiento</h2>
          <CargaInicial hecha={apuntes ? { apuntes, pendientes: porRevisar(base) } : null} />
        </section>
      </div>
    </main>
  );
}
