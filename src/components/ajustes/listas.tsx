"use client";

import { useMemo, useState } from "react";
import { Campo } from "@/components/ui/campo";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import * as acc from "@/app/(app)/ajustes/acciones";
import { patronAEditable, patronAPalabras } from "@/lib/ajustes";
import { eur, importeACampo } from "@/lib/formato";
import { CLASES_FORM, describirRecurrente, NOMBRE_MEDIO } from "@/lib/movimientos";
import { sugerir } from "@/lib/reglas";
import type { Medio } from "@/db/schema";
import { Editor, Interruptor, Orden, Tarjeta, useAccion } from "./comunes";

export type Grupo = { id: number; nombre: string; color: string; orden: number; presupuestoCent: number | null; esDinamico: boolean; activo: boolean };
export type Recurrente = {
  id: number;
  concepto: string;
  clase: "entrada" | "gasto" | "ahorro" | "hucha" | "interno" | "interes" | "valoracion";
  grupoId: number | null;
  etiqueta: string | null;
  medio: Medio;
  cuentaOrigen: "imagin" | "ahorro_tr" | "inversion_tr" | "hucha_revolut" | null;
  cuentaDestino: "imagin" | "ahorro_tr" | "inversion_tr" | "hucha_revolut" | null;
  importeCent: number | null;
  /** Importe efectivo: el del parámetro si va ligado. */
  importe: number | null;
  vinculo: string | null;
  dia: number | null;
  auto: boolean;
  activo: boolean;
};
export type Atajo = { id: number; textoBoton: string; concepto: string; clase: keyof typeof CLASES_FORM; entradaComo: "ingreso" | "devolucion" | null; grupoId: number | null; etiqueta: string | null; medio: Medio; importeCent: number | null; usos: number };
export type Regla = { id: number; patron: string; grupoId: number; etiqueta: string | null; prioridad: number };

const deLaApp = (r: Recurrente) => !!r.vinculo || r.clase === "interes" || r.clase === "valoracion" || r.clase === "interno";
const COLOR_CLASE: Record<string, string> = { entrada: "#4B7A2F", ahorro: "#4B7A2F", hucha: "#5A72B0", interno: "#E0895E", interes: "#4B7A2F", valoracion: "#E0895E" };

function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-linea bg-papel p-6 text-center text-sm text-tinta-3">{children}</p>;
}

function SelectGrupo({ id, grupos, valor, error, opcional, etiqueta = "Grupo" }: { id: string; grupos: Grupo[]; valor: number | null; error?: string; opcional?: string; etiqueta?: string }) {
  return (
    <Campo id={id} etiqueta={etiqueta} error={error}>
      <Select id={id} name="grupoId" defaultValue={valor ?? ""} aria-invalid={!!error}>
        {opcional != null ? <option value="">{opcional}</option> : <option value="" disabled>Elige…</option>}
        {grupos
          .filter((g) => g.activo || g.id === valor)
          .map((g) => (
            <option key={g.id} value={g.id}>
              {g.nombre}
              {g.activo ? "" : " (archivado)"}
            </option>
          ))}
      </Select>
    </Campo>
  );
}

