"use client";

import { Fragment, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Evento } from "@/db/movimientos";
import { eur, MESES } from "@/lib/formato";
import { eventosDeMes, type VistaCalendario } from "@/lib/plan";
import { cn } from "@/lib/utils";
import { FormularioEvento, type GrupoCal } from "./formulario-evento";

const BREAKPOINTS: [string, number][] = [
  ["(min-width: 1280px)", 4],
  ["(min-width: 1024px)", 3],
  ["(min-width: 640px)", 2],
];

/** Cuántos meses caben por fila: el detalle se coloca justo debajo de la fila del mes elegido. */
function useColumnas() {
  const [cols, setCols] = useState(4);
  useEffect(() => {
    const medir = () => setCols(BREAKPOINTS.find(([q]) => window.matchMedia(q).matches)?.[1] ?? 1);
    medir();
    const mqs = BREAKPOINTS.map(([q]) => window.matchMedia(q));
    mqs.forEach((m) => m.addEventListener("change", medir));
    return () => mqs.forEach((m) => m.removeEventListener("change", medir));
  }, []);
  return cols;
}

type Props = {
  vista: VistaCalendario;
  meses: string[];
  mesHoy: string;
  anioPorDefecto: number;
  eventos: Evento[];
  grupos: GrupoCal[];
  gastado: Record<string, number>;
  resumen: { previsto: number; gastado: number; apartarAlMes: number };
};

