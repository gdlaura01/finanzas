/** Al arrancar: dónde abrir la app en este ordenador y desde el móvil. */
import { networkInterfaces } from "node:os";
import { direccionesLocales } from "../src/lib/red";

const puerto = process.env.PORT ?? 3000;
const red = direccionesLocales(networkInterfaces(), puerto);
console.log(`\n  En este ordenador:  http://localhost:${puerto}`);
if (red.length) console.log(`  Desde el móvil (misma wifi):  ${red.join("  ·  ")}\n`);
else console.log("  No se ha encontrado la red de casa: conecta el ordenador a la wifi para usarla desde el móvil.\n");
