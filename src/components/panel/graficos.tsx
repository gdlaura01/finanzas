"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { eur, eurEje, fecha, marcasEje, MESES, mayuscula, nombreMes } from "@/lib/formato";

// Validados con el comprobador de paletas: se distinguen también con daltonismo.
export const COLOR_INGRESOS = "#4B7A2F";
export const COLOR_GASTO = "#E0895E";
const COLOR_AHORRO = "#607456";
const REJILLA = "#E6D6BF";
const TEXTO_EJE = { fill: "#857B69", fontSize: 11 };

function Leyenda({ items }: { items: { color: string; texto: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta-2">
      {items.map((i) => (
        <li key={i.texto} className="flex items-center gap-1.5">
          <i className="size-2.5 rounded-sm" style={{ background: i.color }} aria-hidden />
          {i.texto}
        </li>
      ))}
    </ul>
  );
}

function Globo({ titulo, filas }: { titulo: string; filas: { color: string; texto: string; valor: number }[] }) {
  return (
    <div className="rounded-lg border border-linea bg-campo px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-bold text-tinta">{titulo}</p>
      {filas.map((f) => (
        <p key={f.texto} className="flex items-center gap-2 text-tinta-2">
          <i className="size-2 rounded-sm" style={{ background: f.color }} aria-hidden />
          {f.texto}
          <b className="num ml-auto pl-3 text-tinta">{eur(f.valor)}</b>
        </p>
      ))}
    </div>
  );
}

/** Tabla equivalente al gráfico, para leer los valores exactos. */
function ComoTabla({ cabecera, filas }: { cabecera: string[]; filas: (string | number)[][] }) {
  return (
    <details className="mt-2 text-xs">
      <summary className="cursor-pointer font-semibold text-oliva-osc">Ver como tabla</summary>
      <table className="num mt-2 w-full">
        <thead className="text-left text-tinta-3">
          <tr>
            {cabecera.map((c, i) => (
              <th key={c} className={i ? "py-1 text-right font-semibold" : "py-1 font-semibold"}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-linea-suave">
          {filas.map((f) => (
            <tr key={String(f[0])}>
              {f.map((v, i) => (
                <td key={i} className={i ? "py-1 text-right" : "py-1"}>
                  {typeof v === "number" ? eur(v) : v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

const ejeEuros = (v: number) => eurEje(v).replace(" €", "");

/** Ingresos frente a gasto total, mes a mes del año. */
export function GraficoIngresosGastos({ datos, mesActual }: { datos: { mes: string; ingresos: number; gasto: number }[]; mesActual: string }) {
  const filas = datos.map((d) => ({ ...d, etiqueta: MESES[Number(d.mes.slice(5)) - 1].charAt(0).toUpperCase() }));
  const marcas = marcasEje(0, Math.max(...datos.map((d) => Math.max(d.ingresos, d.gasto)), 0));
  return (
    <div>
      <Leyenda items={[{ color: COLOR_INGRESOS, texto: "Ingresos" }, { color: COLOR_GASTO, texto: "Gasto total" }]} />
      <div className="mt-3 h-52" role="img" aria-label={`Ingresos frente a gasto total por mes de ${datos[0]?.mes.slice(0, 4)}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={filas} barGap={2} barCategoryGap="22%" margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={REJILLA} />
            <XAxis
              dataKey="etiqueta"
              tickLine={false}
              axisLine={{ stroke: REJILLA }}
              tick={({ x, y, payload, index }) => (
                <text x={x} y={Number(y) + 12} textAnchor="middle" fontSize={11} fill={filas[index]?.mes === mesActual ? "#2A2820" : "#857B69"} fontWeight={filas[index]?.mes === mesActual ? 700 : 400}>
                  {payload.value}
                </text>
              )}
            />
            <YAxis domain={[0, marcas[marcas.length - 1]]} ticks={marcas} tickFormatter={ejeEuros} tickLine={false} axisLine={false} tick={TEXTO_EJE} width={44} />
            <Tooltip
              cursor={{ fill: "#F3E8D8" }}
              content={({ active, payload }: TooltipContentProps<ValueType, NameType>) =>
                active && payload?.length ? (
                  <Globo
                    titulo={mayuscula(nombreMes(payload[0].payload.mes))}
                    filas={[
                      { color: COLOR_INGRESOS, texto: "Ingresos", valor: payload[0].payload.ingresos },
                      { color: COLOR_GASTO, texto: "Gasto total", valor: payload[0].payload.gasto },
                    ]}
                  />
                ) : null
              }
            />
            <Bar dataKey="ingresos" fill={COLOR_INGRESOS} radius={[4, 4, 0, 0]} maxBarSize={12} isAnimationActive={false} />
            <Bar dataKey="gasto" fill={COLOR_GASTO} radius={[4, 4, 0, 0]} maxBarSize={12} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ComoTabla cabecera={["Mes", "Ingresos", "Gasto total"]} filas={datos.filter((d) => d.ingresos || d.gasto).map((d) => [mayuscula(nombreMes(d.mes)), d.ingresos, d.gasto])} />
    </div>
  );
}

/** Ahorro acumulado (Ahorro TR + Inversión TR + hucha) al cierre de cada mes. */
export function GraficoAhorro({ datos }: { datos: { mes: string; fecha: string; total: number }[] }) {
  if (datos.length < 2) return <p className="py-10 text-center text-sm text-tinta-3">Hace falta más de un mes para ver la evolución.</p>;
  const ultimo = datos[datos.length - 1];
  const marcas = marcasEje(Math.min(...datos.map((d) => d.total)), Math.max(...datos.map((d) => d.total)), 3);
  return (
    <div>
      <p className="num text-sm text-tinta-2">
        <b className="text-lg text-tinta">{eur(ultimo.total)}</b> el {fecha(ultimo.fecha).slice(0, 5)}
      </p>
      <div className="mt-2 h-44" role="img" aria-label="Ahorro acumulado por mes">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={datos} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={REJILLA} />
            <XAxis dataKey="mes" tickFormatter={(m: string) => MESES[Number(m.slice(5)) - 1].slice(0, 3)} tickLine={false} axisLine={{ stroke: REJILLA }} tick={TEXTO_EJE} />
            <YAxis domain={[marcas[0], marcas[marcas.length - 1]]} ticks={marcas} tickFormatter={ejeEuros} tickLine={false} axisLine={false} tick={TEXTO_EJE} width={48} />
            <Tooltip
              cursor={{ stroke: "#857B69", strokeWidth: 1 }}
              content={({ active, payload }: TooltipContentProps<ValueType, NameType>) =>
                active && payload?.length ? (
                  <Globo titulo={`A ${fecha(payload[0].payload.fecha)}`} filas={[{ color: COLOR_AHORRO, texto: "Ahorrado", valor: payload[0].payload.total }]} />
                ) : null
              }
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke={COLOR_AHORRO}
              strokeWidth={2}
              fill={COLOR_AHORRO}
              fillOpacity={0.1}
              isAnimationActive={false}
              dot={(p: { cx?: number; cy?: number; index?: number }) =>
                p.index === datos.length - 1 ? <circle key="fin" cx={p.cx} cy={p.cy} r={4.5} fill={COLOR_AHORRO} stroke="#F8F1E6" strokeWidth={2} /> : <g key={p.index} />
              }
              activeDot={{ r: 5, fill: COLOR_AHORRO, stroke: "#F8F1E6", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <ComoTabla cabecera={["Fecha", "Ahorrado"]} filas={datos.map((d) => [fecha(d.fecha), d.total])} />
    </div>
  );
}

/**
 * Reparto del gasto del mes: una barra apilada con los 5 grupos que más gastan y el resto juntos.
 * Cada tramo lleva el color de su grupo y la lista de debajo dice nombre, importe y peso.
 */
export function RepartoGasto({ grupos }: { grupos: { nombre: string; color: string; real: number }[] }) {
  const conGasto = grupos.filter((g) => g.real > 0).sort((a, b) => b.real - a.real);
  const total = conGasto.reduce((a, g) => a + g.real, 0);
  if (!total) return <p className="py-10 text-center text-sm text-tinta-3">Sin gasto este mes.</p>;
  const principales = conGasto.slice(0, 5);
  const resto = conGasto.slice(5);
  const tramos = resto.length ? [...principales, { nombre: `Resto (${resto.length})`, color: "#C9B9A0", real: resto.reduce((a, g) => a + g.real, 0) }] : principales;
  return (
    <div>
      <div className="flex h-6 w-full gap-[2px] overflow-hidden rounded-md" role="img" aria-label="Reparto del gasto por grupo">
        {tramos.map((t) => (
          <div key={t.nombre} title={`${t.nombre}: ${eur(t.real)}`} style={{ width: `${(t.real / total) * 100}%`, background: t.color }} className="h-full min-w-[3px] first:rounded-l-md last:rounded-r-md" />
        ))}
      </div>
      <ul className="mt-4 divide-y divide-linea-suave text-sm">
        {tramos.map((t) => (
          <li key={t.nombre} className="grid grid-cols-[minmax(0,1fr)_auto_3.5rem] items-center gap-3 py-1.5">
            <span className="flex min-w-0 items-center gap-2">
              <i className="size-2.5 shrink-0 rounded-sm" style={{ background: t.color }} aria-hidden />
              <span className="truncate">{t.nombre}</span>
            </span>
            <b className="num">{eur(t.real)}</b>
            <span className="num text-right text-tinta-3">{Math.round((t.real / total) * 100)} %</span>
          </li>
        ))}
      </ul>
      {resto.length > 0 && <p className="mt-1 text-xs text-tinta-3">Resto: {resto.map((g) => g.nombre).join(", ")}.</p>}
    </div>
  );
}
