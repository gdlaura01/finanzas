/**
 * Formato español: 1.234,56 €, dd/mm/aaaa. Importes en céntimos.
 * Sin Intl en los importes para que servidor y navegador pinten exactamente lo mismo.
 */

export const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const miles = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** 123456 → «1.234,56 €»; con `decimales = 0`, «1.235 €». El signo menos es el tipográfico (−). */
export function eur(cent: number, decimales: 0 | 2 = 2) {
  const neg = cent < 0;
  const a = Math.abs(Math.round(cent));
  const s = decimales === 0 ? miles(Math.round(a / 100)) : `${miles(Math.floor(a / 100))},${String(a % 100).padStart(2, "0")}`;
  return `${neg ? "−" : ""}${s} €`;
}

/**
 * Lee un importe escrito a mano y lo devuelve en céntimos.
 * Acepta «12,5», «1.234,56», «1234.56», «1.234», «−3» y «12 €». Vacío → null; ilegible → NaN.
 */
export function leerImporte(texto: string | null | undefined): number | null {
  let s = String(texto ?? "").trim().replace(/[\s€]/g, "").replace(/[−–]/g, "-");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^-?\d*\.?\d*$/.test(s) || s === "-" || s === ".") return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

/** Céntimos → texto para un campo editable: 133191 → «1331,91». */
export function importeACampo(cent: number | null | undefined) {
  if (cent == null) return "";
  const a = Math.abs(cent);
  return `${cent < 0 ? "-" : ""}${Math.floor(a / 100)},${String(a % 100).padStart(2, "0")}`;
}

/** «2026-10-02» → «02/10/2026». */
export function fecha(iso: string) {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/** «2026-10-02» → «02/10». */
export const fechaCorta = (iso: string) => fecha(iso).slice(0, 5);

/** «2026-10» → «octubre 2026». */
export function nombreMes(mes: string) {
  const [a, m] = mes.split("-");
  return `${MESES[Number(m) - 1]} ${a}`;
}

export const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function sumarMeses(mes: string, n: number) {
  const [a, m] = mes.split("-").map(Number);
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

export function diasDelMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

/** El día `dia` del mes, ajustado al último día si el mes es más corto (31 → 30 de noviembre). */
export function fechaEnMes(mes: string, dia: number) {
  return `${mes}-${String(Math.min(dia, diasDelMes(mes))).padStart(2, "0")}`;
}

export function sumarDias(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const esFechaISO = (s: unknown): s is string =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`)) && sumarDias(s, 0) === s;

export const esMes = (s: unknown): s is string => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

/** Hoy en España, como AAAA-MM-DD, sea cual sea la zona horaria del ordenador. */
export function hoy(ahora = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(ahora);
}

/** 0.1634 → «16,3 %». */
export const porcentaje = (x: number, decimales = 1) => `${(Math.round(x * 100 * 10 ** decimales) / 10 ** decimales).toFixed(decimales).replace(".", ",")} %`;

/** Importe compacto para ejes: 150000 → «1.500 €». */
export const eurEje = (cent: number) => eur(cent, 0);

/** «−150,00 €» para lo que sale, sin signo si es cero. */
export const menos = (cent: number) => (cent ? `−${eur(Math.abs(cent))}` : eur(0));

/**
 * Marcas redondas para un eje (en céntimos): pasos de 1, 2, 2,5 o 5 por potencia de 10,
 * como mucho `n` intervalos, cubriendo de `min` a `max`.
 */
export function marcasEje(min: number, max: number, n = 4): number[] {
  if (max <= min) max = min + 100;
  const bruto = (max - min) / n;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((k) => k * pot).find((p) => p >= bruto)!;
  const desde = Math.floor(min / paso) * paso;
  const marcas: number[] = [];
  for (let v = desde; ; v += paso) {
    marcas.push(Math.round(v));
    if (v >= max) return marcas;
  }
}
