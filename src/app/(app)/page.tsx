import Link from "next/link";
import { Cabecera } from "@/components/app/marco";
import { Button } from "@/components/ui/button";

export default function Panel() {
  return (
    <main>
      <Cabecera titulo="Panel" />
      <div className="mx-4 max-w-2xl rounded-xl border border-linea-suave bg-papel p-6 sm:mx-8">
        <p className="text-tinta-2">
          El panel, con lo que te queda por gastar y tus cuentas, llega en la fase 4. Mientras tanto ya puedes registrar movimientos con el botón <b>Registrar</b> o la
          tecla <kbd className="rounded border border-linea bg-campo px-1 text-xs">N</kbd>, y confirmar tus recurrentes en Movimientos.
        </p>
        <Button asChild className="mt-4">
          <Link href="/movimientos">Ir a Movimientos</Link>
        </Button>
      </div>
    </main>
  );
}
