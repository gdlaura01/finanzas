import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";
import { direccionesLocales } from "./src/lib/red";

const nextConfig: NextConfig = {
  // Solo se usan en el servidor: no hace falta empaquetarlos.
  serverExternalPackages: ["better-sqlite3", "exceljs"],
  // En `npm run dev`, deja que el móvil de casa cargue la app
  allowedDevOrigins: direccionesLocales(networkInterfaces(), 0).map((u) => new URL(u).hostname),
  experimental: {
    // Los extractos y la hoja de seguimiento se suben desde la pantalla de importar.
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
