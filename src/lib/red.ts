/** Direcciones de la app en la red de casa, para abrirla desde el móvil. Funciones puras. */
import type { NetworkInterfaceInfo } from "node:os";

/** IPv4 privadas (192.168.x.x, 10.x.x.x, 172.16–31.x.x): las de una red de casa. */
export function esPrivada(ip: string) {
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

/** Las URL con las que el móvil, en la misma wifi, llega a este ordenador. Las 192.168 primero. */
export function direccionesLocales(interfaces: NodeJS.Dict<NetworkInterfaceInfo[]>, puerto: number | string) {
  const ips = Object.values(interfaces)
    .flat()
    .filter((i): i is NetworkInterfaceInfo => !!i && i.family === "IPv4" && !i.internal && esPrivada(i.address))
    .map((i) => i.address);
  return [...new Set(ips)].sort((x, y) => Number(!x.startsWith("192.168.")) - Number(!y.startsWith("192.168.")) || x.localeCompare(y)).map((ip) => `http://${ip}:${puerto}`);
}

/** Si la petición llega desde este mismo ordenador (y no desde el móvil). */
export const esEsteOrdenador = (hostname: string) => ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname);

/**
 * Origen tal como lo escribió el navegador (`http://localhost:3000`, `http://192.168.1.20:3000`).
 * En las rutas, `req.url` lleva la dirección en la que escucha el servidor (0.0.0.0), no esta.
 */
export function origenDe(h: Headers) {
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() || "http";
  return new URL(`${proto}://${host}`);
}
