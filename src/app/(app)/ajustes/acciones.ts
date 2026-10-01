"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as aj from "@/db/ajustes";
import * as t from "@/db/schema";
import { conSesion, type Resultado } from "@/lib/auth/exigir";
import { trasCambio } from "@/lib/cambios";
import { hoy } from "@/lib/formato";
import { mesDeInicio, mover, palabrasAPatron, validarAtajo, validarGrupo, validarRecurrente } from "@/lib/ajustes";

type Form = Record<string, string | undefined>;
const idsGruposActivos = () => db().select({ id: t.grupos.id }).from(t.grupos).where(eq(t.grupos.activo, true)).all().map((g) => g.id);
const hecho = (mensaje: string, id?: number): Resultado => {
  trasCambio();
  return { ok: true, mensaje, id };
};

/* ---------- Recurrentes ---------- */

export async function guardarRecurrente(id: number | null, f: Form): Promise<Resultado> {
  return conSesion(() => {
    const base = db();
    const r = id == null ? null : base.select().from(t.recurrentes).where(eq(t.recurrentes.id, id)).get();
    if (id != null && !r) return { ok: false, error: "Ese recurrente ya no existe." };
    const grupos = idsGruposActivos();
    if (r?.grupoId) grupos.push(r.grupoId);
    const v = validarRecurrente(f, { grupos, nuevo: !r, clase: r?.clase, vinculado: !!r?.vinculo });
    if (!v.ok) return { ok: false, errores: v.errores };
    if (r) {
      aj.editarRecurrente(base, r.id, v.datos);
      return hecho(`«${v.datos.concepto}» guardado`);
    }
    return hecho(`«${v.datos.concepto}» añadido`, aj.crearRecurrente(base, v.datos, mesDeInicio(v.datos.dia, hoy())));
  });
}

export async function interruptorRecurrente(id: number, campo: "auto" | "activo", valor: boolean): Promise<Resultado> {
  return conSesion(() => {
    if (campo !== "auto" && campo !== "activo") return { ok: false, error: "Campo no válido." };
    const base = db();
    const r = base.select().from(t.recurrentes).where(eq(t.recurrentes.id, id)).get();
    if (!r) return { ok: false, error: "Ese recurrente ya no existe." };
    if (campo === "auto" && valor && (r.dia == null || (r.importeCent == null && !r.vinculo)))
      return { ok: false, error: "Para que se apunte solo necesita un día fijo y un importe: edítalo primero." };
    aj.cambiarInterruptorRecurrente(base, id, campo, valor);
    const txt = campo === "auto" ? (valor ? "se apuntará solo" : "te lo preguntaré en Pendientes") : valor ? "activado" : "desactivado";
    return hecho(`«${r.concepto}»: ${txt}`);
  });
}

export async function borrarRecurrente(id: number): Promise<Resultado> {
  return conSesion(() => {
    const r = aj.borrarRecurrente(db(), id);
    return r ? hecho(`«${r.concepto}» borrado; sus movimientos se quedan`) : { ok: false, error: "Ese recurrente ya no existe." };
  });
}

/* ---------- Atajos ---------- */

export async function guardarAtajo(id: number | null, f: Form): Promise<Resultado> {
  return conSesion(() => {
    const base = db();
    const v = validarAtajo(f, idsGruposActivos());
    if (!v.ok) return { ok: false, errores: v.errores };
    if (id == null) return hecho(`Atajo «${v.datos.textoBoton}» añadido`, aj.crearAtajo(base, v.datos));
    aj.editarAtajo(base, id, v.datos);
    return hecho(`Atajo «${v.datos.textoBoton}» guardado`);
  });
}

export async function borrarAtajo(id: number): Promise<Resultado> {
  return conSesion(() => {
    aj.borrarAtajo(db(), id);
    return hecho("Atajo borrado");
  });
}

export async function moverAtajo(id: number, dir: -1 | 1): Promise<Resultado> {
  return conSesion(() => {
    const base = db();
    aj.ordenarAtajos(base, mover(aj.idsAtajos(base), id, dir === -1 ? -1 : 1));
    return hecho(dir === -1 ? "Atajo subido" : "Atajo bajado");
  });
}

/* ---------- Grupos ---------- */

export async function guardarGrupo(id: number | null, f: Form): Promise<Resultado> {
  return conSesion(() => {
    const base = db();
    const todos = base.select().from(t.grupos).all();
    const v = validarGrupo(f, { nombresDeOtros: todos.filter((g) => g.id !== id).map((g) => g.nombre), nuevo: id == null });
    if (!v.ok) return { ok: false, errores: v.errores };
    if (id == null) return hecho(`Grupo «${v.datos.nombre}» creado`, aj.crearGrupo(base, v.datos));
    const g = todos.find((x) => x.id === id);
    if (!g) return { ok: false, error: "Ese grupo ya no existe." };
    // «Otros» y Regalos conservan el nombre: la app los busca por él
    const nombre = g.nombre === "Otros" || g.esDinamico ? g.nombre : v.datos.nombre;
    aj.editarGrupo(base, id, { nombre, color: v.datos.color });
    return hecho(`Grupo «${nombre}» guardado`);
  });
}

export async function archivarGrupo(id: number, activo: boolean): Promise<Resultado> {
  return conSesion(() => {
    const r = aj.archivarGrupo(db(), id, activo);
    return hecho(r === "reactivado" ? "Grupo reactivado" : r === "archivado" ? "Grupo archivado: sus movimientos siguen ahí" : "Grupo borrado (no tenía nada)");
  });
}

export async function moverGrupo(id: number, dir: -1 | 1): Promise<Resultado> {
  return conSesion(() => {
    const base = db();
    aj.ordenarGrupos(base, mover(aj.idsGrupos(base), id, dir === -1 ? -1 : 1));
    return hecho(dir === -1 ? "Grupo subido" : "Grupo bajado");
  });
}

/* ---------- Reglas ---------- */

function validarRegla(f: Form) {
  const patron = palabrasAPatron(f.palabras ?? "");
  const grupoId = Number(f.grupoId);
  const e: Record<string, string> = {};
  if (!patron) e.palabras = "Escribe al menos una palabra.";
  if (!idsGruposActivos().includes(grupoId)) e.grupoId = "Elige un grupo.";
  const etiqueta = (f.etiqueta ?? "").trim().slice(0, 60) || null;
  return Object.keys(e).length ? ({ ok: false, errores: e } as const) : ({ ok: true, datos: { patron, grupoId, etiqueta } } as const);
}

export async function guardarRegla(id: number | null, f: Form): Promise<Resultado> {
  return conSesion(() => {
    const v = validarRegla(f);
    if (!v.ok) return { ok: false, errores: v.errores };
    if (id == null) return hecho("Regla añadida la primera", aj.crearRegla(db(), v.datos));
    aj.editarRegla(db(), id, v.datos);
    return hecho("Regla guardada");
  });
}

export async function borrarRegla(id: number): Promise<Resultado> {
  return conSesion(() => {
    aj.borrarRegla(db(), id);
    return hecho("Regla borrada");
  });
}

export async function moverRegla(id: number, dir: -1 | 1): Promise<Resultado> {
  return conSesion(() => {
    const base = db();
    aj.ordenarReglas(base, mover(aj.idsReglas(base), id, dir === -1 ? -1 : 1));
    return hecho(dir === -1 ? "Regla subida" : "Regla bajada");
  });
}
