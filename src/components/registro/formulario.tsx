"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useAvisar } from "@/components/app/avisos";
import { registrarMovimiento } from "@/app/(app)/acciones";
import type { Cuenta, Medio } from "@/db/schema";
import { MEDIOS } from "@/db/schema";
import { eur, fechaCorta, importeACampo, MESES, sumarDias } from "@/lib/formato";
import {
  CLASES,
  CLASES_FORM,
  claseDe,
  claseFormDe,
  clasificarEntrada,
  MEDIO_POR_CLASE,
  NOMBRE_MEDIO,
  sentido,
  type ClaseForm,
  type Errores,
} from "@/lib/movimientos";
import { eventosDelMes, normalizar, sugerir } from "@/lib/reglas";
import { cn } from "@/lib/utils";
import type { DatosRegistro } from "./tipos";

type Tocado = "grupoId" | "etiqueta" | "medio";

export function FormularioRegistro({ datos, fechaInicial }: { datos: DatosRegistro; fechaInicial?: string }) {
  const avisar = useAvisar();
  const [enviando, iniciar] = useTransition();
  const grupoPorDefecto = String(datos.grupos.find((g) => g.nombre === "Otros")?.id ?? datos.grupos[0]?.id ?? "");

  const [clase, setClaseRaw] = useState<ClaseForm>("gasto");
  const [entradaComo, setEntradaComo] = useState<"ingreso" | "devolucion" | null>(null);
  const [fechaCompra, setFechaCompra] = useState(fechaInicial ?? datos.hoy);
  const [fechaCargo, setFechaCargo] = useState(fechaInicial ?? datos.hoy);
  const [cargoTocado, setCargoTocado] = useState(false);
  const [concepto, setConcepto] = useState("");
  const [importe, setImporte] = useState("");
  const [grupoId, setGrupoId] = useState(grupoPorDefecto);
  const [medio, setMedio] = useState<Medio>("imagin");
  const [etiqueta, setEtiqueta] = useState("");
  const [notas, setNotas] = useState("");
  const [cuentaDestino, setCuentaDestino] = useState<Cuenta>("ahorro_tr");
  const [cubrir, setCubrir] = useState(false);
  const [atajoId, setAtajoId] = useState<number | null>(null);
  const [tocados, setTocados] = useState<Set<Tocado>>(new Set());
  const [pista, setPista] = useState("");
  const [errores, setErrores] = useState<Errores>({});
  const [verTodos, setVerTodos] = useState(false);

  const refConcepto = useRef<HTMLInputElement>(null);
  const refImporte = useRef<HTMLInputElement>(null);
  const tocar = (k: Tocado) => setTocados((t) => new Set(t).add(k));

  const como = entradaComo ?? clasificarEntrada(concepto);
  const conGrupo = clase === "gasto" || (clase === "entrada" && como === "devolucion");
  const nombreGrupo = datos.grupos.find((g) => String(g.id) === grupoId)?.nombre ?? "su grupo";

  function setClase(c: ClaseForm, { cambiarMedio = true } = {}) {
    setClaseRaw(c);
    setEntradaComo(null);
    if (cambiarMedio && !tocados.has("medio")) setMedio(MEDIO_POR_CLASE[c]);
    if (c === "retirada" && !concepto) setConcepto("Retirada de la hucha");
    setErrores({});
  }

  function cambiarCompra(v: string) {
    setFechaCompra(v);
    if (!cargoTocado) setFechaCargo(v);
  }

  /** Al escribir un concepto conocido, propone lo de la última vez; si no, lo que digan tus reglas. Solo rellena lo que no hayas tocado. */
  function proponer(texto: string) {
    const k = normalizar(texto);
    if (!k) return setPista("");
    const prev = datos.ultimos.find((u) => u.conceptoNorm === k);
    if (prev) {
      const cf = claseFormDe(claseDe(prev));
      if (cf.clase !== "interno" && clase === "gasto" && cf.clase !== "gasto") {
        setClaseRaw(cf.clase);
        setEntradaComo(cf.entradaComo ?? null);
      } else if (cf.clase === "entrada" && clase === "entrada") setEntradaComo(cf.entradaComo ?? null);
      if (prev.grupoId && !tocados.has("grupoId")) setGrupoId(String(prev.grupoId));
      if (!tocados.has("etiqueta")) setEtiqueta(prev.etiqueta ?? "");
      if (!tocados.has("medio")) setMedio(prev.medio);
      if (prev.tipo === "ahorro" && prev.cuentaDestino) setCuentaDestino(prev.cuentaDestino);
      return setPista("Propuesta rellenada como la última vez. Cámbiala si no encaja.");
    }
    const r = sugerir(texto, new Map(), datos.reglas);
    if (r) {
      if (!tocados.has("grupoId")) setGrupoId(String(r.grupoId));
      if (r.etiqueta && !tocados.has("etiqueta")) setEtiqueta(r.etiqueta);
      return setPista("Propuesta rellenada por tus reglas. Cámbiala si no encaja.");
    }
    setPista("");
  }

  function aplicarAtajo(a: DatosRegistro["atajos"][number]) {
    setClase(a.clase as ClaseForm, { cambiarMedio: false });
    setConcepto(a.concepto);
    setMedio(a.medio);
    if (a.grupoId) setGrupoId(String(a.grupoId));
    setEtiqueta(a.etiqueta ?? "");
    setImporte(importeACampo(a.importeCent));
    setEntradaComo(a.clase === "entrada" ? (a.entradaComo ?? null) : null);
    setAtajoId(a.id);
    setTocados(new Set(["grupoId", "etiqueta", "medio"]));
    setPista(a.importeCent == null ? "Atajo aplicado. Escribe el importe y pulsa Intro." : "Atajo aplicado. Revisa las fechas y pulsa Intro para guardar.");
    requestAnimationFrame(() => {
      refImporte.current?.focus();
      refImporte.current?.select();
    });
  }

  function reiniciar() {
    setClaseRaw("gasto");
    setEntradaComo(null);
    setFechaCargo(fechaCompra);
    setCargoTocado(false);
    setConcepto("");
    setImporte("");
    setGrupoId(grupoPorDefecto);
    setMedio("imagin");
    setEtiqueta("");
    setNotas("");
    setCuentaDestino("ahorro_tr");
    setCubrir(false);
    setAtajoId(null);
    setTocados(new Set());
    setErrores({});
    setPista("");
    refConcepto.current?.focus();
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    const f = new FormData();
    const valores: Record<string, string> = {
      clase, fechaCompra, fechaCargo, concepto, importe, medio, etiqueta, notas,
      grupoId: conGrupo ? grupoId : "",
      entradaComo: clase === "entrada" ? como : "",
      cuentaDestino: clase === "ahorro" ? cuentaDestino : "",
      cubrirConHucha: clase === "gasto" && cubrir ? "on" : "",
      atajoId: atajoId ? String(atajoId) : "",
    };
    for (const [k, v] of Object.entries(valores)) f.set(k, v);
    iniciar(async () => {
      const r = await registrarMovimiento(f);
      if (r.ok) {
        avisar(r.mensaje);
        reiniciar();
      } else {
        setErrores(r.errores ?? {});
        if (r.error) avisar(r.error);
        const primero = r.errores && Object.keys(r.errores)[0];
        if (primero) document.getElementById(`r-${primero}`)?.focus();
      }
    });
  }

  // Si el grupo tiene eventos en el mes del cargo, ofrece su etiqueta para enlazar el gasto real.
  const eventosSugeridos = useMemo(() => {
    if (!conGrupo || !/^\d{4}-\d{2}/.test(fechaCargo)) return [];
    return eventosDelMes(datos.eventos, fechaCargo.slice(0, 7), Number(grupoId));
  }, [conGrupo, fechaCargo, grupoId, datos.eventos]);
  const colorGrupo = (id: number) => datos.grupos.find((g) => g.id === id)?.color ?? "#A8977F";

  const atajosVisibles = verTodos ? datos.atajos : datos.atajos.slice(0, 4);
  const restoAtajos = datos.atajos.length - 4;

  useEffect(() => {
    refConcepto.current?.focus();
  }, []);

  const err = (k: keyof Errores) => (errores[k] ? { "aria-invalid": true, "aria-describedby": `r-${k}-error` } : {});

  return (
    <div className="flex flex-col gap-4">
      {datos.atajos.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Atajos">
          {atajosVisibles.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => aplicarAtajo(a)}
              className="flex min-w-[150px] flex-col items-start rounded-lg border border-[#e3b9a5] bg-terracota-claro px-3.5 py-2 text-left text-[15px] font-bold text-[#7a3b23] hover:bg-[#ecc9b6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {a.textoBoton}
              <small className="text-xs font-normal text-[#8c5a45]">
                {a.importeCent == null ? "importe variable" : eur(a.importeCent)} · {NOMBRE_MEDIO[a.medio]}
              </small>
            </button>
          ))}
          {restoAtajos > 0 && (
            <button
              type="button"
              aria-expanded={verTodos}
              onClick={() => setVerTodos((v) => !v)}
              className="rounded-lg border border-dashed border-linea px-4 py-2 text-sm font-bold text-oliva-osc hover:bg-papel-2"
            >
              {verTodos ? "Menos" : `+${restoAtajos} más`}
            </button>
          )}
        </div>
      )}

      <form onSubmit={guardar} noValidate autoComplete="off" className="flex flex-col gap-4 rounded-xl border border-linea-suave bg-papel p-4 sm:p-6">
        <div
          role="radiogroup"
          aria-label="Qué estás registrando"
          className="flex flex-wrap gap-1 self-start rounded-lg border border-linea-suave bg-papel-2 p-1"
          onKeyDown={(e) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            const ks = Object.keys(CLASES_FORM) as ClaseForm[];
            const i = (ks.indexOf(clase) + (e.key === "ArrowRight" ? 1 : -1) + ks.length) % ks.length;
            setClase(ks[i]);
            (e.currentTarget.querySelector(`[data-clase="${ks[i]}"]`) as HTMLElement | null)?.focus();
          }}
        >
          {(Object.entries(CLASES_FORM) as [ClaseForm, string][]).map(([k, l]) => (
            <button
              key={k}
              type="button"
              role="radio"
              data-clase={k}
              aria-checked={clase === k}
              tabIndex={clase === k ? 0 : -1}
              onClick={() => setClase(k)}
              className={cn(
                "rounded-md px-3.5 py-1.5 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                clase === k ? "bg-oliva text-[#f7efe3]" : "text-tinta-2 hover:bg-linea-suave",
              )}
            >
              {l}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-4">
          <Campo id="r-fechaCompra" etiqueta="Fecha de compra" error={errores.fechaCompra}>
            <Input id="r-fechaCompra" type="date" value={fechaCompra} onChange={(e) => cambiarCompra(e.target.value)} required {...err("fechaCompra")} />
          </Campo>
          <Campo
            id="r-fechaCargo"
            etiqueta="Fecha de cargo"
            error={errores.fechaCargo}
            ayuda={
              <span className="flex flex-wrap gap-1" aria-label="Atajos de fecha de cargo">
                {[0, 1, 2, 3].map((d) => (
                  <button
                    key={d}
                    type="button"
                    className="rounded border border-linea bg-campo px-1.5 font-bold text-oliva-osc hover:bg-oliva-claro"
                    onClick={() => {
                      setFechaCargo(sumarDias(fechaCompra, d));
                      setCargoTocado(true);
                      refImporte.current?.focus();
                    }}
                  >
                    {d === 0 ? "mismo día" : `+${d}`}
                  </button>
                ))}
              </span>
            }
          >
            <Input
              id="r-fechaCargo"
              type="date"
              title="La fecha de cargo decide en qué mes cuenta"
              value={fechaCargo}
              onChange={(e) => {
                setFechaCargo(e.target.value);
                setCargoTocado(true);
              }}
              required
              {...err("fechaCargo")}
            />
          </Campo>
          <Campo id="r-concepto" etiqueta="Concepto" error={errores.concepto} className="col-span-2">
            <Input
              id="r-concepto"
              ref={refConcepto}
              list="r-conceptos"
              placeholder="Mercadona, gasolina, bizum…"
              value={concepto}
              onChange={(e) => {
                setConcepto(e.target.value);
                setAtajoId(null);
              }}
              onBlur={(e) => proponer(e.target.value)}
              required
              {...err("concepto")}
            />
            <datalist id="r-conceptos">
              {datos.ultimos.map((u) => (
                <option key={u.conceptoNorm} value={u.concepto} />
              ))}
            </datalist>
          </Campo>

          <Campo id="r-importe" etiqueta="Importe" error={errores.importe}>
            <Input id="r-importe" ref={refImporte} inputMode="decimal" placeholder="0,00" className="num text-right" value={importe} onChange={(e) => setImporte(e.target.value)} required {...err("importe")} />
          </Campo>
          <Campo id="r-grupoId" etiqueta="Grupo" error={errores.grupoId}>
            <Select
              id="r-grupoId"
              value={conGrupo ? grupoId : ""}
              disabled={!conGrupo}
              onChange={(e) => {
                setGrupoId(e.target.value);
                tocar("grupoId");
              }}
              {...err("grupoId")}
            >
              {!conGrupo && <option value="">—</option>}
              {datos.grupos.filter((g) => g.activo).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nombre}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo id="r-medio" etiqueta="Medio" error={errores.medio}>
            <Select
              id="r-medio"
              value={medio}
              onChange={(e) => {
                setMedio(e.target.value as Medio);
                tocar("medio");
              }}
            >
              {MEDIOS.map((m) => (
                <option key={m} value={m}>
                  {NOMBRE_MEDIO[m]}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo id="r-etiqueta" etiqueta="Etiqueta">
            <Input
              id="r-etiqueta"
              list="r-etiquetas"
              placeholder="opcional"
              value={etiqueta}
              onChange={(e) => {
                setEtiqueta(e.target.value);
                tocar("etiqueta");
              }}
            />
            <datalist id="r-etiquetas">
              {datos.etiquetas.map((e) => (
                <option key={e} value={e} />
              ))}
            </datalist>
          </Campo>
          <Campo id="r-notas" etiqueta="Notas" className="col-span-2 lg:col-span-4">
            <Input id="r-notas" placeholder="opcional" value={notas} onChange={(e) => setNotas(e.target.value)} />
          </Campo>
        </div>

        {eventosSugeridos.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
            <span className="text-tinta-3">¿Es para un evento de {MESES[Number(fechaCargo.slice(5, 7)) - 1]}?</span>
            {eventosSugeridos.map((ev) => {
              const elegido = normalizar(ev.etiqueta) === normalizar(etiqueta);
              return (
                <button
                  key={ev.id}
                  type="button"
                  aria-pressed={elegido}
                  onClick={() => {
                    setEtiqueta(elegido ? "" : ev.etiqueta);
                    tocar("etiqueta");
                    refImporte.current?.focus();
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border bg-campo px-2.5 py-0.5 text-[13px]",
                    elegido ? "border-2 border-burdeos bg-burdeos-claro" : "border-linea hover:bg-papel-2",
                  )}
                >
                  <i className="size-2 rounded-full" style={{ background: ev.color ?? colorGrupo(ev.grupoId) }} />
                  {ev.nombre}
                  <b className="num">{eur(ev.importePrevistoCent, 0)}</b>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-tinta-2" aria-live="polite">
            {clase === "gasto" &&
              (medio === "revolut" ? (
                <p>Pagado desde Revolut: sale de la hucha y no resta de Imagin.</p>
              ) : (
                <label className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 size-4 accent-oliva" checked={cubrir} onChange={(e) => setCubrir(e.target.checked)} />
                  <span>
                    <b>Cubrir este gasto con dinero de la hucha</b>{" "}
                    <span className="text-tinta-3">Apunta también una retirada de la hucha a Imagin por el mismo importe, así no resta de tu nómina.</span>
                  </span>
                </label>
              ))}
            {clase === "entrada" && (
              <p>
                {como === "devolucion" ? (
                  <>
                    Se guardará como <b>devolución en {nombreGrupo}</b>: resta del gasto del grupo y no cuenta como ingreso.{" "}
                  </>
                ) : (
                  <>
                    Se guardará como <b>ingreso</b>.{" "}
                  </>
                )}
                <button type="button" className="font-bold text-oliva-osc underline-offset-2 hover:underline" onClick={() => setEntradaComo(como === "devolucion" ? "ingreso" : "devolucion")}>
                  {como === "devolucion" ? "Es un ingreso" : "Es la devolución de un gasto"}
                </button>
              </p>
            )}
            {clase === "ahorro" && (
              <label className="flex items-center gap-2">
                Destino del ahorro:
                <Select className="h-9 w-auto" value={cuentaDestino} onChange={(e) => setCuentaDestino(e.target.value as Cuenta)}>
                  <option value="ahorro_tr">Ahorro TR</option>
                  <option value="inversion_tr">Inversión TR</option>
                </Select>
              </label>
            )}
            {clase === "hucha" && (
              <p>
                Se guardará como <b>traspaso a la hucha de Revolut</b>.
              </p>
            )}
            {clase === "retirada" && (
              <p>
                Se guardará como <b>retirada de la hucha</b>: el dinero vuelve de Revolut a Imagin y suma a lo que te queda este mes.
              </p>
            )}
          </div>
          <Button type="submit" size="lg" disabled={enviando} className="sm:min-w-[220px]">
            {enviando ? "Guardando…" : "Guardar"}
          </Button>
        </div>
        {pista && <p className="text-sm text-tinta-3">{pista}</p>}
      </form>

      <section aria-labelledby="r-recientes" className="rounded-xl border border-linea-suave bg-papel p-4 sm:p-6">
        <h3 id="r-recientes" className="mb-2 text-lg font-bold">
          Lo último que has apuntado
        </h3>
        {datos.recientes.length ? (
          <ul className="divide-y divide-linea-suave">
            {datos.recientes.map((x) => {
              const s = sentido(x);
              const grupo = datos.grupos.find((g) => g.id === x.grupoId)?.nombre;
              return (
                <li key={x.id} className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 py-2 text-sm">
                  <span className="num text-tinta-3">{fechaCorta(x.fechaCargo)}</span>
                  <span className="min-w-0">
                    <span className="block truncate">{x.concepto}</span>
                    <small className="text-tinta-3">
                      {grupo ?? CLASES[claseDe(x)]} · {NOMBRE_MEDIO[x.medio]}
                    </small>
                  </span>
                  <span className={cn("num font-semibold", s > 0 && "text-oliva-osc")}>
                    {s === 0 ? "⇄ " : s > 0 ? "+" : "−"}
                    {eur(Math.abs(x.importeCent)).replace("−", "")}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="py-4 text-center text-sm text-tinta-3">Aún no has apuntado nada a mano.</p>
        )}
      </section>
    </div>
  );
}
