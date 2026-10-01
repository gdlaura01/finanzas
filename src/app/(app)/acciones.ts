"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import * as m from "@/db/movimientos";
import { conSesion, type Resultado as ResultadoBase } from "@/lib/auth/exigir";
import { esFechaISO, esMes, eur, leerImporte } from "@/lib/formato";
import { CLASES, claseDe, validarMovimiento, type DatosMovimiento, type EntradaFormulario, type Errores } from "@/lib/movimientos";

type Resultado = ResultadoBase<Errores>;

const CAMPOS = ["clase", "entradaComo", "fechaCompra", "fechaCargo", "concepto", "importe", "grupoId", "medio", "etiqueta", "notas", "cuentaDestino", "cubrirConHucha", "cuentaOrigenActual", "cuentaDestinoActual"] as const;
const leer = (f: FormData): EntradaFormulario => Object.fromEntries(CAMPOS.map((k) => [k, f.get(k)?.toString() ?? undefined]));

function refrescar() {
  revalidatePath("/", "layout");
}

const resumen = (d: DatosMovimiento) => `${d.concepto} · ${CLASES[claseDe(d)].toLowerCase()} de ${eur(Math.abs(d.importeCent))}`;

export async function registrarMovimiento(f: FormData): Promise<Resultado> {
  return conSesion<Errores>(() => {
    const base = db();
    const r = validarMovimiento(leer(f), m.gruposActivos(base).map((g) => g.id));
    if (!r.ok) return r;
    const atajo = Number(f.get("atajoId")) || null;
    const id = m.crearMovimiento(base, r.datos, atajo ? "atajo" : "manual");
    if (atajo) m.usarAtajo(base, atajo);
    refrescar();
    return { ok: true, id, mensaje: `Guardado: ${resumen(r.datos)}${r.datos.cubrirConHucha ? ", cubierto con la hucha" : ""}` };
  });
}

export async function editarMovimiento(id: number, f: FormData): Promise<Resultado> {
  return conSesion<Errores>(() => {
    const base = db();
    // Un movimiento antiguo puede estar en un grupo ya archivado: también vale.
    const r = validarMovimiento(leer(f), m.todosLosGrupos(base).map((g) => g.id));
    if (!r.ok) return r;
    const { retirada } = m.editarMovimiento(base, id, r.datos);
    refrescar();
    const extra = retirada === "ajustada" ? ", también en su retirada de la hucha" : retirada === "borrada" ? " y se ha quitado su retirada de la hucha" : "";
    return { ok: true, id, mensaje: `Cambios guardados${extra}` };
  });
}

export async function borrarMovimiento(id: number): Promise<Resultado> {
  return conSesion<Errores>(() => {
    const r = m.borrarMovimiento(db(), id);
    refrescar();
    return { ok: true, mensaje: r ? `Borrado: ${r.concepto}` : "Ese movimiento ya no estaba" };
  });
}

export async function confirmarPendiente(f: FormData): Promise<Resultado> {
  return conSesion<Errores>(() => {
    const recurrenteId = Number(f.get("recurrenteId"));
    const periodo = String(f.get("periodo") ?? "");
    const fecha = String(f.get("fecha") ?? "");
    const imp = leerImporte(f.get("importe")?.toString());
    if (!esMes(periodo)) return { ok: false, error: "Mes no válido." };
    if (!esFechaISO(fecha)) return { ok: false, errores: { fechaCargo: "Elige la fecha." } };
    if (imp == null || Number.isNaN(imp) || imp <= 0) return { ok: false, errores: { importe: "Revisa el importe." } };
    const notas = f.get("notas")?.toString().trim().slice(0, 300) || null;
    const r = m.confirmarRecurrente(db(), { recurrenteId, periodo, fecha, importeCent: imp, notas });
    refrescar();
    return { ok: true, mensaje: `${r.concepto} registrado` };
  });
}

export async function omitirPendiente(recurrenteId: number, periodo: string): Promise<Resultado> {
  return conSesion<Errores>(() => {
    if (!esMes(periodo)) return { ok: false, error: "Mes no válido." };
    const r = m.omitirRecurrente(db(), recurrenteId, periodo);
    refrescar();
    return { ok: true, mensaje: `${r?.concepto ?? "Recurrente"}: omitido este mes` };
  });
}

export async function cambiarDiaPrevisto(recurrenteId: number, texto: string): Promise<Resultado> {
  return conSesion<Errores>(() => {
    const t = texto.trim();
    const dia = t ? Number(t) : null;
    if (dia != null && !(Number.isInteger(dia) && dia >= 1 && dia <= 31)) return { ok: false, error: "Escribe un día del 1 al 31, o déjalo vacío." };
    const r = m.cambiarDiaRecurrente(db(), recurrenteId, dia);
    refrescar();
    return { ok: true, mensaje: `${r?.concepto}: ${dia ? `previsto el día ${dia} de cada mes` : "sin día fijo"}` };
  });
}
