"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { useAvisar } from "@/components/app/avisos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { clasificarConceptos, confirmarMeses, deshacer } from "@/app/(app)/importar/acciones";
import type { Antes, Clasificacion } from "@/db/importar";
import type { Medio } from "@/db/schema";
import { MEDIOS } from "@/db/schema";
import { eur, fecha, MESES, mayuscula, nombreMes } from "@/lib/formato";
import type { agruparRevision, ConceptoRevision, FilaRevision, Fuente } from "@/lib/importar/revision";
import { CLASES, claseDe, NOMBRE_MEDIO, sentido } from "@/lib/movimientos";
import { normalizar } from "@/lib/reglas";
import { cn } from "@/lib/utils";

type Grupo = { id: number; nombre: string; color: string; activo: boolean };
type Datos = ReturnType<typeof agruparRevision>;

const PESTANAS: Record<Fuente, [string, string]> = {
  aprendido: ["Ya lo clasificaste antes", "Mismo concepto que algo que ya tienes clasificado: solo confirma."],
  regla: ["Propuesta por regla", "Propuesta según tus reglas de importación. Revisa el grupo antes de aceptar."],
  nada: ["Sin pista", "Sin propuesta: elige el grupo de cada concepto."],
};

const importe = (f: Pick<FilaRevision, "tipo" | "importeCent" | "concepto">) => {
  const s = sentido({ ...f, cuentaOrigen: null, cuentaDestino: null });
  return `${s === 0 ? "⇄ " : s > 0 ? "+" : "−"}${eur(Math.abs(f.importeCent))}`;
};

