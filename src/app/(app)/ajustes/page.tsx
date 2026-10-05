import { networkInterfaces } from "node:os";
import { asc, sql } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { Download, ExternalLink, Smartphone } from "lucide-react";
import { BotonesDrive } from "@/components/app/acciones-drive";
import { VaciarDatos } from "@/components/app/vaciar-datos";
import { Cabecera } from "@/components/app/marco";
import { ListaAtajos, ListaGrupos, ListaRecurrentes, ListaReglas, NuevaRegla, NuevoAtajo, NuevoGrupo, NuevoRecurrente, ProbarRegla } from "@/components/ajustes/listas";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { leerParametros, todosLosGrupos } from "@/db/movimientos";
import * as t from "@/db/schema";
import { importeRecurrente } from "@/lib/movimientos";
import { rutaToken } from "@/lib/drive/google";
import { estadoDrive } from "@/lib/drive/servidor";
import { direccionesLocales, esEsteOrdenador } from "@/lib/red";
import { cn } from "@/lib/utils";

export const metadata = { title: "Ajustes · Finanzas" };

const MENSAJES: Record<string, [string, boolean]> = {
  conectado: ["Drive conectado. Subiendo la primera copia…", false],
  cancelado: ["Has cancelado el permiso en Google. Drive sigue sin conectar.", true],
  estado: ["La vuelta desde Google no coincide con la petición. Vuelve a intentarlo desde aquí.", true],
  error: ["Google no ha dado el permiso. Revisa las credenciales y vuelve a intentarlo.", true],
  "sin-credenciales": ["Falta el archivo de credenciales de Google (GOOGLE_CREDENTIALS_PATH).", true],
  "desde-el-ordenador": ["Google solo deja dar el permiso desde el ordenador donde corre la app: abre allí http://localhost:3000/ajustes?tab=datos y pulsa «Conectar».", true],
};

const fechaHora = (iso: string) =>
  new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }).format(new Date(iso));

const PESTANAS = {
  recurrentes: "Recurrentes",
  atajos: "Atajos",
  grupos: "Grupos",
  reglas: "Reglas",
  datos: "Copia y datos",
} as const;
type Pestana = keyof typeof PESTANAS;

const INTRO: Record<Pestana, string> = {
  recurrentes: "Lo que se repite cada mes. Los que «se apuntan solos» se registran el día que toca; el resto te espera en Pendientes para que pongas la fecha y el importe reales.",
  atajos: "Botones de «Registrar» que rellenan el formulario de un toque. Allí salen primero los que más usas; a igualdad, en este orden.",
  grupos: "Las categorías del presupuesto. Un grupo con movimientos no se borra: se archiva y deja de ofrecerse.",
  reglas: "Al importar un extracto, proponen el grupo según el concepto. Se miran de arriba abajo y gana la primera que encaja; antes que todas va lo que la app ha aprendido de tus movimientos.",
  datos: "",
};

function datosListas() {
  const base = db();
  const grupos = todosLosGrupos(base);
  const p = leerParametros(base);
  const orden = { entrada: 0, ahorro: 1, interno: 2, interes: 3, valoracion: 4, hucha: 5, gasto: 6 } as const;
  const recurrentes = base
    .select()
    .from(t.recurrentes)
    .all()
    .map((r) => ({ ...r, importe: importeRecurrente(r, p) }))
    .sort((a, b) => Number(b.activo) - Number(a.activo) || orden[a.clase] - orden[b.clase] || (a.dia ?? 99) - (b.dia ?? 99) || a.concepto.localeCompare(b.concepto, "es"));
  const atajos = base.select().from(t.atajos).orderBy(asc(t.atajos.orden)).all();
  const reglas = base.select().from(t.reglasImportacion).orderBy(asc(t.reglasImportacion.prioridad), asc(t.reglasImportacion.id)).all();
  const usos = Object.fromEntries(
    base.select({ id: t.movimientos.grupoId, n: sql<number>`count(*)` }).from(t.movimientos).groupBy(t.movimientos.grupoId).all().map((u) => [u.id, u.n]),
  ) as Record<number, number>;
  return { grupos, recurrentes, atajos, reglas, usos };
}

