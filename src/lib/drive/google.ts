/**
 * Google Drive sin dependencias: OAuth 2.0 y subida con fetch.
 * Permiso mínimo `drive.file`: la app solo ve el archivo que ella misma crea.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

/** Cookie con el `state` de OAuth mientras vas y vuelves de Google. */
export const COOKIE_ESTADO = "finanzas_oauth";
export const ALCANCE = "https://www.googleapis.com/auth/drive.file";
const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Ruta con «~» al principio: tu carpeta personal. */
export const expandir = (ruta: string) => resolve(ruta.replace(/^~(?=$|[\\/])/, homedir()));

export type Credenciales = { clientId: string; clientSecret: string };
type Fetch = typeof fetch;

/** Lee el JSON que descargas de Google Cloud (tipo «Aplicación web» o «Escritorio»). */
export function leerCredenciales(ruta = process.env.GOOGLE_CREDENTIALS_PATH): Credenciales | null {
  if (!ruta || !existsSync(expandir(ruta))) return null;
  const j = JSON.parse(readFileSync(expandir(ruta), "utf8"));
  const c = j.web ?? j.installed ?? j;
  if (!c.client_id || !c.client_secret) throw new Error("El archivo de credenciales de Google no tiene client_id y client_secret.");
  return { clientId: c.client_id, clientSecret: c.client_secret };
}

/** El token se guarda fuera del repositorio: ~/.config/finanzas/google-token.json salvo que digas otra ruta. */
export const rutaToken = () => expandir(process.env.GOOGLE_TOKEN_PATH || join(homedir(), ".config", "finanzas", "google-token.json"));

export function leerToken(): string | null {
  const r = rutaToken();
  if (!existsSync(r)) return null;
  return JSON.parse(readFileSync(r, "utf8")).refresh_token ?? null;
}

export function guardarToken(refreshToken: string) {
  const r = rutaToken();
  mkdirSync(dirname(r), { recursive: true, mode: 0o700 });
  writeFileSync(r, JSON.stringify({ refresh_token: refreshToken }), { mode: 0o600 });
  chmodSync(r, 0o600);
}

export const borrarToken = () => rmSync(rutaToken(), { force: true });

export function urlAutorizacion(c: Credenciales, redirectUri: string, estado: string) {
  const q = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: ALCANCE,
    access_type: "offline",
    prompt: "consent",
    state: estado,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

async function pedirToken(cuerpo: Record<string, string>, f: Fetch) {
  const r = await f("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(cuerpo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErrorDrive(`Google rechazó el acceso (${j.error ?? r.status}). Vuelve a conectar Drive.`, r.status === 400 || r.status === 401);
  return j as { access_token: string; expires_in: number; refresh_token?: string };
}

export async function canjearCodigo(c: Credenciales, code: string, redirectUri: string, f: Fetch = fetch) {
  const t = await pedirToken({ code, client_id: c.clientId, client_secret: c.clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }, f);
  if (!t.refresh_token) throw new ErrorDrive("Google no ha devuelto un permiso duradero. Quita el acceso de la app en tu cuenta de Google y vuelve a conectar.", true);
  return t.refresh_token;
}

/** Error de Drive. `permanente`: reintentar no lo arregla (permiso retirado, credenciales malas). */
export class ErrorDrive extends Error {
  constructor(mensaje: string, readonly permanente = false) {
    super(mensaje);
  }
}

let cache: { token: string; caduca: number; refresh: string } | null = null;

export async function tokenAcceso(c: Credenciales, refresh: string, f: Fetch = fetch, ahora = Date.now()) {
  if (cache && cache.refresh === refresh && cache.caduca > ahora + 60_000) return cache.token;
  const t = await pedirToken({ refresh_token: refresh, client_id: c.clientId, client_secret: c.clientSecret, grant_type: "refresh_token" }, f);
  cache = { token: t.access_token, caduca: ahora + t.expires_in * 1000, refresh };
  return t.access_token;
}

export const olvidarTokenAcceso = () => {
  cache = null;
};

/**
 * Sube el libro. Si ya existe (fileId), lo sobrescribe; si no existe o lo borraste en Drive, lo crea.
 * Devuelve el fileId.
 */
export async function subirLibro(acceso: string, fileId: string | null, nombre: string, datos: Buffer, f: Fetch = fetch): Promise<string> {
  const auth = { Authorization: `Bearer ${acceso}` };
  if (fileId) {
    const r = await f(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media&fields=id`, {
      method: "PATCH",
      headers: { ...auth, "Content-Type": MIME_XLSX },
      body: new Uint8Array(datos),
    });
    if (r.ok) return ((await r.json()) as { id: string }).id;
    if (r.status !== 404) throw await errorDe(r);
    // Lo borraste en Drive: se crea otro
  }
  const limite = `finanzas${Date.now().toString(36)}`;
  const cuerpo = Buffer.concat([
    Buffer.from(`--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: nombre, mimeType: MIME_XLSX })}\r\n--${limite}\r\nContent-Type: ${MIME_XLSX}\r\n\r\n`),
    datos,
    Buffer.from(`\r\n--${limite}--`),
  ]);
  const r = await f("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
    method: "POST",
    headers: { ...auth, "Content-Type": `multipart/related; boundary=${limite}` },
    body: new Uint8Array(cuerpo),
  });
  if (!r.ok) throw await errorDe(r);
  return ((await r.json()) as { id: string }).id;
}

async function errorDe(r: Response) {
  const j = (await r.json().catch(() => ({}))) as { error?: { message?: string } };
  if (r.status === 401) olvidarTokenAcceso();
  return new ErrorDrive(`Drive respondió ${r.status}${j.error?.message ? `: ${j.error.message}` : ""}`, r.status === 403 && /insufficient|scope/i.test(j.error?.message ?? ""));
}
