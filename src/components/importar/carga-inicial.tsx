"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileSpreadsheet } from "lucide-react";
import { useAvisar } from "@/components/app/avisos";
import { Button } from "@/components/ui/button";
import { hacerCargaInicial, previsualizarCarga, type VistaPreviaCarga } from "@/app/(app)/importar/acciones";
import { eur, mayuscula, nombreMes } from "@/lib/formato";

export function CargaInicial({ hecha }: { hecha: { apuntes: number; pendientes: number } | null }) {
  const avisar = useAvisar();
  const router = useRouter();
  const [enviando, iniciar] = useTransition();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vista, setVista] = useState<VistaPreviaCarga | null>(null);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  if (hecha)
    return (
      <p className="text-sm text-tinta-2">
        Hecha: {hecha.apuntes} apuntes de tu hoja.{" "}
        {hecha.pendientes > 0 ? (
          <>
            Quedan <b>{hecha.pendientes}</b> por revisar.{" "}
            <Link href="/revisar" className="font-bold text-oliva-osc underline">
              Revisarlos por lotes
            </Link>
          </>
        ) : (
          "Todos revisados."
        )}
      </p>
    );

  const formulario = () => {
    const f = new FormData();
    f.set("archivo", archivo!);
    return f;
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-tinta-2">
        Descarga tu hoja «Seguimiento Financiero» de Google Sheets como Excel (Archivo › Descargar › Microsoft Excel) y súbela aquí. El archivo no sale de tu ordenador. Se cargan
        nómina y traspasos del resumen mensual, gastos fijos y variables, y la gasolina con su fecha real; los repostajes que no aparecen en la cuenta se marcan como efectivo.
        Todo llega en «Otros» para que lo revises por lotes. Se hace una sola vez.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={input}
          type="file"
          accept=".xlsx"
          className="sr-only"
          id="carga-archivo"
          onChange={(e) => {
            setArchivo(e.target.files?.[0] ?? null);
            setVista(null);
            setError("");
          }}
        />
        <Button variant="outline" onClick={() => input.current?.click()}>
          <FileSpreadsheet /> {archivo ? "Cambiar archivo" : "Elegir la hoja (.xlsx)"}
        </Button>
        {archivo && <span className="text-sm text-tinta-2">{archivo.name}</span>}
        {archivo && !vista && (
          <Button
            disabled={enviando}
            onClick={() =>
              iniciar(async () => {
                const r = await previsualizarCarga(formulario());
                if (r.ok) setVista(r.vista);
                else setError(r.error);
              })
            }
          >
            Ver qué se va a cargar
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-burdeos">
          {error}
        </p>
      )}
      {vista && (
        <div className="rounded-lg border border-linea-suave bg-campo p-4">
          {vista.avisos.map((a) => (
            <p key={a} className="mb-2 text-sm font-medium text-burdeos">
              {a}
            </p>
          ))}
          <table className="num w-full text-sm">
            <thead className="text-left text-xs text-tinta-3">
              <tr>
                <th className="py-1 font-semibold">Mes</th>
                <th className="py-1 text-right font-semibold">Apuntes</th>
                <th className="py-1 text-right font-semibold">Gasto</th>
                <th className="py-1 text-right font-semibold">Gasolina en efectivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linea-suave">
              {vista.meses.map((m) => (
                <tr key={m.mes}>
                  <td className="py-1.5">{mayuscula(nombreMes(m.mes))}</td>
                  <td className="py-1.5 text-right">{m.apuntes}</td>
                  <td className="py-1.5 text-right">{eur(m.gastos)}</td>
                  <td className="py-1.5 text-right">{m.efectivo || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-tinta-3">Lo que ya tengas en la app (mismo importe y cargo a 2 días o menos) no se repite.</span>
            <Button
              disabled={enviando}
              onClick={() =>
                iniciar(async () => {
                  const r = await hacerCargaInicial(formulario());
                  if (r.ok) {
                    avisar(r.mensaje);
                    router.push("/revisar");
                  } else setError(r.error ?? "No se ha podido cargar.");
                })
              }
            >
              Cargar {vista.total} apuntes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
