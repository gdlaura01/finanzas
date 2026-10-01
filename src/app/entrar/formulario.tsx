"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { entrar, type EstadoEntrar } from "./acciones";

export function FormularioEntrar({ desde }: { desde: string }) {
  const [estado, accion, enviando] = useActionState<EstadoEntrar, FormData>(entrar, {});
  const [ver, setVer] = useState(false);
  return (
    <form action={accion} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="desde" value={desde} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Correo</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required autoFocus defaultValue={estado.email} aria-invalid={!!estado.error} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contrasena">Contraseña</Label>
        <div className="relative">
          <Input id="contrasena" name="contrasena" type={ver ? "text" : "password"} autoComplete="current-password" required className="pr-11" aria-invalid={!!estado.error} />
          <button
            type="button"
            onClick={() => setVer((v) => !v)}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-md text-tinta-3 hover:text-oliva-osc focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={ver}
          >
            {ver ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
      <p role="alert" aria-live="polite" className={estado.error ? "rounded-md border border-[#d9b2a9] bg-burdeos-claro px-3 py-2 text-sm text-[#4e1717]" : "sr-only"}>
        {estado.error}
      </p>
      <Button type="submit" size="lg" disabled={enviando} className="mt-1">
        <LogIn /> {enviando ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
