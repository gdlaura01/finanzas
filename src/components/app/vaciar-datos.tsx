"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { useAvisar } from "@/components/app/avisos";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { vaciarTodo } from "@/app/(app)/acciones-vaciar";

/** «Vaciar datos»: pide escribir VACIAR antes de borrar nada. */
export function VaciarDatos() {
  const avisar = useAvisar();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState("");
  const [enviando, iniciar] = useTransition();
  const listo = texto.trim().toUpperCase() === "VACIAR";

  function vaciar(e: React.FormEvent) {
    e.preventDefault();
    iniciar(async () => {
      const r = await vaciarTodo(texto);
      if (!r.ok) return setError(r.error ?? "No se ha podido vaciar.");
      avisar(r.mensaje);
      setAbierto(false);
      setTexto("");
    });
  }

  return (
    <>
      <Button variant="outline" className="border-burdeos/40 text-burdeos hover:bg-burdeos-claro" onClick={() => setAbierto(true)}>
        <Trash2 /> Vaciar datos…
      </Button>
      <Dialog open={abierto} onOpenChange={(v) => (setAbierto(v), setTexto(""), setError(""))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vaciar todos los datos</DialogTitle>
            <DialogDescription>Para empezar de cero, por ejemplo antes de importar el extracto del año completo.</DialogDescription>
          </DialogHeader>
          <form onSubmit={vaciar} className="flex min-h-0 flex-col gap-4 overflow-y-auto px-5 pb-6 pt-2 text-sm sm:px-8">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-[#dcb3aa] bg-burdeos-claro p-3">
                <p className="font-bold text-[#4e1717]">Se borra</p>
                <ul className="mt-1 list-disc pl-5 text-[#4e1717]">
                  <li>Todos los gastos, ingresos, ahorros y traspasos</li>
                  <li>Las importaciones y la carga inicial</li>
                  <li>Saldos y cuadres: todas las cuentas a 0 €</li>
                  <li>Intereses de Ahorro TR y valores de Inversión TR</li>
                </ul>
              </div>
              <div className="rounded-lg border border-[#c9d3b8] bg-oliva-claro p-3">
                <p className="font-bold text-[#2f3a2a]">Se conserva</p>
                <ul className="mt-1 list-disc pl-5 text-[#2f3a2a]">
                  <li>Grupos y presupuestos</li>
                  <li>Calendario</li>
                  <li>Recurrentes, atajos y reglas</li>
                  <li>Tu acceso y la conexión con Drive</li>
                </ul>
              </div>
            </div>
            <p className="text-tinta-2">Antes de borrar se guarda una copia completa en la carpeta <code className="rounded bg-papel-2 px-1">data/copias</code>, por si necesitas volver atrás.</p>
            <Campo id="vaciar-confirmar" etiqueta="Escribe VACIAR para confirmar" error={error}>
              <Input id="vaciar-confirmar" autoFocus autoComplete="off" value={texto} onChange={(e) => (setTexto(e.target.value), setError(""))} aria-invalid={!!error} />
            </Campo>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="destructive" disabled={!listo || enviando}>
                {enviando ? "Vaciando…" : "Vaciar datos"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
