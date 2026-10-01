"use client";

import { useRef, useState, useTransition } from "react";
import { FileUp } from "lucide-react";
import { useAvisar } from "@/components/app/avisos";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { crearReglaImportacion, guardarLineas, leerExtracto, proponerExtracto, type ExtractoLeido } from "@/app/(app)/importar/acciones";
import { eur, fecha, fechaCorta } from "@/lib/formato";
import { patronSugerido, type Mapeo, type Propuesta } from "@/lib/importar/extracto";
import { cn } from "@/lib/utils";

type Grupo = { id: number; nombre: string; activo: boolean };

// Lo que eliges en cada línea: el tipo del formulario, con entrada partida en ingreso o devolución
const TIPOS = {
  gasto: { texto: "Gasto", clase: "gasto", como: null },
  ingreso: { texto: "Ingreso", clase: "entrada", como: "ingreso" },
  devolucion: { texto: "Devolución", clase: "entrada", como: "devolucion" },
  ahorro: { texto: "Ahorro", clase: "ahorro", como: null },
  hucha: { texto: "A la hucha", clase: "hucha", como: null },
  retirada: { texto: "Sacado de la hucha", clase: "retirada", como: null },
} as const;
type TipoLinea = keyof typeof TIPOS;
const tipoDe = (p: Propuesta): TipoLinea => (p.clase === "entrada" ? (p.entradaComo === "ingreso" ? "ingreso" : "devolucion") : p.clase);
const conGrupo = (t: TipoLinea) => t === "gasto" || t === "devolucion";

type Correccion = { clave: string; concepto: string; patron: string; grupoId: number; etiqueta: string };

