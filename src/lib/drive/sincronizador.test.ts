import { describe, expect, it } from "vitest";
import { crearSincronizador, espera, type EstadoSync } from "./sincronizador";
import { homedir } from "node:os";
import { canjearCodigo, ErrorDrive, expandir, olvidarTokenAcceso, subirLibro, tokenAcceso, urlAutorizacion } from "./google";

/** Reloj y temporizadores de mentira: el tiempo solo avanza cuando lo pedimos. */
function entorno(fallos: (Error | null)[] = []) {
  let ahora = Date.parse("2026-10-01T10:00:00Z");
  let timers: { fn: () => void; cuando: number; id: number }[] = [];
  let n = 0;
  const estado: EstadoSync = { estado: "ok", pendiente: false, intentos: 0, proximoIntento: null, ultimoError: null, ultimoOk: null, fileId: null };
  const subidas: (string | null)[] = [];
  let configurado = true;
  const s = crearSincronizador({
    leer: () => ({ ...estado }),
    guardar: (c) => Object.assign(estado, c),
    configurado: () => configurado,
    generar: async () => Buffer.from("libro"),
    subir: async (fileId) => {
      subidas.push(fileId);
      const f = fallos.shift();
      if (f) throw f;
      return fileId ?? "archivo-1";
    },
    ahora: () => ahora,
    programar: (fn, ms) => {
      const id = ++n;
      timers.push({ fn, cuando: ahora + ms, id });
      return id;
    },
    cancelar: (id) => (timers = timers.filter((t) => t.id !== id)),
  });
  /** Avanza el reloj y ejecuta lo que toque, esperando a las subidas. */
  async function avanzar(ms: number) {
    const fin = ahora + ms;
    for (;;) {
      const t = timers.filter((x) => x.cuando <= fin).sort((a, b) => a.cuando - b.cuando)[0];
      if (!t) break;
      timers = timers.filter((x) => x !== t);
      ahora = t.cuando;
      t.fn();
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));
    }
    ahora = fin;
  }
  return { s, estado, subidas, avanzar, setConfigurado: (v: boolean) => (configurado = v), timers: () => timers };
}

describe("sincronización con Drive", () => {
  it("agrupa los cambios: una sola subida unos segundos después del último", async () => {
    const e = entorno();
    e.s.marcarCambio();
    await e.avanzar(1000);
    e.s.marcarCambio();
    e.s.marcarCambio();
    expect(e.estado).toMatchObject({ estado: "pendiente", pendiente: true });
    await e.avanzar(2900);
    expect(e.subidas).toHaveLength(0);
    await e.avanzar(200);
    expect(e.subidas).toEqual([null]);
    expect(e.estado).toMatchObject({ estado: "ok", pendiente: false, fileId: "archivo-1", intentos: 0 });
  });

  it("después sobrescribe el mismo archivo por su fileId", async () => {
    const e = entorno();
    e.s.marcarCambio();
    await e.avanzar(3000);
    e.s.marcarCambio();
    await e.avanzar(3000);
    expect(e.subidas).toEqual([null, "archivo-1"]);
  });

  it("sin internet: reintenta con espera creciente y lo guardado en local no se pierde", async () => {
    const e = entorno([new Error("fetch failed"), new Error("fetch failed")]);
    e.s.marcarCambio();
    await e.avanzar(3000);
    expect(e.estado).toMatchObject({ estado: "error", pendiente: true, intentos: 1, ultimoError: "fetch failed" });
    expect(e.estado.proximoIntento).toBe(new Date(Date.parse("2026-10-01T10:00:03Z") + 10_000).toISOString());
    await e.avanzar(10_000);
    expect(e.estado.intentos).toBe(2);
    // Un cambio durante la espera no adelanta el reintento
    e.s.marcarCambio();
    await e.avanzar(19_000);
    expect(e.subidas).toHaveLength(2);
    await e.avanzar(1000);
    expect(e.subidas).toHaveLength(3);
    expect(e.estado).toMatchObject({ estado: "ok", pendiente: false, intentos: 0, ultimoError: null });
  });

  it("un error permanente (permiso retirado) no se reintenta solo; el botón sí", async () => {
    const e = entorno([new ErrorDrive("Vuelve a conectar Drive.", true)]);
    e.s.marcarCambio();
    await e.avanzar(3000);
    expect(e.estado).toMatchObject({ estado: "error", proximoIntento: null });
    expect(e.timers()).toHaveLength(0);
    await e.s.sincronizarAhora();
    expect(e.estado.estado).toBe("ok");
  });

  it("sin Drive conectado, los cambios quedan pendientes y se suben al reanudar", async () => {
    const e = entorno();
    e.setConfigurado(false);
    e.s.marcarCambio();
    await e.avanzar(10_000);
    expect(e.subidas).toHaveLength(0);
    expect(e.estado.pendiente).toBe(true);
    e.setConfigurado(true);
    e.s.reanudar();
    await e.avanzar(3000);
    expect(e.subidas).toHaveLength(1);
  });

  it("espera creciente con tope", () => {
    expect([1, 2, 3, 4].map((n) => espera(n))).toEqual([10_000, 20_000, 40_000, 80_000]);
    expect(espera(20)).toBe(30 * 60_000);
  });
});