function SelectMedio({ id, valor }: { id: string; valor: Medio }) {
  return (
    <Campo id={id} etiqueta="Medio">
      <Select id={id} name="medio" defaultValue={valor}>
        {Object.entries(NOMBRE_MEDIO).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </Select>
    </Campo>
  );
}

/* ---------- Recurrentes ---------- */

const CLASES_NUEVO = { gasto: "Gasto (suscripción, cuota…)", entrada: "Entrada de dinero", ahorro: "A Ahorro TR", hucha: "A la hucha" } as const;

function CamposRecurrente({ r, grupos, errores }: { r?: Recurrente; grupos: Grupo[]; errores: Record<string, string> }) {
  const [clase, setClase] = useState<string>(r?.clase ?? "gasto");
  const sinImporte = r && (r.vinculo || r.clase === "interes" || r.clase === "valoracion");
  const p = r ? `rec-${r.id}` : "rec-nuevo";
  return (
    <>
      <input type="hidden" name="activo" value={r && !r.activo ? "off" : "on"} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo id={`${p}-concepto`} etiqueta="Concepto" error={errores.concepto} className="sm:col-span-2">
          <Input id={`${p}-concepto`} name="concepto" defaultValue={r?.concepto} autoFocus aria-invalid={!!errores.concepto} />
        </Campo>
        {!r && (
          <Campo id={`${p}-clase`} etiqueta="Tipo" error={errores.clase} className="sm:col-span-2">
            <Select id={`${p}-clase`} name="clase" value={clase} onChange={(e) => setClase(e.target.value)}>
              {Object.entries(CLASES_NUEVO).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Campo>
        )}
        {clase === "gasto" && (
          <>
            <SelectGrupo id={`${p}-grupo`} grupos={grupos} valor={r?.grupoId ?? null} error={errores.grupoId} />
            <Campo id={`${p}-etiqueta`} etiqueta="Etiqueta (opcional)">
              <Input id={`${p}-etiqueta`} name="etiqueta" defaultValue={r?.etiqueta ?? ""} />
            </Campo>
          </>
        )}
        {(clase === "gasto" || clase === "entrada") && <SelectMedio id={`${p}-medio`} valor={r?.medio ?? "imagin"} />}
        {sinImporte ? (
          <p className="self-end text-sm text-tinta-3">{r.vinculo ? "Su importe se cambia en Presupuesto." : "Importe variable: lo escribes cada mes."}</p>
        ) : (
          <Campo id={`${p}-importe`} etiqueta="Importe" error={errores.importe} ayuda="Vacío si cambia cada vez.">
            <Input id={`${p}-importe`} name="importe" inputMode="decimal" className="num text-right" placeholder="0,00" defaultValue={r?.importeCent != null ? importeACampo(r.importeCent) : ""} aria-invalid={!!errores.importe} />
          </Campo>
        )}
        <Campo id={`${p}-dia`} etiqueta="Día del mes" error={errores.dia} ayuda="Vacío si no tiene día fijo.">
          <Input id={`${p}-dia`} name="dia" inputMode="numeric" className="num" defaultValue={r?.dia ?? ""} aria-invalid={!!errores.dia} />
        </Campo>
      </div>
      {r?.clase === "interes" || r?.clase === "valoracion" ? null : (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="auto" defaultChecked={r?.auto} className="mt-0.5 size-4 accent-oliva" />
          <span>
            <b>Se apunta solo</b> el día que toca. Si no, te lo pregunto en Pendientes para que pongas la fecha y el importe reales.
          </span>
        </label>
      )}
    </>
  );
}

export function NuevoRecurrente({ grupos }: { grupos: Grupo[] }) {
  return (
    <Editor nuevo textoBoton="+ Nuevo recurrente" nombre="recurrente" titulo="Nuevo recurrente" descripcion="Un pago o una entrada que se repite cada mes." enviar={(f) => acc.guardarRecurrente(null, f)}>
      {(e) => <CamposRecurrente grupos={grupos} errores={e} />}
    </Editor>
  );
}

export function ListaRecurrentes({ recurrentes, grupos }: { recurrentes: Recurrente[]; grupos: Grupo[] }) {
  const { enviando, lanzar } = useAccion();
  if (!recurrentes.length) return <Vacio>Aún no hay recurrentes. Añade tus suscripciones y cuotas para que salgan en Pendientes cada mes.</Vacio>;
  const grupo = (id: number | null) => grupos.find((g) => g.id === id);
  return (
    <ul className="flex flex-col gap-2">
      {recurrentes.map((r) => {
        const g = grupo(r.grupoId);
        const app = deLaApp(r);
        const puedeAuto = r.dia != null && r.importe != null;
        return (
          <Tarjeta
            key={r.id}
            color={g?.color ?? COLOR_CLASE[r.clase]}
            apagado={!r.activo}
            titulo={
              <>
                {r.concepto}
                {r.importe != null && <span className="num ml-2 font-semibold text-tinta-2">{eur(r.importe)}</span>}
              </>
            }
            detalle={describirRecurrente(r, g?.nombre) + (r.etiqueta ? ` · ${r.etiqueta}` : "")}
            meta={[r.dia ? `Día ${r.dia}` : "Sin día fijo", r.vinculo ? "importe de Presupuesto" : r.importe == null ? "importe variable" : null, !r.activo && "desactivado"].filter(Boolean).join(" · ")}
          >
            <Interruptor
              activo={r.auto}
              etiqueta="Se apunta solo"
              titulo={puedeAuto ? undefined : "Necesita un día fijo y un importe"}
              disabled={enviando || !r.activo || (!puedeAuto && !r.auto)}
              alCambiar={(v) => lanzar(() => acc.interruptorRecurrente(r.id, "auto", v))} />
            <Interruptor activo={r.activo} etiqueta="Activo" disabled={enviando} alCambiar={(v) => lanzar(() => acc.interruptorRecurrente(r.id, "activo", v))} />
            <Editor
              nombre={r.concepto}
              titulo={`Editar «${r.concepto}»`}
              descripcion={app ? "Es parte de la app: puedes cambiarlo o desactivarlo, pero no borrarlo." : "Borrarlo no borra los movimientos que ya apuntó."}
              enviar={(f) => acc.guardarRecurrente(r.id, f)}
              borrar={app ? undefined : () => acc.borrarRecurrente(r.id)}
            >
              {(e) => <CamposRecurrente r={r} grupos={grupos} errores={e} />}
            </Editor>
          </Tarjeta>
        );
      })}
    </ul>
  );
}

/* ---------- Atajos ---------- */

function CamposAtajo({ a, grupos, errores }: { a?: Atajo; grupos: Grupo[]; errores: Record<string, string> }) {
  const [clase, setClase] = useState<string>(a?.clase ?? "gasto");
  const [como, setComo] = useState<string>(a?.entradaComo ?? "");
  const p = a ? `ata-${a.id}` : "ata-nuevo";
  const conGrupo = clase === "gasto" || (clase === "entrada" && como !== "ingreso");
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Campo id={`${p}-texto`} etiqueta="Texto del botón" error={errores.textoBoton} ayuda="Corto: 1 o 2 palabras.">
        <Input id={`${p}-texto`} name="textoBoton" maxLength={24} defaultValue={a?.textoBoton} autoFocus aria-invalid={!!errores.textoBoton} />
      </Campo>
      <Campo id={`${p}-concepto`} etiqueta="Concepto que rellena" error={errores.concepto}>
        <Input id={`${p}-concepto`} name="concepto" defaultValue={a?.concepto} aria-invalid={!!errores.concepto} />
      </Campo>
      <Campo id={`${p}-clase`} etiqueta="Tipo" error={errores.clase}>
        <Select id={`${p}-clase`} name="clase" value={clase} onChange={(e) => setClase(e.target.value)}>
          {Object.entries(CLASES_FORM).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </Campo>
      {clase === "entrada" && (
        <Campo id={`${p}-como`} etiqueta="Cuenta como">
          <Select id={`${p}-como`} name="entradaComo" value={como} onChange={(e) => setComo(e.target.value)}>
            <option value="">Lo decido al usarlo</option>
            <option value="ingreso">Ingreso</option>
            <option value="devolucion">Devolución (resta gasto del grupo)</option>
          </Select>
        </Campo>
      )}
      {conGrupo && <SelectGrupo id={`${p}-grupo`} grupos={grupos} valor={a?.grupoId ?? null} error={errores.grupoId} opcional="Lo elijo al usarlo" />}
      {conGrupo && (
        <Campo id={`${p}-etiqueta`} etiqueta="Etiqueta (opcional)">
          <Input id={`${p}-etiqueta`} name="etiqueta" defaultValue={a?.etiqueta ?? ""} />
        </Campo>
      )}
      <SelectMedio id={`${p}-medio`} valor={a?.medio ?? "imagin"} />
      <Campo id={`${p}-importe`} etiqueta="Importe" error={errores.importe} ayuda="Vacío si cambia: lo escribes al usarlo.">
        <Input id={`${p}-importe`} name="importe" inputMode="decimal" className="num text-right" placeholder="0,00" defaultValue={a?.importeCent != null ? importeACampo(a.importeCent) : ""} aria-invalid={!!errores.importe} />
      </Campo>
    </div>
  );
}

export function NuevoAtajo({ grupos }: { grupos: Grupo[] }) {
  return (
    <Editor nuevo textoBoton="+ Nuevo atajo" nombre="atajo" titulo="Nuevo atajo" descripcion="Un botón en «Registrar» que rellena el formulario de un toque." enviar={(f) => acc.guardarAtajo(null, f)}>
      {(e) => <CamposAtajo grupos={grupos} errores={e} />}
    </Editor>
  );
}

export function ListaAtajos({ atajos, grupos }: { atajos: Atajo[]; grupos: Grupo[] }) {
  if (!atajos.length) return <Vacio>Sin atajos todavía. Crea uno para lo que apuntas a menudo: el café, la gasolina, la hucha…</Vacio>;
  return (
    <ul className="flex flex-col gap-2">
      {atajos.map((a, i) => {
        const g = grupos.find((x) => x.id === a.grupoId);
        return (
          <Tarjeta
            key={a.id}
            color={g?.color ?? COLOR_CLASE[a.clase]}
            titulo={
              <>
                <span className="mr-2 inline-block rounded-full border border-linea bg-campo px-2.5 py-0.5 text-sm">{a.textoBoton}</span>
                {a.concepto}
              </>
            }
            detalle={[CLASES_FORM[a.clase], a.entradaComo === "ingreso" ? "como ingreso" : a.entradaComo === "devolucion" ? "como devolución" : null, g?.nombre, a.etiqueta, NOMBRE_MEDIO[a.medio], a.importeCent != null ? eur(a.importeCent) : "importe variable"]
              .filter(Boolean)
              .join(" · ")}
            meta={a.usos ? `Usado ${a.usos} ${a.usos === 1 ? "vez" : "veces"}` : "Sin usar todavía"}
          >
            <Orden nombre={a.textoBoton} primero={i === 0} ultimo={i === atajos.length - 1} mover={(d) => acc.moverAtajo(a.id, d)} />
            <Editor nombre={a.textoBoton} titulo={`Editar el atajo «${a.textoBoton}»`} enviar={(f) => acc.guardarAtajo(a.id, f)} borrar={() => acc.borrarAtajo(a.id)}>
              {(e) => <CamposAtajo a={a} grupos={grupos} errores={e} />}
            </Editor>
          </Tarjeta>
        );
      })}
    </ul>
  );
}

/* ---------- Grupos ---------- */

/** Colores de la paleta de la app, para no tener que inventarlos. */
const MUESTRAS = ["#BA6A4C", "#46553F", "#8C9C7C", "#BE8A2A", "#7B2525", "#607456", "#D9977A", "#9E4A33", "#5A72B0", "#5E6B7A", "#8E5A6B", "#4B7A2F"];

function CamposGrupo({ g, errores }: { g?: Grupo; errores: Record<string, string> }) {
  const [color, setColor] = useState(g?.color ?? MUESTRAS[9]);
  const fijo = g && (g.nombre === "Otros" || g.esDinamico);
  const p = g ? `gru-${g.id}` : "gru-nuevo";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Campo id={`${p}-nombre`} etiqueta="Nombre" error={errores.nombre} ayuda={fijo ? "La app usa este grupo por su nombre: no se puede cambiar." : undefined} className={g ? "sm:col-span-2" : undefined}>
        <Input id={`${p}-nombre`} name="nombre" maxLength={30} defaultValue={g?.nombre} readOnly={!!fijo} autoFocus={!fijo} aria-invalid={!!errores.nombre} />
      </Campo>
      {!g && (
        <Campo id={`${p}-presupuesto`} etiqueta="Presupuesto al mes" error={errores.presupuesto} ayuda="Lo puedes cambiar luego en Presupuesto.">
          <Input id={`${p}-presupuesto`} name="presupuesto" inputMode="decimal" className="num text-right" placeholder="0,00" aria-invalid={!!errores.presupuesto} />
        </Campo>
      )}
      <fieldset className="sm:col-span-2">
        <legend className="mb-1.5 text-sm font-semibold">Color</legend>
        <input type="hidden" name="color" value={color} />
        <div className="flex flex-wrap items-center gap-2">
          {MUESTRAS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color ${c}`}
              aria-pressed={c.toLowerCase() === color.toLowerCase()}
              onClick={() => setColor(c)}
              className="size-8 rounded-full border-2 border-papel outline-offset-2 aria-pressed:outline-2 aria-pressed:outline-tinta"
              style={{ background: c }}
            />
          ))}
          <label className="ml-1 inline-flex items-center gap-1 text-xs text-tinta-3">
            Otro
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-linea bg-campo" />
          </label>
        </div>
        {errores.color && <p className="mt-1 text-xs font-medium text-burdeos">{errores.color}</p>}
      </fieldset>
    </div>
  );
}

export function NuevoGrupo() {
  return (
    <Editor nuevo textoBoton="+ Nuevo grupo" nombre="grupo" titulo="Nuevo grupo" descripcion="Se coloca antes de «Otros», que va siempre el último." enviar={(f) => acc.guardarGrupo(null, f)}>
      {(e) => <CamposGrupo errores={e} />}
    </Editor>
  );
}

export function ListaGrupos({ grupos, usos }: { grupos: Grupo[]; usos: Record<number, number> }) {
  const { enviando, lanzar } = useAccion();
  const activos = grupos.filter((g) => g.activo);
  const archivados = grupos.filter((g) => !g.activo);
  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col gap-2">
        {activos.map((g, i) => {
          const fijo = g.nombre === "Otros" || g.esDinamico;
          const n = usos[g.id] ?? 0;
          return (
            <Tarjeta
              key={g.id}
              color={g.color}
              titulo={g.nombre}
              detalle={g.esDinamico ? "Su presupuesto sale del calendario" : g.presupuestoCent ? `${eur(g.presupuestoCent)} al mes` : "Sin presupuesto"}
              meta={n ? `${n} movimiento${n === 1 ? "" : "s"}` : "Sin movimientos"}
            >
              <Orden nombre={g.nombre} primero={i === 0} ultimo={i === activos.length - 1} mover={(d) => acc.moverGrupo(g.id, d)} />
              <Editor
                nombre={g.nombre}
                titulo={`Editar el grupo «${g.nombre}»`}
                descripcion={fijo ? undefined : n ? "Con movimientos no se borra: se archiva y deja de ofrecerse al registrar." : "No tiene nada: se borra del todo."}
                enviar={(f) => acc.guardarGrupo(g.id, f)}
                borrar={fijo ? undefined : () => acc.archivarGrupo(g.id, false)}
                textoBorrar={n ? "Archivar" : "Borrar"}
              >
                {(e) => <CamposGrupo g={g} errores={e} />}
              </Editor>
            </Tarjeta>
          );
        })}
      </ul>
      {archivados.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-bold text-tinta-2">Archivados</h3>
          <ul className="flex flex-col gap-2">
            {archivados.map((g) => (
              <Tarjeta key={g.id} color={g.color} apagado titulo={g.nombre} meta={`${usos[g.id] ?? 0} movimientos · no se ofrece al registrar`}>
                <button type="button" disabled={enviando} onClick={() => lanzar(() => acc.archivarGrupo(g.id, true))} className="text-sm font-semibold text-oliva-osc underline">
                  Reactivar
                </button>
              </Tarjeta>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ---------- Reglas ---------- */

function CamposRegla({ r, grupos, errores }: { r?: Regla; grupos: Grupo[]; errores: Record<string, string> }) {
  const p = r ? `reg-${r.id}` : "reg-nueva";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Campo
        id={`${p}-palabras`}
        etiqueta="Si el concepto contiene"
        error={errores.palabras}
        className="sm:col-span-2"
        ayuda={
          <>
            Palabras separadas por comas; da igual mayúsculas y tildes. <code>^bar</code> = empieza por «bar»; <code>^hm$</code> = es exactamente «hm».
          </>
        }
      >
        <Input id={`${p}-palabras`} name="palabras" defaultValue={r ? patronAEditable(r.patron) : ""} placeholder="repsol, cepsa, galp" autoFocus aria-invalid={!!errores.palabras} />
      </Campo>
      <SelectGrupo id={`${p}-grupo`} grupos={grupos} valor={r?.grupoId ?? null} error={errores.grupoId} etiqueta="Proponer el grupo" />
      <Campo id={`${p}-etiqueta`} etiqueta="Y la etiqueta (opcional)">
        <Input id={`${p}-etiqueta`} name="etiqueta" defaultValue={r?.etiqueta ?? ""} />
      </Campo>
    </div>
  );
}

export function NuevaRegla({ grupos }: { grupos: Grupo[] }) {
  return (
    <Editor nuevo textoBoton="+ Nueva regla" nombre="regla" titulo="Nueva regla" descripcion="Se coloca la primera, para que gane a las más generales." enviar={(f) => acc.guardarRegla(null, f)}>
      {(e) => <CamposRegla grupos={grupos} errores={e} />}
    </Editor>
  );
}

/** Escribe un concepto y mira qué regla lo clasificaría (lo aprendido de tus movimientos va antes). */
export function ProbarRegla({ reglas, grupos }: { reglas: Regla[]; grupos: Grupo[] }) {
  const [texto, setTexto] = useState("");
  const r = useMemo(() => (texto.trim() ? sugerir(texto, new Map(), reglas) : null), [texto, reglas]);
  const g = r && grupos.find((x) => x.id === r.grupoId);
  const pos = r?.fuente === "regla" ? reglas.findIndex((x) => x.patron === r.regla.patron && x.prioridad === r.regla.prioridad) + 1 : 0;
  return (
    <div className="rounded-xl border border-linea-suave bg-papel p-4">
      <Campo id="probar-concepto" etiqueta="Prueba un concepto" ayuda="Como aparece en el extracto del banco.">
        <Input id="probar-concepto" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="REPSOL E.S. 1234 MADRID" />
      </Campo>
      <p id="probar-resultado" className="mt-2 min-h-5 text-sm" aria-live="polite">
        {!texto.trim() ? null : g ? (
          <>
            → <b style={{ color: g.color }}>{g.nombre}</b>
            {r!.etiqueta && <> · {r!.etiqueta}</>} <span className="text-tinta-3">(regla {pos})</span>
          </>
        ) : (
          <span className="text-tinta-3">Ninguna regla lo reconoce: al importar lo tendrás que clasificar tú (y la app lo aprenderá).</span>
        )}
      </p>
    </div>
  );
}

export function ListaReglas({ reglas, grupos }: { reglas: Regla[]; grupos: Grupo[] }) {
  if (!reglas.length) return <Vacio>No hay reglas. Sirven para proponer el grupo al importar un extracto; también se crean desde la revisión.</Vacio>;
  return (
    <ol className="flex flex-col gap-2">
      {reglas.map((r, i) => {
        const g = grupos.find((x) => x.id === r.grupoId);
        return (
          <Tarjeta
            key={r.id}
            color={g?.color}
            titulo={
              <>
                <span className="num mr-2 text-tinta-3">{i + 1}.</span>
                {patronAPalabras(r.patron).join(", ")}
              </>
            }
            detalle={`→ ${g?.nombre ?? "grupo borrado"}${r.etiqueta ? ` · ${r.etiqueta}` : ""}`}
          >
            <Orden nombre={`la regla ${i + 1}`} primero={i === 0} ultimo={i === reglas.length - 1} mover={(d) => acc.moverRegla(r.id, d)} />
            <Editor nombre={`la regla ${i + 1}`} titulo={`Editar la regla ${i + 1}`} enviar={(f) => acc.guardarRegla(r.id, f)} borrar={() => acc.borrarRegla(r.id)}>
              {(e) => <CamposRegla r={r} grupos={grupos} errores={e} />}
            </Editor>
          </Tarjeta>
        );
      })}
    </ol>
  );
}
