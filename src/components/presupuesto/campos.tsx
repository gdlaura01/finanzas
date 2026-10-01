"use client";

import { guardarParametroPlan, guardarPresupuestoGrupo } from "@/app/(app)/acciones-plan";
import { ImporteEditable } from "./importe-editable";

// Envoltorios cliente: el servidor pasa solo datos y aquí se enlazan las acciones.
export function CampoParametro({ clave, valorCent, etiqueta }: { clave: string; valorCent: number; etiqueta: string }) {
  return <ImporteEditable id={`p-${clave}`} valorCent={valorCent} etiqueta={etiqueta} guardar={(t) => guardarParametroPlan(clave, t)} />;
}

export function CampoGrupo({ id, campo, valorCent, etiqueta }: { id: number; campo: "presupuestoCent" | "efectivoPrevistoCent"; valorCent: number; etiqueta: string }) {
  return <ImporteEditable id={`g${id}-${campo}`} valorCent={valorCent} etiqueta={etiqueta} guardar={(t) => guardarPresupuestoGrupo(id, campo, t)} />;
}
