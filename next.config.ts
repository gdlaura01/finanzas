import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Solo se usan en el servidor: no hace falta empaquetarlos.
  serverExternalPackages: ["better-sqlite3", "exceljs"],
  experimental: {
    // Los extractos y la hoja de seguimiento se suben desde la pantalla de importar.
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
