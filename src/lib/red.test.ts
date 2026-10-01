import { describe, expect, it } from "vitest";
import { direccionesLocales, esEsteOrdenador, esPrivada, origenDe } from "./red";

const i = (address: string, extra: object = {}) => ({ address, family: "IPv4", internal: false, netmask: "", mac: "", cidr: null, ...extra }) as never;

describe("red de casa", () => {
  it("solo IPv4 privadas, sin la interna ni las públicas, las 192.168 primero", () => {
    const r = direccionesLocales(
      { lo: [i("127.0.0.1", { internal: true })], eth0: [i("10.0.0.5"), i("fe80::1", { family: "IPv6" })], wlan0: [i("192.168.1.20")], vpn: [i("85.1.2.3")] },
      3000,
    );
    expect(r).toEqual(["http://192.168.1.20:3000", "http://10.0.0.5:3000"]);
  });
  it("rangos privados", () => {
    expect(["172.16.0.1", "172.31.255.1", "10.1.1.1", "192.168.0.2"].every(esPrivada)).toBe(true);
    expect(["172.32.0.1", "8.8.8.8", "192.169.1.1"].some(esPrivada)).toBe(false);
  });
  it("distingue este ordenador del móvil", () => {
    expect(esEsteOrdenador("localhost")).toBe(true);
    expect(esEsteOrdenador("192.168.1.20")).toBe(false);
  });
  it("el origen sale de la cabecera Host, no de la dirección en la que escucha el servidor", () => {
    expect(origenDe(new Headers({ host: "192.168.1.20:3000" })).toString()).toBe("http://192.168.1.20:3000/");
    expect(origenDe(new Headers({ host: "localhost:3000" })).hostname).toBe("localhost");
    expect(origenDe(new Headers({ host: "x", "x-forwarded-host": "localhost:3000", "x-forwarded-proto": "https" })).toString()).toBe("https://localhost:3000/");
  });
});
