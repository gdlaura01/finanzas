"use client";

import { useState, useTransition } from "react";
import { useAvisar } from "@/components/app/avisos";
import { ImporteEditable } from "@/components/presupuesto/importe-editable";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { anotarValorInversion, cambiarMesesColchon, cuadrarCuenta, guardarInteresMes, quitarValorInversion } from "@/app/(app)/acciones-cuentas";
import { eur } from "@/lib/formato";
import { cn } from "@/lib/utils";

/** «Cuadrar con el banco» o, en Inversión TR, «Anotar el valor de hoy». */
export function BotonCuadrar({ cuenta, nombre, calculado, hoy }: { cuenta: "imagin" | "ahorro_tr" | "inversion_tr" | "hucha_revolut"; nombre: string; calculado: number | null; hoy: string }) {
  const avisar = useAvisar();
  const [abierto, setAbierto] = useState(false);
  const [importe, setImporte] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [error, setError] = useState("");
  const [enviando, iniciar] = useTransition();
  const inversion = cuenta === "inversion_tr";

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    iniciar(async () => {
      const r = inversion ? await anotarValorInversion(fecha, importe) : await cuadrarCuenta(cuenta, importe);
      if (!r.ok) return setError(r.error ?? "No se ha podido guardar.");
      avisar(r.mensaje);
      setAbierto(false);
      setImporte("");
      setError("");
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => setAbierto(true)}>
        {inversion ? "Anotar el valor de hoy" : "Cuadrar con el banco"}
      </Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{inversion ? "Anotar el valor de Inversión TR" : `Cuadrar ${nombre} con el banco`}</DialogTitle>
            <DialogDescription>
              {inversion ? (
                "El que ves en la pestaña «Cartera» de la app de Trade Republic. Con un valor al mes basta: entre dos valores, la app suma lo que aportes."
              ) : (
                <>
                  Ahora la app calcula <b className="num">{calculado == null ? "—" : eur(calculado)}</b>. Escribe lo que ves hoy en el banco (incluido lo ya movido hoy): desde aquí se
                  calculará a partir de este dato.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={guardar} noValidate className="flex flex-col gap-4 px-5 pb-6 pt-2 sm:px-8">
            <div className="grid gap-3 sm:grid-cols-2">
              {inversion && (
                <Campo id="cq-fecha" etiqueta="Fecha">
                  <Input id="cq-fecha" type="date" max={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} />
                </Campo>
              )}
              <Campo id="cq-importe" etiqueta={inversion ? "Valor" : "Saldo real"} error={error}>
                <Input id="cq-importe" autoFocus inputMode="decimal" className="num text-right" placeholder="0,00" value={importe} onChange={(e) => setImporte(e.target.value)} aria-invalid={!!error} />
              </Campo>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={enviando}>
                {inversion ? "Anotar valor" : "Cuadrar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function InteresEditable({ mes, valor, etiqueta }: { mes: string; valor: number; etiqueta: string }) {
  return <ImporteEditable id={`int-${mes}`} valorCent={valor} etiqueta={etiqueta} className="h-8 w-24" guardar={(t) => guardarInteresMes(mes, t)} />;
}

export function QuitarValor({ fecha, texto }: { fecha: string; texto: string }) {
  const avisar = useAvisar();
  const [confirmar, setConfirmar] = useState(false);
  const [enviando, iniciar] = useTransition();
  if (!confirmar)
    return (
      <Button variant="ghost" size="sm" onClick={() => setConfirmar(true)} aria-label={`Quitar el valor del ${texto}`}>
        Quitar
      </Button>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      ¿Quitar?
      <Button
        variant="ghost"
        size="sm"
        className="text-burdeos"
        disabled={enviando}
        onClick={() =>
          iniciar(async () => {
            const r = await quitarValorInversion(fecha);
            avisar(r.ok ? r.mensaje : (r.error ?? "No se ha podido quitar."));
          })
        }
      >
        Sí
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirmar(false)}>
        No
      </Button>
    </span>
  );
}

export function SelectorColchon({ meses }: { meses: number }) {
  const [enviando, iniciar] = useTransition();
  return (
    <div role="radiogroup" aria-label="Meses de colchón" className="flex gap-1 rounded-lg border border-linea-suave bg-papel-2 p-1">
      {[3, 6].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={n === meses}
          disabled={enviando}
          onClick={() => iniciar(async () => void (await cambiarMesesColchon(n)))}
          className={cn("rounded-md px-3 py-1 text-sm font-bold", n === meses ? "bg-oliva text-[#f7efe3]" : "text-tinta-2 hover:bg-linea-suave")}
        >
          {n} meses
        </button>
      ))}
    </div>
  );
}
