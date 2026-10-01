import Link from "next/link";
import type { ResumenCierre } from "@/lib/avisos";
import { eur, MESES, nombreMes } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { BotonCierreVisto } from "./cierre-visto";

function Cambio({ v, subirEsMalo = false }: { v: number; subirEsMalo?: boolean }) {
  return (
    <span className={cn("num", v !== 0 && (v > 0) === subirEsMalo && "text-burdeos")}>
      {v > 0 ? "+" : ""}
      {eur(v)}
    </span>
  );
}

function Cifras({ c }: { c: ResumenCierre }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div>
        <p className="text-xs text-tinta-2">Total ahorrado (Trade Republic + hucha)</p>
        <p className="text-2xl font-bold">{eur(c.ahorrado.valor)}</p>
        <p className="text-xs text-tinta-3">
          frente al mes anterior <Cambio v={c.ahorrado.cambio} />
        </p>
      </div>
      <div>
        <p className="text-xs text-tinta-2">Gasto total</p>
        <p className="text-2xl font-bold">{eur(c.gasto.valor)}</p>
        <p className="text-xs text-tinta-3">
          frente al mes anterior <Cambio v={c.gasto.cambio} subirEsMalo />
        </p>
      </div>
      <div>
        <p className="text-xs text-tinta-2">Disponible final</p>
        <p className={cn("text-2xl font-bold", c.disponible.valor < 0 && "text-burdeos")}>{eur(c.disponible.valor)}</p>
        <p className="text-xs text-tinta-3">
          frente al mes anterior <Cambio v={c.disponible.cambio} />
        </p>
      </div>
    </div>
  );
}

/** Al empezar el mes: el cierre del anterior, breve, hasta que lo marcas como visto. */
export function AvisoCierre({ c }: { c: ResumenCierre }) {
  const nombre = MESES[Number(c.mes.slice(5)) - 1];
  return (
    <section aria-labelledby="aviso-cierre" className="rounded-xl border border-l-4 border-linea-suave border-l-oliva bg-papel p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="aviso-cierre" className="text-lg font-bold">
          {nombre.charAt(0).toUpperCase() + nombre.slice(1)} ya está cerrado
        </h2>
        <div className="flex items-center gap-1">
          <Link href={`/?mes=${c.mes}#cierre`} className="rounded-md px-3 py-1.5 text-sm font-bold text-oliva-osc hover:bg-papel-2">
            Ver el cierre completo
          </Link>
          <BotonCierreVisto mes={c.mes} />
        </div>
      </div>
      <Cifras c={c} />
      <p className="mt-4 text-sm text-tinta-2">
        {c.pasados.length ? (
          <>
            Te pasaste en{" "}
            {c.pasados.slice(0, 3).map((d, i) => (
              <span key={d.grupo}>
                {i > 0 && (i === Math.min(c.pasados.length, 3) - 1 ? " y " : ", ")}
                <b>{d.grupo}</b> (<span className="num text-burdeos">+{eur(d.diferencia)}</span>)
              </span>
            ))}
            {c.pasados.length > 3 && ` y ${c.pasados.length - 3} más`}.{" "}
          </>
        ) : (
          <>Ningún grupo se pasó de su presupuesto. </>
        )}
        {c.sobrante > 0 && (
          <>
            Entre los demás grupos sobraron <b className="num">{eur(c.sobrante)}</b>.
          </>
        )}
      </p>
    </section>
  );
}

/** Cierre completo de un mes pasado, con la tabla de desviaciones por grupo. */
export function CierreCompleto({ c }: { c: ResumenCierre }) {
  return (
    <section id="cierre" className="scroll-mt-6 rounded-xl border border-linea-suave bg-papel p-5">
      <h2 className="mb-3 text-lg font-bold">Cierre de {nombreMes(c.mes)}</h2>
      <Cifras c={c} />
      <div className="mt-4 overflow-x-auto">
        <table className="num w-full text-sm">
          <thead className="text-left text-xs text-tinta-3">
            <tr>
              <th className="py-1.5 font-semibold">Grupo</th>
              <th className="py-1.5 text-right font-semibold">Presupuesto</th>
              <th className="py-1.5 text-right font-semibold">Real</th>
              <th className="py-1.5 text-right font-semibold">Desviación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-linea-suave">
            {c.desviaciones.map((d) => (
              <tr key={d.grupo}>
                <td className="py-1.5">
                  <span className="inline-flex items-center gap-2">
                    <i className="size-2.5 rounded-sm" style={{ background: d.color }} aria-hidden />
                    {d.grupo}
                  </span>
                </td>
                <td className="py-1.5 text-right">{eur(d.presupuesto)}</td>
                <td className="py-1.5 text-right">{eur(d.real)}</td>
                <td className={cn("py-1.5 text-right", d.diferencia > 0 && "font-bold text-burdeos")}>
                  {d.diferencia > 0 ? "+" : ""}
                  {eur(d.diferencia)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