export function Revision({ datos, total, pendientes, grupos, etiquetas }: { datos: Datos; total: number; pendientes: number; grupos: Grupo[]; etiquetas: string[] }) {
  const avisar = useAvisar();
  const [enviando, iniciar] = useTransition();
  const [mes, setMes] = useState("");
  const [q, setQ] = useState("");
  const [pestana, setPestana] = useState<Fuente>("aprendido");
  const [elecciones, setElecciones] = useState<Record<string, { grupoId: number; etiqueta: string }>>({});
  const [excepciones, setExcepciones] = useState<Record<number, { grupoId?: number; medio?: Medio; fechaCargo?: string }>>({});
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [fechasMes, setFechasMes] = useState<Record<string, string>>({});

  const color = (id: number) => grupos.find((g) => g.id === id)?.color ?? "#A8977F";
  const meses = useMemo(() => [...new Set([...datos.meses.map((m) => m.mes), ...datos.conceptos.flatMap((c) => c.meses)])].sort(), [datos]);
  const pasa = (f: FilaRevision) => (!mes || f.fechaCargo.startsWith(mes)) && (!q || normalizar(f.concepto).includes(normalizar(q)));

  const mesesVisibles = datos.meses.map((m) => ({ ...m, filas: m.filas.filter(pasa) })).filter((m) => m.filas.length);
  const conceptos = datos.conceptos.map((c) => ({ ...c, filas: c.filas.filter(pasa) })).filter((c) => c.filas.length);
  const porFuente = (f: Fuente) => conceptos.filter((c) => c.sugerencia.fuente === f);
  const pestanaActiva = porFuente(pestana).length ? pestana : ((["aprendido", "regla", "nada"] as Fuente[]).find((f) => porFuente(f).length) ?? pestana);
  const lista = porFuente(pestanaActiva);
  const eleccion = (c: ConceptoRevision) => elecciones[c.clave] ?? { grupoId: c.sugerencia.grupoId, etiqueta: c.sugerencia.etiqueta ?? "" };

  function conDeshacer(r: { ok: boolean; mensaje?: string; error?: string; antes?: Antes[] }) {
    if (!r.ok) return avisar(r.error ?? "No se ha podido guardar.");
    const antes = r.antes ?? [];
    avisar({
      texto: r.mensaje!,
      accion: antes.length ? { etiqueta: "Deshacer", hacer: () => iniciar(async () => avisar((await deshacer(antes)).ok ? "Deshecho" : "No se ha podido deshacer")) } : undefined,
    });
  }

  const aceptar = (cs: ConceptoRevision[]) =>
    iniciar(async () => {
      const lotes: Clasificacion[] = cs.map((c) => {
        const e = eleccion(c);
        const exc = Object.fromEntries(c.filas.filter((f) => excepciones[f.id]).map((f) => [f.id, excepciones[f.id]]));
        return { ids: c.filas.map((f) => f.id), grupoId: e.grupoId, etiqueta: e.etiqueta || null, excepciones: exc };
      });
      conDeshacer(await clasificarConceptos(lotes));
    });

  const confirmar = (ms: typeof mesesVisibles) =>
    iniciar(async () => {
      conDeshacer(await confirmarMeses(ms.map((m) => ({ mes: m.mes, fecha: fechasMes[m.mes] ?? (m.filas.find((f) => f.tipo === "ingreso") ?? m.filas[0]).fechaCargo }))));
    });

  if (!pendientes)
    return (
      <div className="mx-auto mt-8 flex max-w-lg flex-col items-center gap-3 rounded-xl border border-linea-suave bg-papel p-8 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-oliva-claro text-oliva-osc">
          <Check className="size-6" />
        </span>
        {total ? (
          <>
            <h2 className="text-xl font-bold">Carga inicial revisada</h2>
            <p className="text-sm text-tinta-3">Todos los apuntes tienen grupo. Puedes corregir cualquiera desde Movimientos.</p>
            <Button asChild>
              <Link href="/movimientos?mes=todos">Ir a Movimientos</Link>
            </Button>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold">Nada por revisar</h2>
            <p className="text-sm text-tinta-3">Todavía no has hecho la carga inicial desde tu hoja de seguimiento.</p>
            <Button asChild>
              <Link href="/importar">Ir a Importar</Link>
            </Button>
          </>
        )}
      </div>
    );

  const hechos = Math.max(total - pendientes, 0);
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4 rounded-xl border border-linea-suave bg-papel p-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-tinta-2">Carga inicial</p>
            <p className="text-2xl font-bold">{pendientes} por revisar</p>
            <p className="text-xs text-tinta-3">
              {hechos} de {total} hechos
            </p>
          </div>
          <div className="h-2.5 min-w-40 flex-1 overflow-hidden rounded-full bg-papel-2" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={hechos} aria-label="Revisados">
            <div className="h-full rounded-full bg-oliva" style={{ width: `${total ? (hechos / total) * 100 : 0}%` }} />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Mes">
            {["", ...meses].map((m) => (
              <button
                key={m || "todos"}
                type="button"
                aria-pressed={mes === m}
                onClick={() => setMes(m)}
                className={cn("rounded-full border px-3 py-1 text-sm font-bold", mes === m ? "border-oliva bg-oliva text-[#f7efe3]" : "border-linea bg-campo text-tinta-2 hover:bg-papel-2")}
              >
                {m ? mayuscula(MESES[Number(m.slice(5)) - 1]) : "Todos"}
              </button>
            ))}
          </div>
          <Input type="search" placeholder="Buscar concepto…" aria-label="Buscar concepto" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-60" />
        </div>
      </section>

      {mesesVisibles.length > 0 && (
        <section>
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
            <h2 className="text-xl font-bold">1 · Nóminas y traspasos a Trade Republic</h2>
            <p className="text-sm text-tinta-3">Un mes por fila. Pon el día en que entró la nómina: se usa también para sus traspasos.</p>
          </div>
          <div className="rounded-xl border border-linea-suave bg-papel p-4 sm:p-5">
            <ul className="divide-y divide-linea-suave">
              {mesesVisibles.map((m) => {
                const nomina = m.filas.find((f) => f.tipo === "ingreso") ?? m.filas[0];
                const supuesta = nomina.notas?.startsWith("Fecha supuesta");
                return (
                  <li key={m.mes} className="grid gap-3 py-3 md:grid-cols-[minmax(0,1fr)_11rem_auto_auto] md:items-end">
                    <div className="min-w-0">
                      <b>{mayuscula(nombreMes(m.mes))}</b>
                      <p className="flex flex-wrap gap-x-4 text-sm text-tinta-2">
                        {m.filas.map((f) => (
                          <span key={f.id}>
                            {f.concepto} <b className="num">{importe(f)}</b>
                          </span>
                        ))}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={`rv-f-${m.mes}`}>Día de la nómina</Label>
                      <Input
                        id={`rv-f-${m.mes}`}
                        type="date"
                        min={`${m.mes}-01`}
                        max={`${m.mes}-31`}
                        value={fechasMes[m.mes] ?? nomina.fechaCargo}
                        onChange={(e) => setFechasMes({ ...fechasMes, [m.mes]: e.target.value })}
                      />
                    </div>
                    {supuesta ? <span className="self-center rounded-full bg-terracota-claro px-2 py-0.5 text-xs font-bold text-[#7a3b23]">fecha supuesta</span> : <span />}
                    <Button variant="outline" disabled={enviando} onClick={() => confirmar([m])}>
                      Confirmar {MESES[Number(m.mes.slice(5)) - 1]}
                    </Button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-linea-suave pt-3">
              <span className="text-xs text-tinta-3">Si no sabes el día exacto, deja el día 1: lo importante es el mes.</span>
              {mesesVisibles.length > 1 && (
                <Button disabled={enviando} onClick={() => confirmar(mesesVisibles)}>
                  Confirmar los {mesesVisibles.length} meses
                </Button>
              )}
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
          <h2 className="text-xl font-bold">{mesesVisibles.length ? "2 · " : ""}Gastos, agrupados por concepto</h2>
          <p className="text-sm text-tinta-3">Una decisión vale para todos los apuntes con el mismo concepto.</p>
        </div>
        <div role="tablist" aria-label="Tipo de propuesta" className="flex flex-wrap gap-1 border-b border-linea">
          {(Object.keys(PESTANAS) as Fuente[]).map((f) => {
            const n = porFuente(f).reduce((a, c) => a + c.filas.length, 0);
            return (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={pestanaActiva === f}
                onClick={() => setPestana(f)}
                className={cn("-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-bold", pestanaActiva === f ? "border-oliva text-tinta" : "border-transparent text-tinta-3 hover:text-tinta")}
              >
                {PESTANAS[f][0]}
                <span className="num rounded-full bg-papel-2 px-1.5 text-xs">{n}</span>
              </button>
            );
          })}
        </div>
        <div role="tabpanel" className="mt-4 flex flex-col gap-3">
          {lista.length ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-tinta-3">{PESTANAS[pestanaActiva][1]}</span>
                <Button variant="terracota" disabled={enviando} onClick={() => aceptar(lista)}>
                  Aceptar {lista.length === 1 ? "este concepto" : `los ${lista.length} conceptos de esta lista`}
                </Button>
              </div>
              {lista.map((c) => {
                const e = eleccion(c);
                const abierto = abiertos.has(c.clave);
                return (
                  <article key={c.clave} className="rounded-xl border border-l-4 border-linea-suave bg-papel p-4" style={{ borderLeftColor: color(e.grupoId) }}>
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_11rem_10rem_auto] md:items-end">
                      <div className="min-w-0">
                        <b className="block truncate">{c.concepto}</b>
                        <span className="text-xs text-tinta-3">
                          {c.filas.length} apunte{c.filas.length > 1 ? "s" : ""} · {[...new Set(c.filas.map((f) => MESES[Number(f.fechaCargo.slice(5, 7)) - 1].slice(0, 3)))].join(", ")}
                        </span>
                      </div>
                      <b className={cn("num whitespace-nowrap md:pb-2", c.total > 0 && "text-oliva-osc")}>
                        {c.total > 0 ? "+" : "−"}
                        {eur(Math.abs(c.total))}
                      </b>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`rv-g-${c.clave}`}>Grupo</Label>
                        <Select id={`rv-g-${c.clave}`} value={e.grupoId} onChange={(ev) => setElecciones({ ...elecciones, [c.clave]: { ...e, grupoId: Number(ev.target.value) } })}>
                          {grupos.filter((g) => g.activo).map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.nombre}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`rv-e-${c.clave}`}>Etiqueta</Label>
                        <Input id={`rv-e-${c.clave}`} list="rv-etiquetas" placeholder="opcional" value={e.etiqueta} onChange={(ev) => setElecciones({ ...elecciones, [c.clave]: { ...e, etiqueta: ev.target.value } })} />
                      </div>
                      <div className="flex flex-col items-stretch gap-1">
                        <Button disabled={enviando} onClick={() => aceptar([c])}>
                          Aceptar{c.filas.length > 1 ? ` los ${c.filas.length}` : ""}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-expanded={abierto}
                          onClick={() => {
                            const n = new Set(abiertos);
                            if (abierto) n.delete(c.clave);
                            else n.add(c.clave);
                            setAbiertos(n);
                          }}
                        >
                          {abierto ? "Ocultar" : "Ver"} apuntes
                        </Button>
                      </div>
                    </div>
                    {abierto && (
                      <div className="mt-3 border-t border-linea-suave pt-3">
                        <ul className="flex flex-col gap-2">
                          {c.filas.map((f) => {
                            const x = excepciones[f.id] ?? {};
                            const cambiar = (v: typeof x) => setExcepciones({ ...excepciones, [f.id]: { ...x, ...v } });
                            return (
                              <li key={f.id} className="grid grid-cols-2 items-center gap-2 text-sm sm:grid-cols-[9.5rem_7rem_minmax(0,1fr)_8rem_10rem]">
                                <Input type="date" aria-label="Fecha de cargo" className="h-9" value={x.fechaCargo ?? f.fechaCargo} onChange={(ev) => cambiar({ fechaCargo: ev.target.value })} />
                                <b className="num text-right">{importe(f)}</b>
                                <span className="col-span-2 text-xs text-tinta-3 sm:col-span-1">
                                  {f.fechaCompra !== f.fechaCargo && `compra ${fecha(f.fechaCompra).slice(0, 5)}. `}
                                  {f.notas}
                                  {claseDe(f) === "devolucion" && ` ${CLASES.devolucion}.`}
                                </span>
                                <Select aria-label="Medio" className="h-9" value={x.medio ?? f.medio} onChange={(ev) => cambiar({ medio: ev.target.value as Medio })}>
                                  {MEDIOS.map((m) => (
                                    <option key={m} value={m}>
                                      {NOMBRE_MEDIO[m]}
                                    </option>
                                  ))}
                                </Select>
                                <Select aria-label="Grupo de este apunte" className="h-9" value={x.grupoId ?? ""} onChange={(ev) => cambiar({ grupoId: ev.target.value ? Number(ev.target.value) : undefined })}>
                                  <option value="">Como el resto</option>
                                  {grupos.filter((g) => g.activo).map((g) => (
                                    <option key={g.id} value={g.id}>
                                      {g.nombre}
                                    </option>
                                  ))}
                                </Select>
                              </li>
                            );
                          })}
                        </ul>
                        <p className="mt-2 text-xs text-tinta-3">Cambia aquí solo las excepciones: por ejemplo, una gasolina pagada en efectivo.</p>
                      </div>
                    )}
                  </article>
                );
              })}
            </>
          ) : (
            <p className="py-6 text-center text-sm text-tinta-3">Nada en esta lista{mes || q ? " con estos filtros" : ""}.</p>
          )}
        </div>
        <datalist id="rv-etiquetas">
          {etiquetas.map((e) => (
            <option key={e} value={e} />
          ))}
        </datalist>
      </section>
    </div>
  );
}