export function Calendario({ vista, meses, mesHoy, anioPorDefecto, eventos, grupos, gastado, resumen }: Props) {
  const cols = useColumnas();
  const [sel, setSel] = useState(meses.includes(mesHoy) ? mesHoy : meses[0]);
  const [modal, setModal] = useState<{ evento: Evento | null; mes: number | null; anio: number } | null>(null);
  const color = (e: Evento) => e.color ?? grupos.find((g) => g.id === e.grupoId)?.color ?? "#A8977F";
  const gastadoDe = (e: Evento, mes: string) => gastado[`${e.id}|${mes.slice(0, 4)}`] ?? 0;
  const sinMes = eventos.filter((e) => !e.mes);

  const idx = meses.indexOf(sel);
  const finFila = Math.min(Math.floor(idx / cols) * cols + cols, meses.length) - 1;
  const abrirNuevo = (mes: string | null) => setModal({ evento: null, mes: mes ? Number(mes.slice(5)) : null, anio: mes ? Number(mes.slice(0, 4)) : anioPorDefecto });
  const abrirEvento = (e: Evento, mes?: string) => setModal({ evento: e, mes: e.mes, anio: e.anio ?? (mes ? Number(mes.slice(0, 4)) : anioPorDefecto) });

  const chip = (e: Evento, boton = false) => {
    const contenido = (
      <>
        <i className="size-2 shrink-0 rounded-full" style={{ background: color(e) }} aria-hidden />
        <span className="truncate">{e.nombre}</span>
        <b className="num shrink-0">{eur(e.importePrevistoCent, 0)}</b>
      </>
    );
    const clases = "inline-flex max-w-full items-center gap-1.5 rounded-full border border-linea-suave bg-burdeos-claro/60 px-2.5 py-0.5 text-xs font-semibold text-tinta";
    return boton ? (
      <button key={e.id} type="button" className={cn(clases, "hover:bg-burdeos-claro")} onClick={() => abrirEvento(e)}>
        {contenido}
      </button>
    ) : (
      <span key={e.id} className={clases}>
        {contenido}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border border-linea-suave bg-papel p-5">
        <div>
          <p className="text-xs text-tinta-2">Previsto {vista === "anio" ? "en el año" : "en estos 12 meses"}</p>
          <p className="text-2xl font-bold">{eur(resumen.previsto)}</p>
        </div>
        <div>
          <p className="text-xs text-tinta-2">Gastado en eventos</p>
          <p className="text-2xl font-bold">{eur(resumen.gastado)}</p>
        </div>
        <div>
          <p className="text-xs text-tinta-2">Conviene apartar al mes</p>
          <p className="text-2xl font-bold">{eur(resumen.apartarAlMes)}</p>
          <p className="text-xs text-tinta-3">lo previsto entre 12</p>
        </div>
        <Button className="ml-auto" onClick={() => abrirNuevo(sel)}>
          <Plus /> Nuevo evento
        </Button>
      </section>

      {sinMes.length > 0 && (
        <section className="rounded-xl border border-dashed border-linea bg-papel/60 p-5">
          <p className="text-sm">
            <b>{sinMes.length} eventos sin mes</b>{" "}
            <span className="text-tinta-3">· {eur(sinMes.reduce((a, e) => a + e.importePrevistoCent, 0))}. Pulsa uno para asignarle mes: entrará en el presupuesto de su grupo.</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">{sinMes.map((e) => chip(e, true))}</div>
        </section>
      )}

      <section>
        <p className="mb-3 text-sm text-tinta-3">Pulsa un mes para ver sus eventos. Cada evento suma al presupuesto de su grupo ese mes.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {meses.map((mes, i) => {
            const evs = eventosDeMes(eventos, mes);
            const previsto = evs.reduce((a, e) => a + e.importePrevistoCent, 0);
            const real = evs.reduce((a, e) => a + gastadoDe(e, mes), 0);
            const n = Number(mes.slice(5));
            const conAnio = vista === "proximos" && (i === 0 || n === 1);
            return (
              <Fragment key={mes}>
                <button
                  type="button"
                  aria-expanded={mes === sel}
                  aria-controls="detalle-mes"
                  onClick={() => setSel(mes)}
                  className={cn(
                    "flex flex-col gap-2 rounded-xl sm:min-h-32 border bg-papel p-4 text-left transition-colors hover:border-linea focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    mes === sel ? "border-2 border-oliva bg-campo" : mes === mesHoy ? "border-2 border-terracota" : "border-linea-suave",
                    mes < mesHoy && mes !== sel && "opacity-70",
                  )}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <b className="font-titulo text-base capitalize">
                      {MESES[n - 1]}
                      {conAnio && <small className="num ml-1 text-xs font-normal text-tinta-3">{mes.slice(0, 4)}</small>}
                    </b>
                    {previsto > 0 && <span className="num font-bold">{eur(previsto, 0)}</span>}
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {evs.slice(0, 3).map((e) => chip(e))}
                    {evs.length > 3 && <span className="text-xs text-tinta-3">+{evs.length - 3} más</span>}
                    {!evs.length && <span className="text-sm text-tinta-3">sin eventos</span>}
                  </span>
                  {previsto > 0 && (
                    <span className="mt-auto h-1.5 w-full overflow-hidden rounded-full bg-papel-2" title={`Gastado ${eur(real)} de ${eur(previsto)}`}>
                      <span className={cn("block h-full rounded-full", real > previsto ? "bg-burdeos" : "bg-oliva")} style={{ width: `${Math.min((real / previsto) * 100, 100)}%` }} />
                    </span>
                  )}
                </button>
                {i === finFila && (
                  <Detalle
                    mes={sel}
                    eventos={eventosDeMes(eventos, sel)}
                    grupos={grupos}
                    color={color}
                    gastado={(e) => gastadoDe(e, sel)}
                    alAbrir={(e) => abrirEvento(e, sel)}
                    alNuevo={() => abrirNuevo(sel)}
                  />
                )}
              </Fragment>
            );
          })}
        </div>
      </section>

      {modal && (
        <FormularioEvento
          key={modal.evento?.id ?? "nuevo"}
          evento={modal.evento}
          mesInicial={modal.mes}
          anio={modal.anio}
          grupos={grupos}
          alCerrar={(mesGuardado) => {
            if (mesGuardado) {
              const k = meses.find((m) => Number(m.slice(5)) === mesGuardado);
              if (k) setSel(k);
            }
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

function Detalle({
  mes,
  eventos,
  grupos,
  color,
  gastado,
  alAbrir,
  alNuevo,
}: {
  mes: string;
  eventos: Evento[];
  grupos: GrupoCal[];
  color: (e: Evento) => string;
  gastado: (e: Evento) => number;
  alAbrir: (e: Evento) => void;
  alNuevo: () => void;
}) {
  const n = Number(mes.slice(5));
  const previsto = eventos.reduce((a, e) => a + e.importePrevistoCent, 0);
  const real = eventos.reduce((a, e) => a + gastado(e), 0);
  return (
    <div id="detalle-mes" className="col-span-full rounded-xl border border-linea bg-campo p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-lg font-bold capitalize">
          {MESES[n - 1]} {mes.slice(0, 4)}
        </h2>
        <span className="text-sm text-tinta-3">
          {eventos.length} evento{eventos.length === 1 ? "" : "s"} · previsto {eur(previsto)} · gastado {eur(real)}
        </span>
        <Button variant="outline" className="ml-auto" onClick={alNuevo}>
          <Plus /> Añadir evento en {MESES[n - 1]}
        </Button>
      </div>
      {eventos.length ? (
        <ul className="mt-3 flex flex-col gap-2">
          {eventos.map((e) => {
            const r = gastado(e);
            const queda = e.importePrevistoCent - r;
            const g = grupos.find((x) => x.id === e.grupoId);
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => alAbrir(e)}
                  className="grid w-full grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-lg border border-l-4 border-linea-suave bg-papel px-3 py-2.5 text-left hover:bg-papel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[2rem_minmax(0,1fr)_repeat(3,7rem)]"
                  style={{ borderLeftColor: color(e) }}
                  aria-label={`Editar ${e.nombre}`}
                >
                  <span className="num text-center text-tinta-3">{e.dia ?? "—"}</span>
                  <span className="min-w-0">
                    <b className="block truncate">{e.nombre}</b>
                    <small className="flex flex-wrap gap-1 text-xs text-tinta-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-papel-2 px-2 py-px font-semibold">
                        <i className="size-2 rounded-sm" style={{ background: g?.color }} aria-hidden />
                        {g?.nombre}
                      </span>
                      <span className="rounded-full bg-papel-2 px-2 py-px font-semibold">#{e.etiqueta}</span>
                      {e.anio && <span className="rounded-full bg-papel-2 px-2 py-px font-semibold">solo {e.anio}</span>}
                      {e.notas && <span className="text-tinta-3">· {e.notas}</span>}
                    </small>
                  </span>
                  {(
                    [
                      ["previsto", e.importePrevistoCent, false],
                      ["gastado", r, false],
                      [queda < 0 ? "te has pasado" : "queda", Math.abs(queda), queda < 0],
                    ] as const
                  ).map(([t, v, malo]) => (
                    <span key={t} className="num col-start-2 flex justify-between gap-2 text-sm sm:col-start-auto sm:flex-col sm:text-right">
                      <span className="text-xs text-tinta-3">{t}</span>
                      <b className={cn(malo && "text-burdeos")}>{eur(v)}</b>
                    </span>
                  ))}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-tinta-3">Nada previsto en {MESES[n - 1]}.</p>
      )}
    </div>
  );
}
