"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Pencil } from "lucide-react";
import { useAvisar } from "@/components/app/avisos";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Resultado } from "@/lib/auth/exigir";
import { cn } from "@/lib/utils";

/** Lanza una acción del servidor y enseña su resultado en el aviso de abajo. */
export function useAccion() {
  const avisar = useAvisar();
  const [enviando, iniciar] = useTransition();
  const lanzar = (fn: () => Promise<Resultado>, alAcabar?: (r: Resultado) => void) =>
    iniciar(async () => {
      const r = await fn();
      // Los errores de cada campo ya salen junto al campo
      if (r.ok || r.error || !r.errores) avisar(r.ok ? r.mensaje : (r.error ?? "No se ha podido guardar."));
      alAcabar?.(r);
    });
  return { enviando, lanzar };
}

/** Tarjeta de un elemento: borde de color, título, detalle y sus controles. */
export function Tarjeta({ color, titulo, detalle, meta, apagado, children }: { color?: string; titulo: React.ReactNode; detalle?: React.ReactNode; meta?: React.ReactNode; apagado?: boolean; children?: React.ReactNode }) {
  return (
    <li className={cn("flex flex-col gap-3 rounded-xl border border-l-4 border-linea-suave bg-papel p-4 sm:flex-row sm:items-center", apagado && "bg-papel-2 opacity-75")} style={{ borderLeftColor: color ?? "var(--color-linea)" }}>
      <div className="min-w-0 flex-1">
        <p className="font-bold">{titulo}</p>
        {detalle && <p className="text-sm text-tinta-2">{detalle}</p>}
        {meta && <p className="mt-0.5 text-xs text-tinta-3">{meta}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">{children}</div>
    </li>
  );
}

export function Interruptor({ activo, etiqueta, titulo, disabled, alCambiar }: { activo: boolean; etiqueta: string; titulo?: string; disabled?: boolean; alCambiar: (v: boolean) => void }) {
  return (
    <label title={titulo} className={cn("inline-flex cursor-pointer select-none items-center gap-2 text-sm", disabled && "cursor-not-allowed opacity-60")}>
      <button
        type="button"
        role="switch"
        aria-checked={activo}
        disabled={disabled}
        onClick={() => alCambiar(!activo)}
        className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oliva/40", activo ? "bg-oliva" : "bg-linea")}
      >
        <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-papel shadow transition-transform", activo && "translate-x-4")} />
      </button>
      {etiqueta}
    </label>
  );
}

/** ↑ ↓ para cambiar el orden. */
export function Orden({ nombre, primero, ultimo, mover }: { nombre: string; primero: boolean; ultimo: boolean; mover: (dir: -1 | 1) => Promise<Resultado> }) {
  const { enviando, lanzar } = useAccion();
  return (
    <span className="inline-flex gap-1">
      <Button variant="ghost" size="icon" disabled={primero || enviando} aria-label={`Subir ${nombre}`} onClick={() => lanzar(() => mover(-1))}>
        <ArrowUp />
      </Button>
      <Button variant="ghost" size="icon" disabled={ultimo || enviando} aria-label={`Bajar ${nombre}`} onClick={() => lanzar(() => mover(1))}>
        <ArrowDown />
      </Button>
    </span>
  );
}

type Errores = Record<string, string>;

/**
 * Botón (lápiz o «+ Nuevo…») que abre un formulario en una ventana. Al enviarlo manda
 * los campos tal cual; los errores vuelven por campo. Con `borrar`, ofrece borrar con confirmación.
 */
export function Editor({
  nuevo,
  textoBoton,
  nombre,
  titulo,
  descripcion,
  enviar,
  borrar,
  textoBorrar = "Borrar",
  children,
}: {
  nuevo?: boolean;
  textoBoton?: string;
  nombre: string;
  titulo: string;
  descripcion?: React.ReactNode;
  enviar: (f: Record<string, string>) => Promise<Resultado>;
  borrar?: () => Promise<Resultado>;
  textoBorrar?: string;
  children: (errores: Errores) => React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const [errores, setErrores] = useState<Errores>({});
  const [confirmar, setConfirmar] = useState(false);
  const { enviando, lanzar } = useAccion();

  function abrir(v: boolean) {
    setAbierto(v);
    setErrores({});
    setConfirmar(false);
  }

  function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries([...new FormData(e.currentTarget)].map(([k, v]) => [k, String(v)]));
    lanzar(
      () => enviar(f),
      (r) => (r.ok ? abrir(false) : setErrores((r.errores as Errores) ?? {})),
    );
  }

  return (
    <>
      {nuevo ? (
        <Button onClick={() => abrir(true)}>{textoBoton}</Button>
      ) : (
        <Button variant="ghost" size="icon" aria-label={`Editar ${nombre}`} onClick={() => abrir(true)}>
          <Pencil />
        </Button>
      )}
      <Dialog open={abierto} onOpenChange={abrir}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{titulo}</DialogTitle>
            {descripcion && <DialogDescription>{descripcion}</DialogDescription>}
          </DialogHeader>
          <form onSubmit={guardar} noValidate className="flex min-h-0 flex-col gap-4 overflow-y-auto px-5 pb-6 pt-2 sm:px-8">
            {children(errores)}
            <div className="flex flex-wrap items-center justify-end gap-2">
              {borrar &&
                (confirmar ? (
                  <span className="mr-auto inline-flex items-center gap-1 text-sm">
                    ¿Seguro?
                    <Button type="button" variant="ghost" size="sm" className="text-burdeos" disabled={enviando} onClick={() => lanzar(borrar, (r) => r.ok && abrir(false))}>
                      Sí, {textoBorrar.toLowerCase()}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmar(false)}>
                      No
                    </Button>
                  </span>
                ) : (
                  <Button type="button" variant="ghost" className="mr-auto text-burdeos" onClick={() => setConfirmar(true)}>
                    {textoBorrar}
                  </Button>
                ))}
              <Button type="button" variant="outline" onClick={() => abrir(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={enviando}>
                {nuevo ? "Añadir" : "Guardar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