describe("cliente de Google", () => {
  const cred = { clientId: "id", clientSecret: "secreto" };
  const respuesta = (status: number, cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });

  it("«~» en las rutas es tu carpeta personal", () => {
    expect(expandir("~/.config/finanzas/x.json")).toBe(`${homedir()}/.config/finanzas/x.json`);
    expect(expandir("/tmp/a~b")).toBe("/tmp/a~b");
  });
  it("pide permiso duradero y solo para los archivos de la app", () => {
    const u = new URL(urlAutorizacion(cred, "http://localhost:3000/api/drive/callback", "abc"));
    expect(u.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/drive.file");
    expect(u.searchParams.get("access_type")).toBe("offline");
    expect(u.searchParams.get("state")).toBe("abc");
  });
  it("sin refresh token no se puede seguir", async () => {
    await expect(canjearCodigo(cred, "c", "r", async () => respuesta(200, { access_token: "a", expires_in: 3600 }))).rejects.toThrow(/permiso duradero/);
  });
  it("reutiliza el token de acceso mientras no caduca", async () => {
    olvidarTokenAcceso();
    let llamadas = 0;
    const f = (async () => (llamadas++, respuesta(200, { access_token: `t${llamadas}`, expires_in: 3600 }))) as unknown as typeof fetch;
    expect(await tokenAcceso(cred, "r", f, 0)).toBe("t1");
    expect(await tokenAcceso(cred, "r", f, 1000)).toBe("t1");
    expect(await tokenAcceso(cred, "r", f, 3_600_000)).toBe("t2");
  });
  it("sobrescribe por fileId; si lo borraste en Drive, crea otro", async () => {
    const pedidas: string[] = [];
    const f = (async (url: string, init: RequestInit) => {
      pedidas.push(`${init.method} ${url.split("?")[0]}`);
      if (init.method === "PATCH") return url.includes("borrado") ? respuesta(404, {}) : respuesta(200, { id: "abc" });
      return respuesta(200, { id: "nuevo" });
    }) as unknown as typeof fetch;
    expect(await subirLibro("t", "abc", "Finanzas.xlsx", Buffer.from("x"), f)).toBe("abc");
    expect(await subirLibro("t", "borrado", "Finanzas.xlsx", Buffer.from("x"), f)).toBe("nuevo");
    expect(pedidas).toEqual([
      "PATCH https://www.googleapis.com/upload/drive/v3/files/abc",
      "PATCH https://www.googleapis.com/upload/drive/v3/files/borrado",
      "POST https://www.googleapis.com/upload/drive/v3/files",
    ]);
  });
  it("un error de Drive llega como ErrorDrive", async () => {
    const f = (async () => respuesta(500, { error: { message: "Backend Error" } })) as unknown as typeof fetch;
    await expect(subirLibro("t", null, "x", Buffer.from("x"), f)).rejects.toThrow("Drive respondió 500: Backend Error");
  });
});
