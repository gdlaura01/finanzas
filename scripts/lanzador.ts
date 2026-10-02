/**
 * Lo que hace el icono «Finanzas»: abre la app sin terminal.
 *
 * - Si ya está abierta, solo abre el navegador.
 * - Si no, enseña al momento una página «Abriendo Finanzas…», prepara lo que haga falta
 *   (instalar tras una actualización, compilar, migraciones), arranca el servidor oculto y
 *   la página salta a la app en cuanto responde.
 * - El servidor se cierra solo tras 15 minutos sin ninguna pestaña abierta.
 *
 * Todo queda anotado en data/lanzador.log.
 */
import "./entorno";
import { spawn, spawnSync, type SpawnOptions } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const RAIZ = resolve(__dirname, "..");
const DATOS = join(RAIZ, "data");
const PUERTO = Number(process.env.PORT ?? 3000);
const URL_APP = `http://localhost:${PUERTO}`;
const MINUTOS_CIERRE = Number(process.env.FINANZAS_CIERRE_MIN) || 15;
const LOG = join(DATOS, "lanzador.log");
const BLOQUEO = join(DATOS, ".lanzador.lock");
const PAGINA = join(DATOS, "abriendo.html");
const windows = process.platform === "win32";

mkdirSync(DATOS, { recursive: true });
if (existsSync(LOG) && statSync(LOG).size > 1_000_000) rmSync(LOG);
const anotar = (m: string) => appendFileSync(LOG, `[${new Date().toLocaleString("es-ES")}] ${m}\n`);

/** ¿Responde nuestra app (y no otra cosa) en el puerto? */
async function estado(): Promise<"nuestra" | "otra" | "nada"> {
  try {
    const r = await fetch(`${URL_APP}/api/latido`, { signal: AbortSignal.timeout(1500) });
    const j = (await r.json().catch(() => null)) as { app?: string } | null;
    return j?.app === "finanzas" ? "nuestra" : "otra";
  } catch {
    return "nada";
  }
}

function abrirNavegador(destino: string) {
  const o: SpawnOptions = { detached: true, stdio: "ignore", windowsHide: true };
  if (windows) spawn("cmd", ["/c", "start", '""', `"${destino}"`], { ...o, windowsVerbatimArguments: true }).unref();
  else spawn(process.platform === "darwin" ? "open" : "xdg-open", [destino], o).on("error", () => {}).unref();
}

