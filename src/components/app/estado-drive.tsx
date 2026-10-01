"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { RotateCw } from "lucide-react";
import { sincronizarDrive } from "@/app/(app)/acciones-drive";
import type { EstadoDrive } from "@/lib/drive/servidor";
import { cn } from "@/lib/utils";

const hora = (iso: string) => new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }).format(new Date(iso));

/** Indicador discreto del estado de la copia en Drive, con reintento manual. */
export function EstadoDriveIndicador({ inicial, oscuro = false }: { inicial: EstadoDrive; oscuro?: boolean }) {
  const [e, setE] = useState(inicial);
  const [reintentando, iniciar] = useTransition();
  useEffect(() => setE(inicial), [inicial]);

  // Mientras hay algo pendiente se consulta a menudo; si no, de vez en cuando
  useEffect(() => {
    const ms = e.conectado && (e.pendiente || e.estado !== "ok") ? 4000 : 60_000;
    const t = setInterval(async () => {
      try {
        const r = await fetch("/api/drive/estado", { cache: "no-store" });
        if (r.ok) setE(await r.json());
      } catch {
        // Sin conexión con la app: se vuelve a probar en el siguiente ciclo
      }
    }, ms);
    return () => clearInterval(t);
  }, [e.conectado, e.pendiente, e.estado]);

  let punto = "bg-oliva", texto = "Drive: sincronizado", titulo = e.ultimoOk ? `Última copia a las ${hora(e.ultimoOk)}` : "";
  if (!e.conectado) {
    punto = "bg-tinta-3";
    texto = "Drive sin conectar";
    titulo = "Conecta tu Google Drive en Ajustes para tener la copia";
  } else if (e.estado === "error") {
    punto = "bg-burdeos";
    texto = e.proximoIntento ? `Drive: error · reintento a las ${hora(e.proximoIntento)}` : "Drive: error";
    titulo = e.ultimoError ?? "";
  } else if (e.pendiente) {
    punto = "bg-ambar animate-pulse";
    texto = "Drive: cambios pendientes…";
  }

  const clases = cn(
    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
    oscuro ? "border-[#7d8f71] text-[#e9ecdf]" : "border-linea bg-papel text-tinta-2",
  );
  const contenido = (
    <>
      <i className={cn("size-2 shrink-0 rounded-full", punto)} aria-hidden />
      <span className="truncate">{texto}</span>
    </>
  );
  return (
    <div className="flex min-w-0 items-center gap-1" role="status" aria-live="polite" title={titulo}>
      {e.conectado ? <span className={clases}>{contenido}</span> : <Link href="/ajustes?tab=datos" className={cn(clases, "hover:underline")}>{contenido}</Link>}
      {e.conectado && e.estado === "error" && (
        <button
          type="button"
          disabled={reintentando}
          onClick={() =>
            iniciar(async () => {
              await sincronizarDrive();
              const r = await fetch("/api/drive/estado", { cache: "no-store" });
              if (r.ok) setE(await r.json());
            })
          }
          className={cn("grid size-7 place-items-center rounded-full", oscuro ? "text-[#e9ecdf] hover:bg-[#6d8162]" : "text-tinta-2 hover:bg-papel-2")}
          aria-label="Reintentar la copia en Drive"
          title="Reintentar ahora"
        >
          <RotateCw className={cn("size-3.5", reintentando && "animate-spin")} />
        </button>
      )}
    </div>
  );
}
