"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormularioRegistro } from "./formulario";
import type { DatosRegistro } from "./tipos";

const Contexto = createContext<(o?: { fecha?: string }) => void>(() => {});
export const useRegistrar = () => useContext(Contexto);

/** Botón flotante «Registrar» y la tecla N, desde cualquier pantalla. */
export function Registro({ datos, children }: { datos: DatosRegistro; children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const [fecha, setFecha] = useState<string | undefined>();
  const abrir = useCallback((o?: { fecha?: string }) => {
    setFecha(o?.fecha);
    setAbierto(true);
  }, []);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "n" && e.key !== "N") return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      e.preventDefault();
      abrir();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [abrir]);

  return (
    <Contexto.Provider value={abrir}>
      {children}
      <button
        type="button"
        onClick={() => abrir()}
        aria-keyshortcuts="N"
        className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full bg-terracota px-5 py-3 text-base font-bold text-[#fff8f0] shadow-[0_8px_24px_-8px_rgba(122,59,35,.6)] hover:bg-[#a45a3e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oliva focus-visible:ring-offset-2 md:bottom-6 md:right-6"
      >
        <Plus className="size-5" aria-hidden /> Registrar
      </button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent tamano="grande" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Registrar un movimiento</DialogTitle>
            <DialogDescription>
              <kbd className="rounded border border-linea bg-campo px-1 text-xs">Intro</kbd> guarda y deja el foco en el concepto. La fecha de cargo es la que decide el mes.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-2 sm:px-8">{abierto && <FormularioRegistro datos={datos} fechaInicial={fecha} />}</div>
        </DialogContent>
      </Dialog>
    </Contexto.Provider>
  );
}
