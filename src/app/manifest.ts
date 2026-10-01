import type { MetadataRoute } from "next";

/** Para «Añadir a pantalla de inicio» en el móvil: se abre como una app, sin la barra del navegador. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Finanzas",
    short_name: "Finanzas",
    description: "Tus finanzas personales, en tu ordenador",
    lang: "es",
    start_url: "/",
    display: "standalone",
    background_color: "#eee0cc",
    theme_color: "#607456",
    icons: [
      { src: "/icono/192", sizes: "192x192", type: "image/png" },
      { src: "/icono/512", sizes: "512x512", type: "image/png" },
      { src: "/icono/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
