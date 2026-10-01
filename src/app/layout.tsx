import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import "./globals.css";

const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: "Finanzas",
  description: "Tus finanzas personales, en tu ordenador",
  appleWebApp: { capable: true, title: "Finanzas", statusBarStyle: "default" },
  icons: { icon: [{ url: "/icono/192", type: "image/png" }], apple: [{ url: "/icono/180", sizes: "180x180" }] },
};

export const viewport: Viewport = { themeColor: "#607456" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${figtree.variable} ${bricolage.variable}`}>{children}</body>
    </html>
  );
}
