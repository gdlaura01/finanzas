/** Al arrancar el servidor. Con el icono de Windows, la app se cierra sola cuando deja de usarse. */
export async function register() {
  // La importación va dentro de esta condición para que no entre en la versión «edge»
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const minutos = Number(process.env.FINANZAS_CIERRE_MIN);
    if (minutos > 0) await (await import("./lib/vigilia-servidor")).iniciarVigilia(minutos);
  }
}
