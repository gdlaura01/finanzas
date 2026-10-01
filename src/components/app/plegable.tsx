"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

const clave = (id: string) => `finanzas:plegable:${id}`;

/** Sección que se abre y se cierra; recuerda en este navegador cómo la dejaste. */
export function Plegable({ id, titulo, resumen, abiertoPorDefecto = false, children }: { id: string; titulo: string; resumen?: React.ReactNode; abiertoPorDefecto?: boolean; children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(abiertoPorDefecto);
  useEffect(() => {
    // Un enlace a #id la abre siempre; si no, como la dejaste.
    if (window.location.hash === `#${id}`) return setAbierto(true);
    try {
      const v = localStorage.getItem(clave(id));
      if (v != null) setAbierto(v === "1");
    } catch {}
  }, [id]);
  return (
    <details
      id={id}
      open={abierto}
      onToggle={(e) => {
        const v = (e.currentTarget as HTMLDetailsElement).open;
        setAbierto(v);
        try {
          localStorage.setItem(clave(id), v ? "1" : "0");
        } catch {}
      }}
      className="group rounded-xl border border-linea-suave bg-papel"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-xl font-bold">{titulo}</h2>
          {resumen && <span className="text-sm text-tinta-3">{resumen}</span>}
        </span>
        <ChevronDown className="size-5 shrink-0 text-tinta-2 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t border-linea-suave px-4 py-4 sm:px-5">{children}</div>
    </details>
  );
}
