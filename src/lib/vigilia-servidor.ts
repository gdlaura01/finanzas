/** La vigilia del proceso: solo existe si la app se abrió con el icono (FINANZAS_CIERRE_MIN). */
import { crearVigilia } from "./vigilia";

type Vigilia = ReturnType<typeof crearVigilia>;
const g = globalThis as unknown as { __vigilia?: Vigilia };

/** Una pestaña abierta (en el ordenador o en el móvil) avisa de que sigue ahí. */
export const latido = () => g.__vigilia?.latido();

export async function iniciarVigilia(minutos: number) {
  if (g.__vigilia) return;
  const { estadoDrive, sincronizador } = await import("./drive/servidor");
  // Retoma la copia en Drive que quedara pendiente al cerrarse la última vez
  sincronizador();
  g.__vigilia = crearVigilia({
    ahora: Date.now,
    minutos,
    ocupado: () => {
      const e = estadoDrive();
      return e.conectado && e.credenciales && e.pendiente && e.intentos === 0;
    },
    salir: () => {
      console.log(`Sin uso en ${minutos} minutos: la app se cierra. Ábrela otra vez con el icono.`);
      process.exit(0);
    },
  });
  setInterval(() => g.__vigilia?.revisar(), 30_000).unref();
  console.log(`Cierre automático: tras ${minutos} minutos sin ninguna pestaña abierta.`);
}
