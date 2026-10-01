"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { Plegable } from "@/components/app/plegable";
import { useAvisar } from "@/components/app/avisos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cambiarDiaPrevisto, confirmarPendiente, omitirPendiente } from "@/app/(app)/acciones";
import { eur, fechaCorta, importeACampo, MESES } from "@/lib/formato";
import type { Pendiente } from "@/lib/movimientos";
import { cn } from "@/lib/utils";

export type PendienteVista = Pendiente & { descripcion: string };

function estado(f: string | null, hoy: string): [string, boolean] {
  if (!f) return ["sin día fijo", false];
  if (f < hoy) return [`atrasado · ${fechaCorta(f)}`, true];
  if (f === hoy) return ["toca hoy", true];
  return [`previsto el ${fechaCorta(f)}`, false];
}

export function Pendientes({ lista, mes, hoy }: { lista: PendienteVista[]; mes: string; hoy: string }) {
  const nombre = MESES[Number(mes.slice(5)) - 1];
  const tocan = lista.filter((p) => p.fechaPrevista && p.fechaPrevista <= hoy).length;
  const siguiente = lista.find((p) => p.fechaPrevista && p.fechaPrevista > hoy);
  const resumen = !lista.length ? (
    "Nada pendiente este mes"
  ) : (
    <>
      <span className={cn("num mr-1 rounded-full px-2 py-0.5 text-xs font-bold", tocan ? "bg-terracota-claro text-[#7a3b23]" : "bg-papel-2 text-tinta-2")}>{lista.length}</span>
      {[tocan ? `${tocan} ya ${tocan > 1 ? "tocan" : "toca"} o van atrasados` : "", siguiente ? `siguiente: ${siguiente.recurrente.concepto} el ${fechaCorta(siguiente.fechaPrevista!)}` : ""].filter(Boolean).join(" · ")}
    </>
  );
  return (
    <Plegable id="pendientes" titulo={`Pendientes de ${nombre}`} resumen={resumen}>
      {lista.length ? (
        <>
          <p className="mb-3 text-sm text-tinta-3">Recurrentes: se apuntan el día que tú indiques, cuando de verdad se muevan. Pulsa la fecha prevista para cambiarla en los próximos meses.</p>
          <ul className="divide-y divide-linea-suave">
            {lista.map((p) => (
              <FilaPendiente key={p.recurrente.id} p={p} mes={mes} hoy={hoy} />
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-tinta-3">Todos los recurrentes de este mes están registrados u omitidos.</p>
      )}
    </Plegable>
  );
}

function FilaPendiente({ p, mes, hoy }: { p: PendienteVista; mes: string; hoy: string }) {
  const avisar = useAvisar();
  const [enviando, iniciar] = useTransition();
  const r = p.recurrente;
  const esInteres = r.clase === "interes";
  const fechaInicial = esInteres ? `${mes}-01` : mes === hoy.slice(0, 7) ? (p.fechaPrevista && p.fechaPrevista > hoy ? p.fechaPrevista : hoy) : (p.fechaPrevista ?? `${mes}-01`);
  const [fecha, setFecha] = useState(fechaInicial);
  const [importe, setImporte] = useState(importeACampo(p.importeCent));
  const [notas, setNotas] = useState("");
  const [error, setError] = useState("");
  const [editandoDia, setEditandoDia] = useState(false);
  const [dia, setDia] = useState(r.dia ? String(r.dia) : "");
  const [texto, atrasado] = estado(p.fechaPrevista, hoy);
  const id = `p${r.id}`;

  const ejecutar = (fn: () => Promise<{ ok: boolean; mensaje?: string; error?: string; errores?: Record<string, string> }>, alAcabar?: () => void) =>
    iniciar(async () => {
      const res = await fn();
      if (res.ok) {
        setError("");
        avisar(res.mensaje!);
        alAcabar?.();
      } else setError(res.error ?? Object.values(res.errores ?? {})[0] ?? "No se ha podido guardar.");
    });

  function registrar(e: React.FormEvent) {
    e.preventDefault();
    const f = new FormData();
    f.set("recurrenteId", String(r.id));
    f.set("periodo", mes);
    f.set("fecha", fecha);
    f.set("importe", importe);
    f.set("notas", notas);
    ejecutar(() => confirmarPendiente(f));
  }

  return (
    <li className="py-3">
      <form onSubmit={registrar} className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_150px_120px_minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <b className="text-[15px]">{r.concepto}</b>
            <button
              type="button"
              onClick={() => setEditandoDia((v) => !v)}
              aria-expanded={editandoDia}
              title="Cambiar el día previsto"
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold",
                atrasado ? "bg-terracota-claro text-[#7a3b23]" : "bg-papel-2 text-tinta-2",
                esInteres && "pointer-events-none",
              )}
              disabled={esInteres}
            >
              {texto} {!esInteres && <Pencil className="size-3" aria-hidden />}
            </button>
          </div>
          <small className="text-tinta-3">{p.descripcion}</small>
          {editandoDia && (
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor={`${id}-dia`}>Día previsto cada mes</Label>
                <Input
                  id={`${id}-dia`}
                  inputMode="numeric"
                  className="h-9 w-28 text-right"
                  placeholder="sin día fijo"
                  value={dia}
                  onChange={(e) => setDia(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      ejecutar(() => cambiarDiaPrevisto(r.id, dia), () => setEditandoDia(false));
                    }
                  }}
                />
              </div>
              <Button type="button" size="sm" variant="outline" disabled={enviando} onClick={() => ejecutar(() => cambiarDiaPrevisto(r.id, dia), () => setEditandoDia(false))}>
                Guardar
              </Button>
              <span className="text-xs text-tinta-3">Vacío = sin día fijo. Se aplica desde este mes.</span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-fecha`}>{esInteres ? "Se cobra" : "Fecha"}</Label>
          {esInteres ? <span className="py-2 text-sm text-tinta-3">el día 1</span> : <Input id={`${id}-fecha`} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />}
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-importe`}>{r.clase === "valoracion" ? "Valor" : "Importe"}</Label>
          <Input id={`${id}-importe`} inputMode="decimal" className="num text-right" placeholder={p.importeCent == null ? "0,00" : eur(p.importeCent)} value={importe} onChange={(e) => setImporte(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-notas`}>Comentario</Label>
          <Input id={`${id}-notas`} placeholder="opcional" value={notas} onChange={(e) => setNotas(e.target.value)} disabled={esInteres || r.clase === "valoracion"} />
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={enviando}>
            Registrar
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={enviando} onClick={() => ejecutar(() => omitirPendiente(r.id, mes))}>
            Omitir este mes
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-burdeos lg:col-span-5">
            {error}
          </p>
        )}
      </form>
    </li>
  );
}
