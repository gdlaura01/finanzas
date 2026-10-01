/**
 * Crea el icono «Finanzas» en el escritorio y en el menú Inicio de Windows.
 * Abre la app con un doble clic, sin terminal (ver scripts/lanzador.ts).
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ImageResponse } from "next/og";
import { createElement } from "react";

const RAIZ = resolve(__dirname, "..");

/** El mismo icono que la app: un € claro sobre verde oliva. */
export async function png(tam: number) {
  const r = new ImageResponse(
    createElement(
      "div",
      { style: { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#607456", color: "#f8f1e6", fontSize: tam * 0.56, fontWeight: 700, borderRadius: tam * 0.18 } },
      "€",
    ),
    { width: tam, height: tam },
  );
  return Buffer.from(await r.arrayBuffer());
}

/** Un .ico con varias PNG dentro (Windows Vista en adelante lo admite). */
export function ico(imagenes: { tam: number; datos: Buffer }[]) {
  const cabecera = Buffer.alloc(6 + 16 * imagenes.length);
  cabecera.writeUInt16LE(0, 0);
  cabecera.writeUInt16LE(1, 2);
  cabecera.writeUInt16LE(imagenes.length, 4);
  let desplazamiento = cabecera.length;
  imagenes.forEach(({ tam, datos }, i) => {
    const o = 6 + 16 * i;
    cabecera.writeUInt8(tam >= 256 ? 0 : tam, o);
    cabecera.writeUInt8(tam >= 256 ? 0 : tam, o + 1);
    cabecera.writeUInt16LE(1, o + 4);
    cabecera.writeUInt16LE(32, o + 6);
    cabecera.writeUInt32LE(datos.length, o + 8);
    cabecera.writeUInt32LE(desplazamiento, o + 12);
    desplazamiento += datos.length;
  });
  return Buffer.concat([cabecera, ...imagenes.map((x) => x.datos)]);
}

/** Orden de PowerShell que crea un acceso directo que lanza el .vbs oculto. */
export function ordenAccesoDirecto(raiz: string, icono: string) {
  const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
  const vbs = join(raiz, "scripts", "abrir-finanzas.vbs");
  const crear = (carpeta: string) =>
    `$s = $sh.CreateShortcut((Join-Path ${carpeta} 'Finanzas.lnk')); ` +
    `$s.TargetPath = (Join-Path $env:WINDIR 'System32\\wscript.exe'); $s.Arguments = ${q(`"${vbs}"`)}; ` +
    `$s.WorkingDirectory = ${q(raiz)}; $s.IconLocation = ${q(`${icono},0`)}; $s.Description = 'Abrir Finanzas'; $s.Save()`;
  return `$sh = New-Object -ComObject WScript.Shell; ${crear("([Environment]::GetFolderPath('Desktop'))")}; ${crear("([Environment]::GetFolderPath('Programs'))")}`;
}

async function main() {
  if (process.platform !== "win32") {
    console.log("El icono con doble clic es para Windows. En este sistema, arranca la app con «npm run abrir».");
    return;
  }
  mkdirSync(join(RAIZ, "data"), { recursive: true });
  const icono = join(RAIZ, "data", "finanzas.ico");
  writeFileSync(icono, ico(await Promise.all([16, 32, 48, 256].map(async (tam) => ({ tam, datos: await png(tam) })))));
  const r = spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ordenAccesoDirecto(RAIZ, icono)], { stdio: "inherit" });
  if (r.status !== 0) {
    console.error("No se ha podido crear el acceso directo.");
    process.exit(1);
  }
  console.log("Listo: tienes «Finanzas» en el escritorio y en el menú Inicio. Doble clic para abrirla.");
}

if (require.main === module) main();
