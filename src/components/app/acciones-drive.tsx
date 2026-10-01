"use client";

import { useTransition } from "react";
import { RotateCw, Unplug } from "lucide-react";
import { useAvisar } from "@/components/app/avisos";
import { Button } from "@/components/ui/button";
import { desconectarDrive, sincronizarDrive } from "@/app/(app)/acciones-drive";

export function BotonesDrive() {
  const avisar = useAvisar();
  const [enviando, iniciar] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      <Button disabled={enviando} onClick={() => iniciar(async () => {
        const r = await sincronizarDrive();
        avisar(r.ok ? r.mensaje : (r.error ?? "No se ha podido subir la copia."));
      })}>
        <RotateCw className={enviando ? "animate-spin" : ""} /> Sincronizar ahora
      </Button>
      <Button variant="ghost" disabled={enviando} onClick={() => iniciar(async () => {
        const r = await desconectarDrive();
        avisar(r.ok ? r.mensaje : (r.error ?? "No se ha podido desconectar."));
      })}>
        <Unplug /> Desconectar
      </Button>
    </div>
  );
}
