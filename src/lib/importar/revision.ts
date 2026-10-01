/**
 * Revisión de la carga inicial: nóminas y traspasos por mes, y gastos agrupados por
 * concepto con una propuesta de grupo. Una decisión vale para todos los apuntes del concepto.
 */
import type { Medio, Tipo } from "@/db/schema";
import { normalizar, sugerir, type Regla } from "@/lib/reglas";

export type FilaRevision = {
  id: number;
  fechaCompra: string;
  fechaCargo: string;
  concepto: string;
  tipo: Tipo;
  medio: Medio;
  importeCent: number;
  grupoId: number | null;
  etiqueta: string | null;
  notas: string | null;
};

export type Fuente = "aprendido" | "regla" | "nada";

export type ConceptoRevision = {
  clave: string;
  concepto: string;
  filas: FilaRevision[];
  /** Lo que mueve en total: negativo si es gasto. */
  total: number;
  meses: string[];
  sugerencia: { grupoId: number; etiqueta: string | null; fuente: Fuente };
};

export function agruparRevision(
  filas: FilaRevision[],
  ctx: { aprendido: Map<string, { grupoId: number; etiqueta: string | null }>; reglas: Regla[]; grupoPorDefecto: number },
) {
  const porMes = new Map<string, FilaRevision[]>();
  const porConcepto = new Map<string, FilaRevision[]>();
  for (const f of filas) {
    if (f.tipo !== "gasto") {
      const mes = f.fechaCargo.slice(0, 7);
      porMes.set(mes, [...(porMes.get(mes) ?? []), f]);
    } else {
      const k = normalizar(f.concepto);
      porConcepto.set(k, [...(porConcepto.get(k) ?? []), f]);
    }
  }
  const conceptos: ConceptoRevision[] = [...porConcepto.entries()].map(([clave, fs]) => {
    fs.sort((a, b) => a.fechaCargo.localeCompare(b.fechaCargo));
    const s = sugerir(fs[0].concepto, ctx.aprendido, ctx.reglas);
    // Si ya traía un grupo distinto de «Otros» (la gasolina en efectivo), se respeta
    const propio = fs.find((f) => f.grupoId && f.grupoId !== ctx.grupoPorDefecto);
    return {
      clave,
      concepto: fs[0].concepto,
      filas: fs,
      total: fs.reduce((a, f) => a - f.importeCent, 0),
      meses: [...new Set(fs.map((f) => f.fechaCargo.slice(0, 7)))].sort(),
      sugerencia: s
        ? { grupoId: s.grupoId, etiqueta: s.etiqueta, fuente: s.fuente }
        : { grupoId: propio?.grupoId ?? ctx.grupoPorDefecto, etiqueta: propio?.etiqueta ?? null, fuente: "nada" as const },
    };
  });
  conceptos.sort((a, b) => b.filas.length - a.filas.length || a.concepto.localeCompare(b.concepto, "es"));
  return {
    meses: [...porMes.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, fs]) => ({ mes, filas: fs })),
    conceptos,
  };
}
