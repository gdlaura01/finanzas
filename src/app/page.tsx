import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { salir } from "./entrar/acciones";

export default function Inicio() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-6 px-4 py-10">
      <h1 className="text-4xl font-bold">Finanzas</h1>
      <p className="text-tinta-2">Has entrado correctamente. El panel llega en la fase 3; las demás pantallas, en las siguientes.</p>
      <form action={salir}>
        <Button variant="outline">
          <LogOut /> Salir
        </Button>
      </form>
    </main>
  );
}
