import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import { accesoDesdeEntorno, comprobarCredenciales } from "./credenciales";
import { actualizarEnv, escaparDolar } from "./entorno";
import { crearLimitador } from "./limite";
import { destinoSeguro, DURACION_SESION_S, firmarSesion, verificarSesion } from "./sesion";

const SECRETO = "s".repeat(40);
const hash = bcrypt.hashSync("clave-segura-1", 4);

describe("sesión firmada", () => {
  it("una cookie firmada con el secreto es válida y devuelve el correo", async () => {
    const t = await firmarSesion("laura@example.com", SECRETO);
    expect(await verificarSesion(t, SECRETO, "Laura@Example.com")).toBe("laura@example.com");
  });
  it("se rechaza con otro secreto, otro correo, manipulada o sin cookie", async () => {
    const t = await firmarSesion("laura@example.com", SECRETO);
    expect(await verificarSesion(t, "x".repeat(40))).toBeNull();
    expect(await verificarSesion(t, SECRETO, "otra@example.com")).toBeNull();
    expect(await verificarSesion(t.slice(0, -2) + "xx", SECRETO)).toBeNull();
    expect(await verificarSesion(undefined, SECRETO)).toBeNull();
  });
  it("caduca a los 30 días", async () => {
    const t = await firmarSesion("laura@example.com", SECRETO, Date.now() - (DURACION_SESION_S + 60) * 1000);
    expect(await verificarSesion(t, SECRETO)).toBeNull();
  });
  it("exige un secreto de al menos 32 caracteres", async () => {
    await expect(firmarSesion("a@b.es", "corto")).rejects.toThrow(/32 caracteres/);
  });
});

describe("credenciales", () => {
  const acceso = { email: "laura@example.com", hash };
  it("acepta el correo sin importar mayúsculas ni espacios", async () => {
    expect(await comprobarCredenciales(" Laura@Example.com ", "clave-segura-1", acceso)).toBe(true);
  });
  it("rechaza contraseña o correo incorrectos", async () => {
    expect(await comprobarCredenciales("laura@example.com", "otra", acceso)).toBe(false);
    expect(await comprobarCredenciales("otra@example.com", "clave-segura-1", acceso)).toBe(false);
  });
  it("avisa si faltan variables o el hash llegó sin escapar", () => {
    expect(() => accesoDesdeEntorno({})).toThrow(/crear-acceso/);
    // Así llega el hash si se escribe en .env.local sin escapar los $: Next se come las partes.
    expect(() => accesoDesdeEntorno({ APP_EMAIL: "a@b.es", APP_PASSWORD_HASH: "b" })).toThrow(/\\\$/);
    expect(accesoDesdeEntorno({ APP_EMAIL: "A@B.es", APP_PASSWORD_HASH: hash }).email).toBe("a@b.es");
  });
});

describe(".env.local", () => {
  it("escapa los $ del hash", () => {
    expect(escaparDolar("$2b$12$abc")).toBe("\\$2b\\$12\\$abc");
  });
  it("sustituye las claves existentes y conserva el resto", () => {
    const antes = "DB_PATH=./data/finanzas.db\nAPP_EMAIL=vieja@x.es\n";
    expect(actualizarEnv(antes, { APP_EMAIL: "nueva@x.es", SESSION_SECRET: "abc" })).toBe(
      "DB_PATH=./data/finanzas.db\nAPP_EMAIL=nueva@x.es\nSESSION_SECRET=abc\n",
    );
    expect(actualizarEnv("", { A: "1" })).toBe("A=1\n");
  });
});

describe("límite de intentos", () => {
  it("bloquea 30 s tras 5 fallos, dobla el bloqueo y un acierto lo reinicia", () => {
    const l = crearLimitador();
    for (let i = 0; i < 4; i++) l.fallo(0);
    expect(l.bloqueadoHasta(0)).toBeNull();
    l.fallo(0);
    expect(l.bloqueadoHasta(0)).toBe(30_000);
    expect(l.bloqueadoHasta(30_000)).toBeNull();
    for (let i = 0; i < 5; i++) l.fallo(30_000);
    expect(l.bloqueadoHasta(30_000)).toBe(90_000);
    l.exito();
    expect(l.bloqueadoHasta(30_000)).toBeNull();
  });
});

describe("vuelta tras entrar", () => {
  it("solo permite rutas internas", () => {
    expect(destinoSeguro("/movimientos?mes=2026-10")).toBe("/movimientos?mes=2026-10");
    for (const d of ["https://malo.com", "//malo.com", "/\\malo.com", "/entrar", "", null, undefined]) expect(destinoSeguro(d)).toBe("/");
  });
});
