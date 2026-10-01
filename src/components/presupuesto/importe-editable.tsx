"use client";

import { useEffect, useState, useTransition } from "react";
import { useAvisar } from "@/components/app/avisos";
import { Input } from "@/components/ui/input";
import { importeACampo } from "@/lib/formato";
import type { Resultado } from "@/lib/auth/exigir";
import { cn } from "@/lib/utils";

/** Importe que se guarda al salir de la casilla (o con Intro). Si no es válido, avisa y vuelve al valor guardado. */
export function ImporteEditable({ id, valorCent, etiqueta, guardar, className }: { id: string; valorCent: number; etiqueta?: string; guardar: (texto: string) => Promise<Resultado>; className?: string }) {
  const avisar = useAvisar();
  const [texto, setTexto] = useState(importeACampo(valorCent));
  const [error, setError] = useState(false);
  const [guardando, iniciar] = useTransition();
  useEffect(() => setTexto(importeACampo(valorCent)), [valorCent]);

  function confirmar() {
    if (texto.trim() === importeACampo(valorCent)) return;
    iniciar(async () => {
      const r = await guardar(texto);
      if (r.ok) {
        setError(false);
        avisar(r.mensaje);
      } else {
        setError(true);
        avisar(r.error ?? "No se ha podido guardar.");
        setTexto(importeACampo(valorCent));
      }
    });
  }

  return (
    <Input
      id={id}
      aria-label={etiqueta}
      inputMode="decimal"
      className={cn("num text-right", guardando && "opacity-60", className)}
      aria-invalid={error}
      value={texto}
      onChange={(e) => {
        setTexto(e.target.value);
        setError(false);
      }}
      onBlur={confirmar}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
        if (e.key === "Escape") setTexto(importeACampo(valorCent));
      }}
    />
  );
}
