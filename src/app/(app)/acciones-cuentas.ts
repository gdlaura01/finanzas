"use server";

import { db } from "@/db";
import * as cu from "@/db/cuentas";
import { datosPanel } from "@/db/panel";
import * as t from "@/db/schema";
import { conSesion, type Resultado } from "@/lib/auth/exigir";
import { trasCambio } from "@/lib/cambios";
import { esFechaISO, esMes, eur, hoy, leerImporte } from "@/lib/formato";
import { INFO_CUENTA } from "@/lib/cuentas";
import { saldos } from "@/lib/panel";

const leer = (texto: string) => {
  const v = leerImporte(texto);
  return v == null || Number.isNaN(v) ? null : v;
};

export async function cuadrarCuenta(cuenta: "imagin" | "ahorro_tr" | "hucha_revolut", texto: string): Promise<Resultado> {
  return conSesion(() => {
    if (!["imagin", "ahorro_tr", "hucha_revolut"].includes(cuenta)) return { ok: false, error: "Cuenta no válida." };
    const v = leer(texto);
    if (v == null) return { ok: false, error: "Escribe el saldo, por ejemplo 2.419,97." };
    const base = db();
    const h = hoy();
    const d = datosPanel(base, h.slice(0, 7), h);
    const calculado = saldos({ cuadres: d.cuadres, movs: d.movs, intereses: d.intereses, valoraciones: d.valoraciones }, h)[cuenta];
    cu.cuadrar(base, cuenta, h, v, calculado);
    trasCambio();
    const dif = calculado == null ? 0 : v - calculado;
    return { ok: true, mensaje: `${INFO_CUENTA[cuenta].nombre} cuadrada${dif ? `: había ${eur(Math.abs(dif))} de diferencia` : ", sin diferencias"}` };
  });
}

export async function anotarValorInversion(fecha: string, texto: string): Promise<Resultado> {
  return conSesion(() => {
    const v = leer(texto);
    if (!esFechaISO(fecha) || fecha > hoy()) return { ok: false, error: "Elige una fecha que no sea futura." };
    if (v == null || v < 0) return { ok: false, error: "Escribe el valor, por ejemplo 1.448,88." };
    cu.anotarValor(db(), fecha, v);
    trasCambio();
    return { ok: true, mensaje: "Valor de Inversión TR anotado" };
  });
}

export async function quitarValorInversion(fecha: string): Promise<Resultado> {
  return conSesion(() => {
    if (!esFechaISO(fecha)) return { ok: false, error: "Fecha no válida." };
    cu.quitarValor(db(), fecha);
    trasCambio();
    return { ok: true, mensaje: "Valor quitado" };
  });
}

export async function guardarInteresMes(mes: string, texto: string): Promise<Resultado> {
  return conSesion(() => {
    const v = texto.trim() ? leer(texto) : 0;
    if (!esMes(mes) || v == null || v < 0) return { ok: false, error: "Escribe el interés, por ejemplo 4,62." };
    cu.guardarInteres(db(), "ahorro_tr", mes, v);
    trasCambio();
    return { ok: true, mensaje: `Interés de ${mes.split("-").reverse().join("/")}: ${eur(v)}` };
  });
}

export async function cambiarMesesColchon(meses: number): Promise<Resultado> {
  return conSesion(() => {
    if (meses !== 3 && meses !== 6) return { ok: false, error: "Elige 3 o 6 meses." };
    db().insert(t.parametros).values({ clave: "colchon_meses", valor: meses }).onConflictDoUpdate({ target: t.parametros.clave, set: { valor: meses } }).run();
    trasCambio();
    return { ok: true, mensaje: `Colchón de ${meses} meses` };
  });
}