/** Página de espera: comprueba cada segundo si la app ya responde y entonces salta a ella. */
function pagina(titulo: string, texto: string, esperar: boolean) {
  const script = esperar
    ? `<script>
// Cuando el icono de la app carga, la app ya responde. Si no, se vuelve a mirar (y a releer esta página por si hubo un error).
const t0 = Date.now();
(function probar() {
  const img = new Image();
  img.onload = () => location.replace(${JSON.stringify(URL_APP)});
  img.onerror = () => (Date.now() - t0 < 3000 ? setTimeout(probar, 1000) : location.reload());
  img.src = ${JSON.stringify(URL_APP + "/icono/192")} + "?" + Date.now();
})();
</script>`
    : "";
  writeFileSync(
    PAGINA,
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${titulo}</title><meta name="viewport" content="width=device-width">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#eee0cc;color:#2a2820;font:16px system-ui,sans-serif}
main{max-width:30rem;padding:2rem;text-align:center}h1{font-size:1.5rem;margin:0 0 .5rem}p{color:#5b574c;line-height:1.5}code{background:#f8f1e6;padding:.1rem .3rem;border-radius:.25rem}
.punto{display:inline-block;width:.6rem;height:.6rem;border-radius:50%;background:#607456;margin-right:.5rem;animation:l 1s infinite alternate}@keyframes l{to{opacity:.2}}</style></head>
<body><main><h1>${esperar ? '<span class="punto"></span>' : ""}${titulo}</h1><p>${texto}</p></main>${script}</body></html>`,
  );
}

function fallo(texto: string): never {
  anotar(`ERROR: ${texto}`);
  pagina("No se ha podido abrir Finanzas", `${texto}<br><br>Los detalles están en <code>${LOG}</code>.`, false);
  rmSync(BLOQUEO, { force: true });
  process.exit(1);
}

/** Ejecuta un paso de preparación, oculto, con su salida en el registro. */
function paso(nombre: string, orden: string) {
  anotar(`${nombre}: ${orden}`);
  // Sin NODE_ENV heredado: cada orden (instalar, compilar) pone el suyo
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== "NODE_ENV")) as NodeJS.ProcessEnv;
  const r = spawnSync(orden, { cwd: RAIZ, shell: true, windowsHide: true, encoding: "utf8", env });
  appendFileSync(LOG, `${r.stdout ?? ""}${r.stderr ?? ""}`);
  if (r.status !== 0) fallo(`Falló el paso «${nombre}».`);
}

const huella = (f: string) => (existsSync(f) ? createHash("sha1").update(readFileSync(f)).digest("hex") : "");
const leer = (f: string) => (existsSync(f) ? readFileSync(f, "utf8").trim() : "");
function versionCodigo() {
  const r = spawnSync("git", ["rev-parse", "HEAD"], { cwd: RAIZ, encoding: "utf8", windowsHide: true });
  return r.status === 0 ? r.stdout.trim() : "sin-git";
}

/** Otro doble clic mientras se prepara: no se arranca dos veces. */
function hayOtroLanzador() {
  const pid = Number(leer(BLOQUEO));
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const e = await estado();
  if (e === "nuestra") {
    anotar("Ya estaba abierta: solo abro el navegador.");
    return abrirNavegador(URL_APP);
  }
  if (e === "otra") {
    pagina("El puerto está ocupado", `Otro programa usa el puerto ${PUERTO}. Ciérralo, o pon otro puerto en <code>PORT</code> dentro de <code>.env.local</code>.`, false);
    abrirNavegador(pathToFileURL(PAGINA).href);
    return anotar(`Puerto ${PUERTO} ocupado por otro programa.`);
  }
  if (hayOtroLanzador()) return abrirNavegador(pathToFileURL(PAGINA).href);
  writeFileSync(BLOQUEO, String(process.pid));

  pagina("Abriendo Finanzas…", "Un momento. Tras una actualización tarda un par de minutos la primera vez.", true);
  abrirNavegador(pathToFileURL(PAGINA).href);
  anotar("Abriendo la app.");

  // Tras «git pull»: dependencias nuevas y volver a compilar
  const marcaInstalado = join(DATOS, ".lanzador-instalado");
  const lock = huella(join(RAIZ, "package-lock.json"));
  if (!existsSync(join(RAIZ, "node_modules")) || leer(marcaInstalado) !== lock) {
    // Exactamente lo del package-lock y sin scripts de instalación: better-sqlite3 trae su binario,
    // y en Windows npm se empeña en compilarlo (pide Visual Studio) si se le deja
    paso("Instalar dependencias", "npm ci --ignore-scripts --no-audit --no-fund");
    writeFileSync(marcaInstalado, lock);
  }
  const marcaCompilado = join(DATOS, ".lanzador-compilado");
  const version = versionCodigo();
  if (!existsSync(join(RAIZ, ".next", "BUILD_ID")) || leer(marcaCompilado) !== version) {
    paso("Compilar", "npm run build");
    writeFileSync(marcaCompilado, version);
  }
  paso("Preparar la base de datos", "npm run db:preparar");

  // El servidor, oculto y por su cuenta: sigue vivo cuando este lanzador termina
  const next = createRequire(join(RAIZ, "package.json")).resolve("next/dist/bin/next");
  const salida = openSync(LOG, "a");
  const hijo = spawn(process.execPath, [next, "start", "-H", "0.0.0.0", "-p", String(PUERTO)], {
    cwd: RAIZ,
    detached: true,
    windowsHide: true,
    stdio: ["ignore", salida, salida],
    env: { ...process.env, NODE_ENV: "production", FINANZAS_CIERRE_MIN: String(MINUTOS_CIERRE) },
  });
  hijo.unref();
  anotar(`Servidor arrancado (proceso ${hijo.pid}).`);

  for (let i = 0; i < 60; i++) {
    if ((await estado()) === "nuestra") {
      anotar("Lista.");
      return rmSync(BLOQUEO, { force: true });
    }
    if (hijo.exitCode != null) fallo("El servidor se ha cerrado al arrancar.");
    await new Promise((r) => setTimeout(r, 1000));
  }
  fallo("La app no ha respondido en un minuto.");
}

main().catch((e) => fallo(String(e?.stack ?? e)));
