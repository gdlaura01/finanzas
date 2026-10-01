import { Avisos } from "@/components/app/avisos";
import { Marco } from "@/components/app/marco";
import { Registro } from "@/components/registro/registro";
import type { DatosRegistro } from "@/components/registro/tipos";
import { db } from "@/db";
import * as m from "@/db/movimientos";
import * as t from "@/db/schema";
import { hoy } from "@/lib/formato";

// Todo sale de la base de datos local en cada visita.
export const dynamic = "force-dynamic";

export default function LayoutApp({ children }: { children: React.ReactNode }) {
  const base = db();
  const hoyISO = hoy();
  m.registrarAutomaticos(base, hoyISO);

  const datos: DatosRegistro = {
    hoy: hoyISO,
    grupos: m.todosLosGrupos(base).map(({ id, nombre, color, activo }) => ({ id, nombre, color, activo })),
    atajos: m.atajosPorUso(base),
    eventos: base.select().from(t.eventos).all(),
    recientes: m.recientes(base),
    ultimos: m.ultimosPorConcepto(base),
    reglas: base.select().from(t.reglasImportacion).all(),
    etiquetas: m.etiquetasUsadas(base),
  };

  return (
    <Avisos>
      <Registro datos={datos}>
        <Marco porRevisar={m.porRevisar(base)}>{children}</Marco>
      </Registro>
    </Avisos>
  );
}