export default async function Ajustes({ searchParams }: { searchParams: Promise<{ drive?: string; tab?: string }> }) {
  const { drive, tab } = await searchParams;
  const sel: Pestana = drive ? "datos" : tab && tab in PESTANAS ? (tab as Pestana) : "recurrentes";
  const d = sel === "datos" ? null : datosListas();
  const activos = d?.grupos.filter((g) => g.activo) ?? [];
  return (
    <main className="pb-24">
      <Cabecera titulo="Ajustes" />
      <div className="flex max-w-4xl flex-col gap-5 px-4 pt-3 sm:px-8">
        <nav aria-label="Secciones de ajustes" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <ul className="flex min-w-max gap-1 border-b border-linea">
            {(Object.keys(PESTANAS) as Pestana[]).map((k) => (
              <li key={k}>
                <Link
                  href={`/ajustes?tab=${k}`}
                  aria-current={k === sel ? "page" : undefined}
                  className={cn("-mb-px block border-b-2 px-3 py-2 text-sm font-semibold", k === sel ? "border-oliva text-tinta" : "border-transparent text-tinta-3 hover:text-tinta")}
                >
                  {PESTANAS[k]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {sel !== "datos" && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <p className="max-w-2xl text-sm text-tinta-2">{INTRO[sel]}</p>
            <div className="shrink-0">
              {sel === "recurrentes" && <NuevoRecurrente grupos={activos} />}
              {sel === "atajos" && <NuevoAtajo grupos={activos} />}
              {sel === "grupos" && <NuevoGrupo />}
              {sel === "reglas" && <NuevaRegla grupos={activos} />}
            </div>
          </div>
        )}
        {d && sel === "recurrentes" && <ListaRecurrentes recurrentes={d.recurrentes} grupos={d.grupos} />}
        {d && sel === "atajos" && <ListaAtajos atajos={d.atajos} grupos={d.grupos} />}
        {d && sel === "grupos" && <ListaGrupos grupos={d.grupos} usos={d.usos} />}
        {d && sel === "reglas" && (
          <>
            <ProbarRegla reglas={d.reglas} grupos={d.grupos} />
            <ListaReglas reglas={d.reglas} grupos={d.grupos} />
          </>
        )}
        {sel === "datos" && <CopiaYDatos drive={drive} host={(await headers()).get("host") ?? ""} />}
      </div>
    </main>
  );
}

function CopiaYDatos({ drive, host }: { drive?: string; host: string }) {
  const e = estadoDrive();
  const aviso = drive ? MENSAJES[drive] : null;
  const url = new URL(`http://${host || "localhost"}`);
  const enOrdenador = esEsteOrdenador(url.hostname);
  const red = direccionesLocales(networkInterfaces(), url.port || 80);
  return (
    <>
      <section className="rounded-xl border border-linea-suave bg-papel p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Smartphone className="size-5 text-oliva-osc" aria-hidden /> Usar desde el móvil
        </h2>
        {enOrdenador ? (
          red.length ? (
            <>
              <p className="mt-1 text-sm text-tinta-2">Con el móvil en la misma wifi que este ordenador, y la app abierta aquí, entra en:</p>
              <ul className="mt-2 flex flex-col gap-1">
                {red.map((u) => (
                  <li key={u}>
                    <code className="break-all rounded bg-papel-2 px-2 py-1 text-base font-semibold">{u}</code>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-tinta-3">
                Después, en el menú del navegador, «Añadir a pantalla de inicio» para tenerla como una app. Si la dirección cambia (el router puede darle otra al ordenador), aparece aquí
                y al arrancar la app.
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-tinta-2">Este ordenador no está conectado a la red de casa. Conéctalo a la wifi y vuelve aquí para ver la dirección.</p>
          )
        ) : (
          <p className="mt-1 text-sm text-tinta-2">Ya la estás usando desde otro aparato de casa. Funciona mientras el ordenador esté encendido con la app abierta.</p>
        )}
      </section>

        <section className="rounded-xl border border-linea-suave bg-papel p-5 sm:p-6">
          <h2 className="text-xl font-bold">Copia en Google Drive</h2>
          <p className="mt-1 text-sm text-tinta-2">
            Tras cada cambio, la app genera un libro .xlsx con los valores ya calculados (Resumen, Movimientos, Presupuesto, Anuales y Ahorro) y sobrescribe siempre el mismo archivo
            de tu Drive. Si no hay internet, espera y lo reintenta; nunca impide guardar.
          </p>
          {aviso && (
            <p role="status" className={cn("mt-3 rounded-lg border px-3 py-2 text-sm", aviso[1] ? "border-[#dcb3aa] bg-burdeos-claro text-[#4e1717]" : "border-[#c9d3b8] bg-oliva-claro text-[#2f3a2a]")}>
              {aviso[0]}
            </p>
          )}

          {!e.credenciales ? (
            <div className="mt-4 rounded-lg border border-dashed border-linea bg-campo p-4 text-sm">
              <p className="font-bold">Falta un paso en tu ordenador</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-tinta-2">
                <li>En Google Cloud, crea un cliente OAuth de tipo «Aplicación web» con este URI de redirección: <code className="break-all rounded bg-papel-2 px-1">http://localhost:3000/api/drive/callback</code>.</li>
                <li>Descarga su JSON y guárdalo fuera de esta carpeta (por ejemplo en <code className="rounded bg-papel-2 px-1">~/.config/finanzas/google-oauth.json</code>).</li>
                <li>Pon esa ruta en <code className="rounded bg-papel-2 px-1">GOOGLE_CREDENTIALS_PATH</code> en <code className="rounded bg-papel-2 px-1">.env.local</code> y reinicia la app.</li>
              </ol>
              <p className="mt-2 text-xs text-tinta-3">Los pasos detallados están en el README.</p>
            </div>
          ) : !e.conectado && !enOrdenador ? (
            <p className="mt-4 text-sm text-tinta-2">Para conectarlo, abre la app en el ordenador (<code className="rounded bg-papel-2 px-1">http://localhost:3000</code>): Google solo da el permiso allí.</p>
          ) : !e.conectado ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button asChild>
                <a href="/api/drive/conectar">Conectar con Google Drive</a>
              </Button>
              <span className="text-xs text-tinta-3">Solo se pide acceso a los archivos que crea esta app, no al resto de tu Drive.</span>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
                <dt className="text-tinta-3">Estado</dt>
                <dd className={cn("font-semibold", e.estado === "error" && "text-burdeos")}>
                  {e.estado === "error" ? `Error: ${e.ultimoError}` : e.pendiente ? "Cambios pendientes de subir" : "Sincronizado"}
                </dd>
                <dt className="text-tinta-3">Última copia</dt>
                <dd>{e.ultimoOk ? fechaHora(e.ultimoOk) : "todavía ninguna"}</dd>
                {e.proximoIntento && (
                  <>
                    <dt className="text-tinta-3">Próximo intento</dt>
                    <dd>{fechaHora(e.proximoIntento)}</dd>
                  </>
                )}
                <dt className="text-tinta-3">Archivo</dt>
                <dd>
                  {e.fileId ? (
                    <a href={`https://drive.google.com/file/d/${e.fileId}/view`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-oliva-osc underline">
                      {e.nombre} <ExternalLink className="size-3.5" />
                    </a>
                  ) : (
                    e.nombre
                  )}
                </dd>
                <dt className="text-tinta-3">Permiso guardado en</dt>
                <dd className="break-all font-mono text-xs">{rutaToken()}</dd>
              </dl>
              <BotonesDrive />
            </div>
          )}
        </section>

        <section className="rounded-xl border border-linea-suave bg-papel p-5 sm:p-6">
          <h2 className="text-xl font-bold">Copia local</h2>
          <p className="mt-1 text-sm text-tinta-2">Tus datos viven en el archivo SQLite de tu ordenador. Para guardarlo o llevarlo a otro sitio, mira «Copia de seguridad y restauración» en el README.</p>
          <Button asChild variant="outline" className="mt-3">
            <Link href="/api/libro" prefetch={false}>
              <Download /> Descargar el libro (.xlsx)
            </Link>
          </Button>
        </section>

        <section className="rounded-xl border border-linea-suave bg-papel p-5 sm:p-6">
          <h2 className="text-xl font-bold">Empezar de cero</h2>
          <p className="mt-1 text-sm text-tinta-2">
            Borra todos los movimientos y deja las cuentas a 0 €, conservando tu configuración (grupos, presupuestos, calendario, recurrentes, atajos y reglas). Antes guarda una copia.
          </p>
          <div className="mt-3">
            <VaciarDatos />
          </div>
        </section>
    </>
  );
}