export function ImportarExtracto({ grupos }: { grupos: Grupo[] }) {
  const avisar = useAvisar();
  const [enviando, iniciar] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const [extracto, setExtracto] = useState<ExtractoLeido | null>(null);
  const [mapeo, setMapeo] = useState<Mapeo | null>(null);
  const [propuestas, setPropuestas] = useState<Propuesta[] | null>(null);
  const [originales, setOriginales] = useState<Propuesta[]>([]);
  const [errores, setErrores] = useState<{ fila: number; motivo: string }[]>([]);
  const [nombreMapeo, setNombreMapeo] = useState("Imagin");
  const [error, setError] = useState("");
  const [correcciones, setCorrecciones] = useState<Correccion[]>([]);
  const otros = grupos.find((g) => g.nombre === "Otros")?.id ?? grupos[0]?.id;

  function reiniciar() {
    setExtracto(null);
    setMapeo(null);
    setPropuestas(null);
    setErrores([]);
    setError("");
    if (input.current) input.current.value = "";
  }

  const elegir = (archivo: File) =>
    iniciar(async () => {
      reiniciar();
      setCorrecciones([]);
      const f = new FormData();
      f.set("archivo", archivo);
      const r = await leerExtracto(f);
      if (!r.ok) return setError(r.error);
      setExtracto(r.extracto);
      setMapeo(r.extracto.mapeo);
      if (r.extracto.mapeoGuardado) setNombreMapeo(r.extracto.mapeoGuardado);
    });

  const leer = () =>
    iniciar(async () => {
      const r = await proponerExtracto(extracto!.tabla, mapeo!);
      if (!r.ok) return setError(r.error);
      setPropuestas(r.propuestas);
      setOriginales(r.propuestas);
      setErrores(r.errores);
      setError("");
    });

  const cambiar = (i: number, v: Partial<Propuesta>) => setPropuestas((ps) => ps!.map((p, j) => (j === i ? { ...p, ...v } : p)));

  const guardar = () =>
    iniciar(async () => {
      const r = await guardarLineas({ archivo: extracto!.nombre, tabla: extracto!.tabla, mapeo: mapeo!, nombreMapeo, filasLeidas: propuestas!.length + errores.length, propuestas: propuestas! });
      if (!r.ok) return setError(r.error ?? "No se ha podido importar.");
      avisar(r.mensaje);
      // Lo que corregiste respecto a la propuesta: te ofrezco una regla para la próxima vez
      const vistas = new Set<string>();
      const nuevas: Correccion[] = [];
      propuestas!.forEach((p, i) => {
        const o = originales[i];
        if (!p.aceptar || !p.grupoId || p.grupoId === o.grupoId || !conGrupo(tipoDe(p))) return;
        const patron = patronSugerido(p.linea.concepto);
        if (vistas.has(patron)) return;
        vistas.add(patron);
        nuevas.push({ clave: `${i}`, concepto: p.linea.concepto, patron, grupoId: p.grupoId, etiqueta: p.etiqueta ?? "" });
      });
      setCorrecciones(nuevas);
      reiniciar();
    });

  const cabecera = extracto && mapeo ? (extracto.tabla[mapeo.filaCabecera] ?? []).map((c, i) => `${String.fromCharCode(65 + i)} · ${c ?? "(vacía)"}`) : [];
  const columna = (id: string, etiqueta: string, campo: keyof Mapeo, opcional = false) => (
    <Campo id={id} etiqueta={etiqueta}>
      <Select
        id={id}
        value={mapeo![campo] == null ? "" : String(mapeo![campo])}
        onChange={(e) => {
          setMapeo({ ...mapeo!, [campo]: e.target.value === "" ? null : Number(e.target.value) });
          setPropuestas(null);
        }}
      >
        {opcional && <option value="">—</option>}
        {cabecera.map((c, i) => (
          <option key={i} value={i}>
            {c}
          </option>
        ))}
      </Select>
    </Campo>
  );
  const aceptadas = propuestas?.filter((p) => p.aceptar).length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-tinta-2">
        Para lo que se te haya escapado: sube el extracto de Imagin (CSV o Excel). Lo que se parezca a algo que ya tienes (mismo importe y cargo a 2 días o menos) llega
        desmarcado. Revisa cada línea antes de guardar.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input ref={input} type="file" accept=".csv,.txt,.xlsx" className="sr-only" id="extracto-archivo" tabIndex={-1} aria-label="Archivo del extracto" onChange={(e) => e.target.files?.[0] && elegir(e.target.files[0])} />
        <Button variant="outline" disabled={enviando} onClick={() => input.current?.click()}>
          <FileUp /> {extracto ? "Elegir otro extracto" : "Elegir el extracto (.csv o .xlsx)"}
        </Button>
        {extracto && (
          <span className="text-sm text-tinta-2">
            {extracto.nombre}
            {extracto.mapeoGuardado && <> · columnas como en «{extracto.mapeoGuardado}»</>}
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-burdeos">
          {error}
        </p>
      )}

      {extracto && mapeo && (
        <div className="rounded-lg border border-linea-suave bg-campo p-4">
          <h3 className="font-bold">Columnas</h3>
          <p className="mb-3 text-xs text-tinta-3">Ya vienen propuestas; cámbialas si tu banco cambia el formato.</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Campo id="m-cab" etiqueta="Fila de la cabecera">
              <Input
                id="m-cab"
                inputMode="numeric"
                value={mapeo.filaCabecera + 1}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (n >= 1 && n <= extracto.tabla.length) setMapeo({ ...mapeo, filaCabecera: n - 1 });
                  setPropuestas(null);
                }}
              />
            </Campo>
            {columna("m-fecha", "Fecha de la operación", "fecha")}
            {columna("m-valor", "Fecha valor (cargo)", "fechaValor", true)}
            {columna("m-concepto", "Concepto", "concepto")}
            {columna("m-importe", "Importe con signo", "importe", true)}
            {mapeo.importe == null && columna("m-cargo", "Cargos", "cargo", true)}
            {mapeo.importe == null && columna("m-abono", "Abonos", "abono", true)}
            <Campo id="m-formato" etiqueta="Formato de fecha">
              <Select id="m-formato" value={mapeo.formatoFecha} onChange={(e) => setMapeo({ ...mapeo, formatoFecha: e.target.value as Mapeo["formatoFecha"] })}>
                <option value="dma">dd/mm/aaaa</option>
                <option value="amd">aaaa-mm-dd</option>
                <option value="mda">mm/dd/aaaa</option>
              </Select>
            </Campo>
          </div>
          {!propuestas && (
            <Button className="mt-4" disabled={enviando} onClick={leer}>
              Leer las líneas
            </Button>
          )}
        </div>
      )}

      {propuestas && (
        <div className="rounded-lg border border-linea-suave bg-campo p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-bold">
              {propuestas.length} líneas · {aceptadas} marcadas
            </h3>
            <span className="text-xs text-tinta-3">Desmarca lo que no quieras guardar. Si corriges un grupo, te propondré una regla para la próxima vez.</span>
          </div>
          {errores.length > 0 && (
            <p className="mb-2 text-xs text-burdeos">
              {errores.length} fila{errores.length > 1 ? "s" : ""} sin leer: {errores.slice(0, 5).map((e) => `${e.fila} (${e.motivo})`).join(", ")}
              {errores.length > 5 ? "…" : ""}
            </p>
          )}
          <ul className="divide-y divide-linea-suave">
            {propuestas.map((p, i) => {
              const t = tipoDe(p);
              return (
                <li key={p.linea.fila} className={cn("grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-2.5 text-sm lg:grid-cols-[auto_6.5rem_minmax(0,1fr)_7rem_9rem_9rem_8rem]", !p.aceptar && "opacity-60")}>
                  <input type="checkbox" className="size-4 accent-oliva" checked={p.aceptar} onChange={(e) => cambiar(i, { aceptar: e.target.checked })} aria-label={`Importar ${p.linea.concepto}`} />
                  <span className="num max-lg:hidden">
                    {fecha(p.linea.fechaCargo)}
                    {p.linea.fechaCompra !== p.linea.fechaCargo && <small className="block text-xs text-tinta-3">compra {fechaCorta(p.linea.fechaCompra)}</small>}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate" title={p.linea.concepto}>
                      {p.linea.concepto}
                    </span>
                    <span className="num text-xs text-tinta-3 lg:hidden">{fecha(p.linea.fechaCargo)} · </span>
                    {p.duplicado && (
                      <span className={cn("rounded-full px-2 py-px text-[11px] font-bold", p.duplicado.tipo === "exacto" ? "bg-burdeos-claro text-[#4e1717]" : "bg-ambar-claro text-[#4f3a10]")}>
                        {p.duplicado.tipo === "exacto" ? "ya está" : "posible duplicado"} de {p.duplicado.con.concepto} {fechaCorta(p.duplicado.con.fechaCargo)}
                      </span>
                    )}
                  </span>
                  <b className={cn("num whitespace-nowrap text-right", p.linea.importeCent > 0 && "text-oliva-osc")}>
                    {p.linea.importeCent > 0 ? "+" : "−"}
                    {eur(Math.abs(p.linea.importeCent))}
                  </b>
                  <Select
                    aria-label="Tipo"
                    className="col-span-3 h-9 lg:col-span-1"
                    value={t}
                    onChange={(e) => {
                      const n = e.target.value as TipoLinea;
                      cambiar(i, { clase: TIPOS[n].clase, entradaComo: TIPOS[n].como, grupoId: conGrupo(n) ? (p.grupoId ?? otros) : null });
                    }}
                  >
                    {(Object.keys(TIPOS) as TipoLinea[]).map((k) => (
                      <option key={k} value={k}>
                        {TIPOS[k].texto}
                      </option>
                    ))}
                  </Select>
                  <Select aria-label="Grupo" className="col-span-2 h-9 lg:col-span-1" disabled={!conGrupo(t)} value={conGrupo(t) ? (p.grupoId ?? "") : ""} onChange={(e) => cambiar(i, { grupoId: Number(e.target.value) })}>
                    {!conGrupo(t) && <option value="">—</option>}
                    {grupos.filter((g) => g.activo).map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nombre}
                      </option>
                    ))}
                  </Select>
                  <Input aria-label="Etiqueta" placeholder="etiqueta" className="h-9" value={p.etiqueta ?? ""} onChange={(e) => cambiar(i, { etiqueta: e.target.value || null })} />
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-linea-suave pt-3">
            <Campo id="m-nombre" etiqueta="Recordar estas columnas como" className="w-56">
              <Input id="m-nombre" value={nombreMapeo} onChange={(e) => setNombreMapeo(e.target.value)} placeholder="Imagin" />
            </Campo>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={reiniciar}>
                Cancelar
              </Button>
              <Button disabled={enviando || !aceptadas} onClick={guardar}>
                Importar {aceptadas} línea{aceptadas === 1 ? "" : "s"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {correcciones.length > 0 && (
        <div className="rounded-lg border border-linea bg-ambar-claro/50 p-4">
          <h3 className="font-bold">¿Creo una regla para la próxima vez?</h3>
          <p className="mb-3 text-xs text-tinta-2">Corregiste el grupo de estos conceptos. Con una regla, los próximos extractos ya vendrán bien clasificados.</p>
          <ul className="flex flex-col gap-3">
            {correcciones.map((c) => (
              <li key={c.clave} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem_10rem_auto] sm:items-end">
                <Campo id={`r-${c.clave}`} etiqueta={<>Si el concepto contiene… <span className="font-normal text-tinta-3">({c.concepto})</span></>}>
                  <Input id={`r-${c.clave}`} value={c.patron} onChange={(e) => setCorrecciones((cs) => cs.map((x) => (x.clave === c.clave ? { ...x, patron: e.target.value } : x)))} />
                </Campo>
                <Campo id={`rg-${c.clave}`} etiqueta="…va a">
                  <Select id={`rg-${c.clave}`} value={c.grupoId} onChange={(e) => setCorrecciones((cs) => cs.map((x) => (x.clave === c.clave ? { ...x, grupoId: Number(e.target.value) } : x)))}>
                    {grupos.filter((g) => g.activo).map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nombre}
                      </option>
                    ))}
                  </Select>
                </Campo>
                <Campo id={`re-${c.clave}`} etiqueta="Etiqueta">
                  <Input id={`re-${c.clave}`} value={c.etiqueta} placeholder="opcional" onChange={(e) => setCorrecciones((cs) => cs.map((x) => (x.clave === c.clave ? { ...x, etiqueta: e.target.value } : x)))} />
                </Campo>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    disabled={enviando}
                    onClick={() =>
                      iniciar(async () => {
                        const r = await crearReglaImportacion(c.patron, c.grupoId, c.etiqueta);
                        avisar(r.ok ? r.mensaje : (r.error ?? "No se ha podido crear."));
                        if (r.ok) setCorrecciones((cs) => cs.filter((x) => x.clave !== c.clave));
                      })
                    }
                  >
                    Crear regla
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setCorrecciones((cs) => cs.filter((x) => x.clave !== c.clave))}>
                    No
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
