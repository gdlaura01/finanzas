"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type Aviso = { texto: string; accion?: { etiqueta: string; hacer: () => void } };
const Contexto = createContext<(a: Aviso | string) => void>(() => {});

/** Mensajes breves abajo en el centro («Guardado…»), con un botón opcional como «Deshacer». */
export function Avisos({ children }: { children: React.ReactNode }) {
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  const avisar = useCallback((a: Aviso | string) => {
    const nuevo = typeof a === "string" ? { texto: a } : a;
    setAviso(nuevo);
    clearTimeout(t.current);
    t.current = setTimeout(() => setAviso(null), nuevo.accion ? 6000 : 2600);
  }, []);
  return (
    <Contexto.Provider value={avisar}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 md:bottom-6">
        {aviso && (
          <div className="pointer-events-auto flex max-w-xl items-center gap-3 rounded-full bg-tinta px-5 py-2.5 text-sm font-semibold text-crema shadow-lg animate-[sube_.15s_ease-out]">
            <span>{aviso.texto}</span>
            {aviso.accion && (
              <button
                type="button"
                className="rounded-full px-2 py-0.5 font-bold text-terracota-claro underline-offset-2 hover:underline"
                onClick={() => {
                  aviso.accion!.hacer();
                  setAviso(null);
                }}
              >
                {aviso.accion.etiqueta}
              </button>
            )}
          </div>
        )}
      </div>
    </Contexto.Provider>
  );
}

export const useAvisar = () => useContext(Contexto);
