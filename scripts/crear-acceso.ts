/**
 * Crea o cambia tu acceso: pide correo y contraseña, guarda en .env.local
 * el hash bcrypt (nunca la contraseña) y un SESSION_SECRET nuevo.
 *
 *   npm run crear-acceso
 *
 * Cambiar el secreto cierra las sesiones abiertas en todos los navegadores.
 */
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import bcrypt from "bcryptjs";
import { actualizarEnv, escaparDolar } from "../src/lib/auth/entorno";

const RUTA = resolve(process.cwd(), ".env.local");

async function preguntar() {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
  const lineas = rl[Symbol.asyncIterator]();
  let oculto = false;
  // Con terminal, no se ve lo que escribes en la contraseña.
  const escribir = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput.bind(rl);
  (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s) => {
    if (!oculto) escribir(s);
  };
  const pedir = async (texto: string, ocultar = false) => {
    oculto = false;
    process.stdout.write(texto);
    oculto = ocultar;
    const r = await lineas.next();
    oculto = false;
    if (ocultar && process.stdin.isTTY) process.stdout.write("\n");
    if (r.done) throw new Error("Entrada cerrada antes de tiempo.");
    return String(r.value).trim();
  };

  try {
    const email = await pedir("Correo: ");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Ese correo no parece válido.");
    const c1 = await pedir("Contraseña (mínimo 8 caracteres): ", true);
    if (c1.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
    const c2 = await pedir("Repite la contraseña: ", true);
    if (c1 !== c2) throw new Error("Las contraseñas no coinciden.");
    return { email, contrasena: c1 };
  } finally {
    rl.close();
  }
}

async function main() {
  const { email, contrasena } = await preguntar();
  const hash = await bcrypt.hash(contrasena, 12);
  const secreto = randomBytes(48).toString("base64url");
  const antes = existsSync(RUTA) ? readFileSync(RUTA, "utf8") : "";
  writeFileSync(
    RUTA,
    actualizarEnv(antes, {
      APP_EMAIL: email.trim().toLowerCase(),
      APP_PASSWORD_HASH: escaparDolar(hash),
      SESSION_SECRET: secreto,
    }),
    { mode: 0o600 },
  );
  chmodSync(RUTA, 0o600);
  console.log(`Acceso guardado en ${RUTA}. Reinicia la app si estaba abierta.`);
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
