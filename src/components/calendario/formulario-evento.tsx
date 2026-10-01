"use client";

import { useState, useTransition } from "react";
import { useAvisar } from "@/components/app/avisos";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { borrarEvento, guardarEvento } from "@/app/(app)/acciones-plan";
import type { Evento } from "@/db/movimientos";
import { importeACampo, MESES } from "@/lib/formato";
import { etiquetaDesdeNombre, type ErroresEvento } from "@/lib/plan";
import { cn } from "@/lib/utils";

export type GrupoCal = { id: number; nombre: string; color: string; activo: boolean };

export const COLORES_EVENTO = ["#7B2525", "#BA6A4C", "#D9977A", "#BE8A2A", "#607456", "#8C9C7C", "#46553F", "#6E5A4A", "#5E6B7A", "#8E5A6B"];

export function FormularioEvento({
  evento,
  mesInicial,
  anio,
  grupos,
  alCerrar,
}: {
  evento: Evento | null;
  mesInicial: number | null;
  anio: number;
  grupos: GrupoCal[];
  /** Recibe el mes del evento guardado, para seleccionarlo en el calendario. */
  alCerrar: (mesGuardado?: number | null) => void;
}) {
  const avisar = useAvisar();
  const [enviando, iniciar] = useTransition();
  const regalos = grupos.find((g) => g.nombre === "Regalos");
  const [nombre, setNombre] = useState(evento?.nombre ?? "");
  const [mes, setMes] = useState(String(evento ? (evento.mes ?? "") : (mesInicial ?? "")));
  const [dia, setDia] = useState(evento?.dia ? String(evento.dia) : "");
  const [grupoId, setGrupoId] = useState(String(evento?.grupoId ?? regalos?.id ?? grupos[0]?.id ?? ""));
  const [etiqueta, setEtiqueta] = useState(evento?.etiqueta ?? "");
  const [etiquetaTocada, setEtiquetaTocada] = useState(!!evento);
  const [importe, setImporte] = useState(evento ? importeACampo(evento.importePrevistoCent) : "");
  const [notas, setNotas] = useState(evento?.notas ?? "");
  const [color, setColor] = useState(evento?.color ?? "");
  const [solo, setSolo] = useState(!!evento?.anio);
  const [errores, setErrores] = useState<ErroresEvento>({});
  const [error, setError] = useState("");
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const anioSolo = evento?.anio ?? anio;
  const colorGrupo = grupos.find((g) => String(g.id) === grupoId)?.color ?? "#A8977F";

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    const f = new FormData();
    const valores: Record<string, string> = { nombre, mes, dia, grupoId, etiqueta, importe, notas, color, soloEsteAnio: solo ? "on" : "", anio: String(anioSolo) };
    for (const [k, v] of Object.entries(valores)) f.set(k, v);
    iniciar(async () => {
      const r = await guardarEvento(evento?.id ?? null, f);
      if (r.ok) {
        avisar(r.mensaje);
        alCerrar(mes ? Number(mes) : null);
      } else {
        setErrores(r.errores ?? {});
        setError(r.error ?? "");
        const primero = r.errores && Object.keys(r.errores)[0];
        if (primero) document.getElementById(`ev-${primero}`)?.focus();
      }
    });
  }

  const err = (k: keyof ErroresEvento) => (errores[k] ? { "aria-invalid": true, "aria-describedby": `ev-${k}-error` } : {});

  return (
    <Dialog open onOpenChange={(v) => !v && alCerrar()}>
      <DialogContent className="w-[min(760px,calc(100vw-1rem))]">
        <DialogHeader>
          <DialogTitle>{evento ? "Editar evento" : "Nuevo evento"}</DialogTitle>
          <DialogDescription>Su importe se suma al presupuesto de su grupo en ese mes. Al apuntar el gasto, usa su etiqueta para enlazarlo.</DialogDescription>
        </DialogHeader>
        <form onSubmit={guardar} noValidate autoComplete="off" className="overflow-y-auto px-5 pb-6 pt-2 sm:px-8">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-linea-suave bg-papel p-4 sm:grid-cols-4 sm:p-5">
            <Campo id="ev-nombre" etiqueta="Nombre" error={errores.nombre} className="col-span-2">
              <Input
                id="ev-nombre"
                autoFocus
                placeholder="Cuota de hermano de la cofradía"
                value={nombre}
                onChange={(e) => {
                  setNombre(e.target.value);
                  if (!etiquetaTocada) setEtiqueta(etiquetaDesdeNombre(e.target.value));
                }}
                {...err("nombre")}
              />
            </Campo>
            <Campo id="ev-mes" etiqueta="Mes" error={errores.mes}>
              <Select id="ev-mes" value={mes} onChange={(e) => setMes(e.target.value)} {...err("mes")}>
                <option value="">Sin asignar</option>
                {MESES.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </Select>
            </Campo>
            <Campo id="ev-dia" etiqueta="Día (opcional)" error={errores.dia}>
              <Input id="ev-dia" inputMode="numeric" placeholder="—" value={dia} onChange={(e) => setDia(e.target.value)} {...err("dia")} />
            </Campo>
            <Campo id="ev-grupoId" etiqueta="Grupo de presupuesto" error={errores.grupoId}>
              <Select id="ev-grupoId" value={grupoId} onChange={(e) => setGrupoId(e.target.value)} {...err("grupoId")}>
                {grupos.filter((g) => g.activo || String(g.id) === grupoId).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nombre}
                  </option>
                ))}
              </Select>
            </Campo>
            <Campo id="ev-etiqueta" etiqueta="Etiqueta" error={errores.etiqueta} ayuda="Ponla al apuntar el gasto y se enlaza con el evento.">
              <Input
                id="ev-etiqueta"
                placeholder="se crea sola"
                value={etiqueta}
                onChange={(e) => {
                  setEtiqueta(e.target.value);
                  setEtiquetaTocada(true);
                }}
                {...err("etiqueta")}
              />
            </Campo>
            <Campo id="ev-importe" etiqueta="Importe previsto" error={errores.importe}>
              <Input id="ev-importe" inputMode="decimal" className="num text-right" placeholder="0,00" value={importe} onChange={(e) => setImporte(e.target.value)} {...err("importe")} />
            </Campo>
            <Campo id="ev-notas" etiqueta="Notas">
              <Input id="ev-notas" placeholder="opcional" value={notas} onChange={(e) => setNotas(e.target.value)} />
            </Campo>
            <label className="col-span-2 flex items-center gap-2 text-sm sm:col-span-4">
              <input type="checkbox" className="size-4 accent-oliva" checked={solo} onChange={(e) => setSolo(e.target.checked)} />
              <b>Solo en {anioSolo}</b>
              <span className="text-tinta-3">· si no lo marcas, se repite cada año</span>
            </label>
            <fieldset className="col-span-2 sm:col-span-4">
              <legend className="mb-1.5 text-xs font-semibold tracking-wide text-tinta-2">Color</legend>
              <div className="flex flex-wrap items-center gap-2">
                {[{ valor: "", fondo: colorGrupo, texto: "del grupo" }, ...COLORES_EVENTO.map((c) => ({ valor: c, fondo: c, texto: "" }))].map((c) => (
                  <label key={c.valor || "grupo"} className="flex cursor-pointer items-center gap-1.5 text-xs text-tinta-3">
                    <input type="radio" name="ev-color" value={c.valor} checked={color === c.valor} onChange={() => setColor(c.valor)} className="peer sr-only" aria-label={c.texto || `Color ${c.valor}`} />
                    <span
                      className={cn("size-7 rounded-full border-2 border-papel ring-1 ring-linea peer-focus-visible:ring-2 peer-focus-visible:ring-ring", color === c.valor && "ring-2 ring-tinta")}
                      style={{ background: c.fondo }}
                    />
                    {c.texto}
                  </label>
                ))}
              </div>
            </fieldset>
            {error && (
              <p role="alert" className="col-span-2 text-sm font-medium text-burdeos sm:col-span-4">
                {error}
              </p>
            )}
            <div className="col-span-2 flex flex-wrap items-center gap-2 pt-1 sm:col-span-4">
              {evento &&
                (confirmarBorrado ? (
                  <span className="flex items-center gap-1 text-sm">
                    ¿Eliminar?
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-burdeos"
                      disabled={enviando}
                      onClick={() =>
                        iniciar(async () => {
                          const r = await borrarEvento(evento.id);
                          avisar(r.ok ? r.mensaje : (r.error ?? "No se ha podido eliminar."));
                          if (r.ok) alCerrar();
                        })
                      }
                    >
                      Sí
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmarBorrado(false)}>
                      No
                    </Button>
                  </span>
                ) : (
                  <Button type="button" variant="ghost" size="sm" className="text-burdeos" onClick={() => setConfirmarBorrado(true)}>
                    Eliminar evento
                  </Button>
                ))}
              <span className="flex-1" />
              <Button type="button" variant="outline" onClick={() => alCerrar()}>
                Cancelar
              </Button>
              <Button type="submit" disabled={enviando}>
                {evento ? "Guardar cambios" : "Añadir evento"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
