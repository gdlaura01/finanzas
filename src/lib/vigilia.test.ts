import { describe, expect, it, vi } from "vitest";
import { crearVigilia } from "./vigilia";

describe("cierre automático", () => {
  const montar = (ocupado = false) => {
    let t = 0;
    const salir = vi.fn();
    const v = crearVigilia({ ahora: () => t, minutos: 15, ocupado: () => ocupado, salir });
    return { v, salir, pasar: (min: number) => void (t += min * 60_000) };
  };
  it("cierra a los 15 minutos sin señales, no antes", () => {
    const { v, salir, pasar } = montar();
    pasar(14);
    expect(v.revisar()).toBe(false);
    pasar(1);
    expect(v.revisar()).toBe(true);
    expect(salir).toHaveBeenCalledOnce();
  });
  it("cada señal (pestaña abierta, móvil) vuelve a contar desde cero", () => {
    const { v, salir, pasar } = montar();
    pasar(14);
    v.latido();
    pasar(14);
    expect(v.revisar()).toBe(false);
    expect(salir).not.toHaveBeenCalled();
  });
  it("espera a que acabe la copia en Drive, pero no para siempre", () => {
    const { v, salir, pasar } = montar(true);
    pasar(20);
    expect(v.revisar()).toBe(false);
    pasar(5);
    expect(v.revisar()).toBe(true);
    expect(salir).toHaveBeenCalledOnce();
  });
});
