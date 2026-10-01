import type { Metadata } from "next";
import { destinoSeguro } from "@/lib/auth/sesion";
import { FormularioEntrar } from "./formulario";

export const metadata: Metadata = { title: "Entrar · Finanzas" };

export default async function Entrar({ searchParams }: { searchParams: Promise<{ desde?: string }> }) {
  const { desde } = await searchParams;
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-oliva font-titulo text-2xl font-bold text-crema" aria-hidden>
            €
          </span>
          <h1 className="text-3xl font-bold text-tinta">Finanzas</h1>
          <p className="text-sm text-tinta-2">Tus cuentas, en tu ordenador.</p>
        </div>
        <section className="rounded-xl border border-linea-suave bg-papel p-6 shadow-[0_10px_30px_rgba(42,40,32,0.08)]">
          <FormularioEntrar desde={destinoSeguro(desde)} />
        </section>
        <p className="mt-4 text-center text-xs text-tinta-3">La sesión dura 30 días en este navegador.</p>
      </div>
    </main>
  );
}
