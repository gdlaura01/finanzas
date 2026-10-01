"use server";

import { trasCambio } from "@/lib/cambios";
import { db } from "@/db";
import { leerParametros, todosLosGrupos } from "@/db/movimientos";
import * as plan from "@/db/plan";
import { conSesion, type Resultado } from "@/lib/auth/exigir";
import { eur, leerImporte } from "@/lib/formato";
import { PARAMETROS_PLAN, validarEvento, validarParametro, type ErroresEvento, type FormularioEvento, type ParametroPlan } from "@/lib/plan";

const refrescar = trasCambio;

export async function guardarParametroPlan(clave: string, texto: string): Promise<Resultado> {
  return conSesion(() => {
    const base = db();
    const r = validarParametro(clave, texto, leerParametros(base) as Partial<Record<ParametroPlan, number>>);
    if (!r.ok) return { ok: false, error: r.error };
    plan.guardarParametro(base, clave as ParametroPlan, r.valor);
    refrescar();
    return { ok: true, mensaje: `${PARAMETROS_PLAN[clave as ParametroPlan]}: ${eur(r.valor)}` };
  });
}

export async function guardarPresupuestoGrupo(id: number, campo: "presupuestoCent" | "efectivoPrevistoCent", texto: string): Promise<Resultado> {
  return conSesion(() => {
    const v = leerImporte(texto);
    if (v == null || Number.isNaN(v) || v < 0) return { ok: false, error: "Escribe un importe, por ejemplo 70,00." };
    if (campo !== "presupuestoCent" && campo !== "efectivoPrevistoCent") return { ok: false, error: "Campo no válido." };
    const g = plan.guardarPresupuestoGrupo(db(), id, campo, v);
    refrescar();
    return { ok: true, mensaje: `${g.nombre}: ${campo === "presupuestoCent" ? "presupuesto" : "parte en efectivo"} de ${eur(v)}` };
  });
}

const CAMPOS = ["nombre", "mes", "dia", "grupoId", "etiqueta", "importe", "notas", "color", "soloEsteAnio", "anio"] as const;
const leer = (f: FormData): FormularioEvento => Object.fromEntries(CAMPOS.map((k) => [k, f.get(k)?.toString() ?? undefined]));

export async function guardarEvento(id: number | null, f: FormData): Promise<Resultado<ErroresEvento>> {
  return conSesion<ErroresEvento>(() => {
    const base = db();
    const r = validarEvento(leer(f), { grupos: todosLosGrupos(base).map((g) => g.id), etiquetasDeOtros: plan.etiquetasDeOtrosEventos(base, id ?? undefined) });
    if (!r.ok) return r;
    if (id) plan.editarEvento(base, id, r.datos);
    const nuevo = id ? id : plan.crearEvento(base, r.datos);
    refrescar();
    return { ok: true, id: nuevo, mensaje: id ? "Evento guardado" : "Evento añadido" };
  });
}

export async function borrarEvento(id: number): Promise<Resultado> {
  return conSesion(() => {
    const r = plan.borrarEvento(db(), id);
    refrescar();
    return { ok: true, mensaje: r ? `Evento eliminado: ${r.nombre}` : "Ese evento ya no estaba" };
  });
}
