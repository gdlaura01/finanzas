"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { marcarCierreVisto } from "@/app/(app)/acciones-plan";

export function BotonCierreVisto({ mes }: { mes: string }) {
  const [enviando, iniciar] = useTransition();
  return (
    <Button variant="outline" size="sm" disabled={enviando} onClick={() => iniciar(async () => void (await marcarCierreVisto(mes)))}>
      Entendido
    </Button>
  );
}
