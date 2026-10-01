import Link from "next/link";
import { Download, ExternalLink } from "lucide-react";
import { BotonesDrive } from "@/components/app/acciones-drive";
import { Cabecera } from "@/components/app/marco";
import { Button } from "@/components/ui/button";
import { rutaToken } from "@/lib/drive/google";
import { estadoDrive } from "@/lib/drive/servidor";
import { cn } from "@/lib/utils";

export const metadata = { title: "Ajustes · Finanzas" };

const MENSAJES: Record<string, [string, boolean]> = {
  conectado: ["Drive conectado. Subiendo la primera copia…", false],
  cancelado: ["Has cancelado el permiso en Google. Drive sigue sin conectar.", true],
  estado: ["La vuelta desde Google no coincide con la petición. Vuelve a intentarlo desde aquí.", true],
  error: ["Google no ha dado el permiso. Revisa las credenciales y vuelve a intentarlo.", true],
  "sin-credenciales": ["Falta el archivo de credenciales de Google (GOOGLE_CREDENTIALS_PATH).", true],
};

const fechaHora = (iso: string) =>
  new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }).format(new Date(iso));

export default async function Ajustes({ searchParams }: { searchParams: Promise<{ drive?: string }> }) {
  const { drive } = await searchParams;
  const e = estadoDrive();
  const aviso = drive ? MENSAJES[drive] : null;
  return (
    <main className="pb-12">
      <Cabecera titulo="Ajustes" />
      <div className="flex max-w-4xl flex-col gap-6 px-4 pt-3 sm:px-8">
        <p className="text-sm text-tinta-3">Recurrentes, atajos, grupos y reglas de importación se configurarán aquí en la fase de pulido. Por ahora: la copia de tus datos.</p>

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
                <li>En Google Cloud, crea un cliente OAuth de tipo «Aplicación web» con este URI de redirección: <code className="rounded bg-papel-2 px-1">http://localhost:3000/api/drive/callback</code>.</li>
                <li>Descarga su JSON y guárdalo fuera de esta carpeta (por ejemplo en <code className="rounded bg-papel-2 px-1">~/.config/finanzas/google-oauth.json</code>).</li>
                <li>Pon esa ruta en <code className="rounded bg-papel-2 px-1">GOOGLE_CREDENTIALS_PATH</code> en <code className="rounded bg-papel-2 px-1">.env.local</code> y reinicia la app.</li>
              </ol>
              <p className="mt-2 text-xs text-tinta-3">Los pasos detallados están en el README.</p>
            </div>
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
      </div>
    </main>
  );
}
