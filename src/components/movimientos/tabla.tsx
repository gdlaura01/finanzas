"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plegable } from "@/components/app/plegable";
import { useAvisar } from "@/components/app/avisos";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { borrarMovimiento, editarMovimiento } from "@/app/(app)/acciones";
import type { Movimiento } from "@/db/movimientos";
import type { Cuenta, Medio } from "@/db/schema";
import { MEDIOS } from "@/db/schema";
import { eur, fecha, fechaCorta, importeACampo, nombreMes } from "@/lib/formato";
import { CLASES, claseDe, claseFormDe, NOMBRE_CUENTA, NOMBRE_MEDIO, sentido, type Clase, type Errores } from "@/lib/movimientos";
import { normalizar } from "@/lib/reglas";
import { cn } from "@/lib/utils";

type GrupoVista = { id: number; nombre: string; color: string; activo: boolean };
type Orden = "cargo" | "concepto" | "grupo" | "etiqueta" | "tipo" | "medio" | "importe";
type Filtros = { q: string; grupo: string; etiqueta: string; medio: string; tipo: string };
const SIN_FILTROS: Filtros = { q: "", grupo: "", etiqueta: "", medio: "", tipo: "" };

export function TablaMovimientos({
  movimientos,
  grupos,
  etiquetas,
  meses,
  mes,
  hoy,
  editarInicial,
}: {
  movimientos: Movimiento[];
  grupos: GrupoVista[];
  etiquetas: string[];
  meses: string[];
  mes: string | null;
  hoy: string;
  /** Movimiento que se abre ya en edición (desde el lápiz del panel). */
  editarInicial?: number;
}) {
  const router = useRouter();
  const [f, setF] = useState<Filtros>(SIN_FILTROS);
  const [masFiltros, setMasFiltros] = useState(false);
  const [orden, setOrden] = useState<{ k: Orden; dir: 1 | -1 }>({ k: "cargo", dir: -1 });
  const [editando, setEditando] = useState<number | null>(editarInicial ?? null);
  const [borrando, setBorrando] = useState<number | null>(null);

  const grupo = (id: number | null) => grupos.find((g) => g.id === id);
  const cubiertos = useMemo(() => new Set(movimientos.map((m) => m.vinculadoId).filter(Boolean)), [movimientos]);

  const lista = useMemo(() => {
    const q = normalizar(f.q);
    const valor: Record<Orden, (m: Movimiento) => string | number> = {
      cargo: (m) => m.fechaCargo,
      concepto: (m) => m.concepto,
      grupo: (m) => grupo(m.grupoId)?.nombre ?? "",
      etiqueta: (m) => m.etiqueta ?? "",
      tipo: (m) => CLASES[claseDe(m)],
      medio: (m) => NOMBRE_MEDIO[m.medio],
      importe: (m) => sentido(m) * Math.abs(m.importeCent),
    };
    const v = valor[orden.k];
    return movimientos
      .filter(
        (m) =>
          (!q || m.conceptoNorm.includes(q) || normalizar(m.notas ?? "").includes(q)) &&
          (!f.grupo || String(m.grupoId) === f.grupo) &&
          (!f.etiqueta || normalizar(m.etiqueta ?? "") === normalizar(f.etiqueta)) &&
          (!f.medio || m.medio === f.medio) &&
          (!f.tipo || claseDe(m) === f.tipo),
      )
      .sort((a, b) => {
        const va = v(a), vb = v(b);
        const c = typeof va === "number" ? va - (vb as number) : String(va).localeCompare(String(vb), "es");
        return c * orden.dir || b.id - a.id;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movimientos, f, orden, grupos]);

  const totales = useMemo(() => {
    const t: Partial<Record<Clase, number>> = {};
    for (const m of lista) t[claseDe(m)] = (t[claseDe(m)] ?? 0) + Math.abs(m.importeCent);
    return t;
  }, [lista]);
  const nFiltros = (["grupo", "etiqueta", "medio", "tipo", "q"] as const).filter((k) => f[k]).length;
  const gastoNeto = (totales.gasto ?? 0) - (totales.devolucion ?? 0);

  const cabecera = (k: Orden, texto: string, derecha = false) => (
    <th scope="col" aria-sort={orden.k === k ? (orden.dir > 0 ? "ascending" : "descending") : "none"} className={cn("px-3 py-2.5 font-bold", derecha && "text-right")}>
      <button
        type="button"
        className="font-bold hover:underline"
        onClick={() => setOrden((o) => (o.k === k ? { k, dir: (o.dir * -1) as 1 | -1 } : { k, dir: k === "cargo" || k === "importe" ? -1 : 1 }))}
      >
        {texto}
        {orden.k === k && (orden.dir > 0 ? " ▲" : " ▼")}
      </button>
    </th>
  );

  const resumen = (
    <>
      {lista.length} {lista.length === 1 ? "apunte" : "apuntes"}
      {gastoNeto ? ` · gasto ${eur(gastoNeto)}` : ""}
      {nFiltros > 0 && <span className="ml-2 rounded-full bg-terracota-claro px-2 py-0.5 text-xs font-bold text-[#7a3b23]">{nFiltros} filtro{nFiltros > 1 ? "s" : ""}</span>}
    </>
  );

  return (
    <Plegable id="tabla" titulo={mes ? `Movimientos de ${nombreMes(mes)}` : "Todos los movimientos"} resumen={resumen} abiertoPorDefecto>
      <div className="flex flex-wrap items-end gap-3">
        <Campo id="f-q" etiqueta="Buscar concepto" className="min-w-[200px] flex-1">
          <Input id="f-q" type="search" placeholder="bizum, gasolina…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        </Campo>
        <Campo id="f-mes" etiqueta="Mes">
          <Select id="f-mes" value={mes ?? "todos"} onChange={(e) => router.push(`/movimientos?mes=${e.target.value}`)}>
            <option value="todos">Todos</option>
            {[...new Set([...(mes ? [mes] : []), ...meses])].sort().reverse().map((m) => (
              <option key={m} value={m}>
                {nombreMes(m)}
              </option>
            ))}
          </Select>
        </Campo>
        <Button type="button" variant="outline" aria-expanded={masFiltros} onClick={() => setMasFiltros((v) => !v)}>
          Más filtros{nFiltros - (f.q ? 1 : 0) > 0 ? ` (${nFiltros - (f.q ? 1 : 0)})` : ""}
        </Button>
        {nFiltros > 0 && (
          <Button type="button" variant="ghost" onClick={() => setF(SIN_FILTROS)}>
            Quitar filtros
          </Button>
        )}
      </div>
      {masFiltros && (
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Campo id="f-grupo" etiqueta="Grupo">
            <Select id="f-grupo" value={f.grupo} onChange={(e) => setF({ ...f, grupo: e.target.value })}>
              <option value="">Todos</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nombre}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo id="f-etiqueta" etiqueta="Etiqueta">
            <Select id="f-etiqueta" value={f.etiqueta} onChange={(e) => setF({ ...f, etiqueta: e.target.value })}>
              <option value="">Todas</option>
              {etiquetas.map((e) => (
                <option key={e}>{e}</option>
              ))}
            </Select>
          </Campo>
          <Campo id="f-medio" etiqueta="Medio">
            <Select id="f-medio" value={f.medio} onChange={(e) => setF({ ...f, medio: e.target.value })}>
              <option value="">Todos</option>
              {MEDIOS.map((m) => (
                <option key={m} value={m}>
                  {NOMBRE_MEDIO[m]}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo id="f-tipo" etiqueta="Tipo">
            <Select id="f-tipo" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
              <option value="">Todos</option>
              {Object.entries(CLASES).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </Select>
          </Campo>
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-lg border border-linea-suave">
        <table className="w-full border-collapse text-sm max-md:block">
          <thead className="bg-oliva text-left text-[13px] text-[#f7efe3] max-md:hidden">
            <tr>
              {cabecera("cargo", "Cargo")}
              {cabecera("concepto", "Concepto")}
              {cabecera("grupo", "Grupo")}
              {cabecera("etiqueta", "Etiqueta")}
              {cabecera("tipo", "Tipo")}
              {cabecera("medio", "Medio")}
              {cabecera("importe", "Importe", true)}
              <th className="px-3 py-2.5">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-linea-suave bg-campo max-md:block">
            {lista.map((m) =>
              editando === m.id ? (
                <FilaEdicion key={m.id} m={m} grupos={grupos} etiquetas={etiquetas} alCerrar={() => setEditando(null)} />
              ) : (
                <FilaMovimiento
                  key={m.id}
                  m={m}
                  hoy={hoy}
                  grupo={grupo(m.grupoId)}
                  cubierto={cubiertos.has(m.id)}
                  borrando={borrando === m.id}
                  alEditar={() => {
                    setEditando(m.id);
                    setBorrando(null);
                  }}
                  alBorrar={(v) => setBorrando(v ? m.id : null)}
                />
              ),
            )}
            {!lista.length && (
              <tr className="max-md:block">
                <td colSpan={8} className="px-3 py-8 text-center text-tinta-3 max-md:block">
                  {movimientos.length ? "No hay movimientos con estos filtros." : "Aún no hay movimientos este mes. Pulsa Registrar o la tecla N."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {lista.length > 0 && (
        <p className="num mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-tinta-2">
          {(Object.entries(CLASES) as [Clase, string][])
            .filter(([k]) => totales[k])
            .map(([k, l]) => (
              <span key={k}>
                {l}: <b className="text-tinta">{eur(totales[k]!)}</b>
              </span>
            ))}
        </p>
      )}
    </Plegable>
  );
}

function FilaMovimiento({
  m,
  hoy,
  grupo,
  cubierto,
  borrando,
  alEditar,
  alBorrar,
}: {
  m: Movimiento;
  hoy: string;
  grupo?: GrupoVista;
  cubierto: boolean;
  borrando: boolean;
  alEditar: () => void;
  alBorrar: (v: boolean) => void;
}) {
  const avisar = useAvisar();
  const [enviando, iniciar] = useTransition();
  const c = claseDe(m);
  const s = sentido(m);
  const chip = (texto: string, tono: "terracota" | "oliva" | "neutro" = "neutro") => (
    <span
      className={cn(
        "ml-1.5 inline-block rounded-full px-2 py-px text-[11px] font-bold",
        tono === "terracota" ? "bg-terracota-claro text-[#7a3b23]" : tono === "oliva" ? "bg-oliva-claro text-oliva-osc" : "bg-papel-2 text-tinta-2",
      )}
    >
      {texto}
    </span>
  );
  return (
    <tr className="align-middle hover:bg-papel max-md:grid max-md:grid-cols-[minmax(0,1fr)_auto] max-md:gap-x-3 max-md:px-3 max-md:py-2.5">
      <td className="num whitespace-nowrap px-3 py-2.5 max-md:order-2 max-md:p-0 max-md:text-xs max-md:text-tinta-3">
        {fecha(m.fechaCargo)}
        {m.fechaCompra !== m.fechaCargo && <small className="block text-xs text-tinta-3">compra {fechaCorta(m.fechaCompra)}</small>}
        {m.fechaCargo > hoy && <small className="block text-xs text-tinta-3">cargo pendiente</small>}
      </td>
      <td className="px-3 py-2.5 max-md:order-1 max-md:p-0">
        <span className="font-medium">{m.concepto}</span>
        {m.pendienteRevision && chip("por revisar", "terracota")}
        {m.origen === "recurrente" && chip("recurrente")}
        {cubierto && chip("cubierto con la hucha", "oliva")}
        {m.notas && <small className="block text-xs text-tinta-3">{m.notas}</small>}
      </td>
      <td className="px-3 py-2.5 max-md:order-3 max-md:col-span-2 max-md:p-0 max-md:pt-1">
        {grupo ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-linea-suave bg-papel px-2 py-0.5 text-xs font-bold text-tinta-2">
            <i className="size-2 rounded-sm" style={{ background: grupo.color }} />
            {grupo.nombre}
          </span>
        ) : (
          <span className="text-tinta-3 max-md:hidden">—</span>
        )}
        {m.etiqueta && <span className="ml-2 text-xs text-tinta-3 md:hidden">#{m.etiqueta}</span>}
      </td>
      <td className="px-3 py-2.5 text-tinta-2 max-md:hidden">{m.etiqueta}</td>
      <td className="px-3 py-2.5 max-md:hidden">{CLASES[c]}</td>
      <td className="px-3 py-2.5 max-md:order-4 max-md:col-span-2 max-md:p-0 max-md:text-xs max-md:text-tinta-3">
        <span className="md:hidden">{CLASES[c]} · </span>
        {NOMBRE_MEDIO[m.medio]}
        {(c === "ahorro" || c === "interno" || c === "retirada") && m.cuentaDestino && (
          <small className="block text-xs text-tinta-3 max-md:inline">
            {" "}
            {c === "ahorro" ? NOMBRE_CUENTA[m.cuentaDestino] : `${NOMBRE_CUENTA[m.cuentaOrigen as Cuenta]} → ${NOMBRE_CUENTA[m.cuentaDestino]}`}
          </small>
        )}
      </td>
      <td className={cn("num whitespace-nowrap px-3 py-2.5 text-right font-semibold max-md:order-1 max-md:p-0", s > 0 && "text-oliva-osc")}>
        {s === 0 ? "⇄ " : s > 0 ? "+" : "−"}
        {eur(Math.abs(m.importeCent))}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right max-md:order-5 max-md:col-span-2 max-md:p-0 max-md:pt-1 max-md:text-left">
        {borrando ? (
          <span className="inline-flex items-center gap-1 text-sm">
            ¿Borrar{cubierto ? " también su retirada" : ""}?
            <Button
              size="sm"
              variant="ghost"
              className="text-burdeos"
              disabled={enviando}
              onClick={() =>
                iniciar(async () => {
                  const r = await borrarMovimiento(m.id);
                  avisar(r.ok ? r.mensaje : r.error ?? "No se ha podido borrar.");
                })
              }
            >
              Sí
            </Button>
            <Button size="sm" variant="ghost" onClick={() => alBorrar(false)}>
              No
            </Button>
          </span>
        ) : (
          <span className="inline-flex gap-1">
            <Button size="sm" variant="ghost" onClick={alEditar} aria-label={`Editar ${m.concepto}`}>
              Editar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => alBorrar(true)} aria-label={`Borrar ${m.concepto}`}>
              Borrar
            </Button>
          </span>
        )}
      </td>
    </tr>
  );
}

function FilaEdicion({ m, grupos, etiquetas, alCerrar }: { m: Movimiento; grupos: GrupoVista[]; etiquetas: string[]; alCerrar: () => void }) {
  const avisar = useAvisar();
  const [enviando, iniciar] = useTransition();
  const [clase, setClase] = useState<Clase>(claseDe(m));
  const [fechaCargo, setFechaCargo] = useState(m.fechaCargo);
  const [fechaCompra, setFechaCompra] = useState(m.fechaCompra);
  const [concepto, setConcepto] = useState(m.concepto);
  const [notas, setNotas] = useState(m.notas ?? "");
  const [grupoId, setGrupoId] = useState(String(m.grupoId ?? grupos.find((g) => g.nombre === "Otros")?.id ?? ""));
  const [etiqueta, setEtiqueta] = useState(m.etiqueta ?? "");
  const [medio, setMedio] = useState<Medio>(m.medio);
  const [importe, setImporte] = useState(importeACampo(Math.abs(m.importeCent)));
  const [destino, setDestino] = useState<Cuenta>(m.tipo === "ahorro" && m.cuentaDestino ? m.cuentaDestino : "ahorro_tr");
  const [errores, setErrores] = useState<Errores>({});
  const conGrupo = clase === "gasto" || clase === "devolucion";
  const clases = (Object.entries(CLASES) as [Clase, string][]).filter(([k]) => k !== "interno" || m.tipo === "interno");
  const id = (k: string) => `e${m.id}-${k}`;

  function guardar(e?: React.FormEvent) {
    e?.preventDefault();
    const cf = claseFormDe(clase);
    const f = new FormData();
    const valores: Record<string, string> = {
      clase: cf.clase,
      entradaComo: cf.entradaComo ?? "",
      fechaCompra, fechaCargo, concepto, notas, etiqueta, medio, importe,
      grupoId: conGrupo ? grupoId : "",
      cuentaDestino: clase === "ahorro" ? destino : "",
      cuentaOrigenActual: m.cuentaOrigen ?? "",
      cuentaDestinoActual: m.cuentaDestino ?? "",
    };
    for (const [k, v] of Object.entries(valores)) f.set(k, v);
    iniciar(async () => {
      const r = await editarMovimiento(m.id, f);
      if (r.ok) {
        avisar(r.mensaje);
        alCerrar();
      } else {
        setErrores(r.errores ?? {});
        if (r.error) avisar(r.error);
      }
    });
  }

  return (
    <tr className="bg-papel max-md:block">
      <td colSpan={8} className="px-3 py-4 max-md:block">
        <form
          onSubmit={guardar}
          onKeyDown={(e) => {
            if (e.key === "Escape") alCerrar();
          }}
          noValidate
          aria-label={`Editar ${m.concepto}`}
          className="grid grid-cols-2 gap-3 lg:grid-cols-6"
        >
          <Campo id={id("cargo")} etiqueta="Fecha de cargo" error={errores.fechaCargo}>
            <Input id={id("cargo")} type="date" value={fechaCargo} onChange={(e) => setFechaCargo(e.target.value)} />
          </Campo>
          <Campo id={id("compra")} etiqueta="Fecha de compra" error={errores.fechaCompra}>
            <Input id={id("compra")} type="date" value={fechaCompra} onChange={(e) => setFechaCompra(e.target.value)} />
          </Campo>
          <Campo id={id("concepto")} etiqueta="Concepto" error={errores.concepto} className="col-span-2">
            <Input id={id("concepto")} value={concepto} onChange={(e) => setConcepto(e.target.value)} autoFocus />
          </Campo>
          <Campo id={id("importe")} etiqueta="Importe" error={errores.importe}>
            <Input id={id("importe")} inputMode="decimal" className="num text-right" value={importe} onChange={(e) => setImporte(e.target.value)} />
          </Campo>
          <Campo id={id("tipo")} etiqueta="Tipo">
            <Select id={id("tipo")} value={clase} onChange={(e) => setClase(e.target.value as Clase)}>
              {clases.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo id={id("grupo")} etiqueta="Grupo" error={errores.grupoId}>
            <Select id={id("grupo")} value={conGrupo ? grupoId : ""} disabled={!conGrupo} onChange={(e) => setGrupoId(e.target.value)}>
              {!conGrupo && <option value="">—</option>}
              {grupos.filter((g) => g.activo || g.id === m.grupoId).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nombre}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo id={id("medio")} etiqueta="Medio">
            <Select id={id("medio")} value={medio} onChange={(e) => setMedio(e.target.value as Medio)}>
              {MEDIOS.map((x) => (
                <option key={x} value={x}>
                  {NOMBRE_MEDIO[x]}
                </option>
              ))}
            </Select>
          </Campo>
          {clase === "ahorro" && (
            <Campo id={id("destino")} etiqueta="Destino">
              <Select id={id("destino")} value={destino} onChange={(e) => setDestino(e.target.value as Cuenta)}>
                <option value="ahorro_tr">Ahorro TR</option>
                <option value="inversion_tr">Inversión TR</option>
              </Select>
            </Campo>
          )}
          <Campo id={id("etiqueta")} etiqueta="Etiqueta">
            <Input id={id("etiqueta")} list={id("etiquetas")} value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} placeholder="opcional" />
            <datalist id={id("etiquetas")}>
              {etiquetas.map((e) => (
                <option key={e} value={e} />
              ))}
            </datalist>
          </Campo>
          <Campo id={id("notas")} etiqueta="Notas" className="col-span-2">
            <Input id={id("notas")} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="opcional" />
          </Campo>
          <div className="col-span-2 flex items-end gap-2 lg:col-span-6">
            <Button type="submit" disabled={enviando}>
              {enviando ? "Guardando…" : "Guardar cambios"}
            </Button>
            <Button type="button" variant="ghost" onClick={alCerrar}>
              Cancelar
            </Button>
            <span className="text-xs text-tinta-3">
              Intro guarda · Esc cancela
            </span>
          </div>
        </form>
      </td>
    </tr>
  );
}
