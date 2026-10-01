"use client";

import { useEffect } from "react";

/** Mientras la pestaña esté abierta, avisa cada minuto: así la app no se cierra sola mientras la usas. */
export function Latido() {
  useEffect(() => {
    const avisar = () => void fetch("/api/latido", { method: "POST", keepalive: true }).catch(() => {});
    avisar();
    const id = setInterval(avisar, 60_000);
    const alVolver = () => document.visibilityState === "visible" && avisar();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, []);
  return null;
}
