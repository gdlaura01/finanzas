"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { ComoTabla, ejeEuros, Globo, Leyenda, REJILLA, TEXTO_EJE } from "@/components/panel/graficos";
import { COLOR_CUENTA } from "@/lib/cuentas";
import { eur, fecha, marcasEje, MESES, mayuscula, nombreMes } from "@/lib/formato";

const mesCorto = (m: string) => MESES[Number(m.slice(5, 7)) - 1].slice(0, 3);
type Contenido = TooltipContentProps<ValueType, NameType>;

/** Una sola serie en barras: saldo a fin de mes, intereses… El último mes, más intenso y con su valor. */
export function BarrasMes({ datos, color, etiqueta, decimales = 0 }: { datos: { mes: string; valor: number }[]; color: string; etiqueta: string; decimales?: 0 | 2 }) {
  if (!datos.length) return <p className="py-8 text-center text-sm text-tinta-3">Sin datos todavía.</p>;
  const marcas = marcasEje(0, Math.max(...datos.map((d) => d.valor), 1), 3);
  return (
    <div>
      <p className="num text-sm text-tinta-2">
        <b className="text-tinta">{eur(datos.at(-1)!.valor, decimales)}</b> en {nombreMes(datos.at(-1)!.mes)}
      </p>
      <div className="mt-2 h-44" role="img" aria-label={etiqueta}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={REJILLA} />
            <XAxis dataKey="mes" tickFormatter={mesCorto} tickLine={false} axisLine={{ stroke: REJILLA }} tick={TEXTO_EJE} />
            <YAxis domain={[0, marcas.at(-1)!]} ticks={marcas} tickFormatter={ejeEuros} tickLine={false} axisLine={false} tick={TEXTO_EJE} width={48} />
            <Tooltip
              cursor={{ fill: "#F3E8D8" }}
              content={({ active, payload }: Contenido) =>
                active && payload?.length ? <Globo titulo={mayuscula(nombreMes(payload[0].payload.mes))} filas={[{ color, texto: etiqueta, valor: payload[0].payload.valor }]} /> : null
              }
            />
            <Bar dataKey="valor" fill={color} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ComoTabla cabecera={["Mes", etiqueta]} filas={datos.map((d) => [mayuscula(nombreMes(d.mes)), d.valor])} />
    </div>
  );
}

const COLOR_VALOR = COLOR_CUENTA.inversion_tr, COLOR_APORTADO = "#857B69", COLOR_ALT = COLOR_CUENTA.hucha_revolut;

/** Inversión TR: lo que vale frente a lo aportado y a lo que tendrías en Ahorro TR. */
export function ValorFrenteAportado({ serie, tasa }: { serie: { fecha: string; valor: number; aportado: number; alternativa: number }[]; tasa: string }) {
  if (serie.length < 2) return <p className="py-8 text-center text-sm text-tinta-3">Hace falta más de un valor anotado.</p>;
  const todos = serie.flatMap((s) => [s.valor, s.aportado, s.alternativa]);
  const marcas = marcasEje(0, Math.max(...todos), 4);
  return (
    <div>
      <Leyenda items={[{ color: COLOR_VALOR, texto: "Valor" }, { color: COLOR_APORTADO, texto: "Aportado" }, { color: COLOR_ALT, texto: `En Ahorro TR al ${tasa} %` }]} />
      <div className="mt-3 h-52" role="img" aria-label="Valor de Inversión TR frente a lo aportado">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={serie} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={REJILLA} />
            <XAxis dataKey="fecha" tickFormatter={mesCorto} tickLine={false} axisLine={{ stroke: REJILLA }} tick={TEXTO_EJE} />
            <YAxis domain={[0, marcas.at(-1)!]} ticks={marcas} tickFormatter={ejeEuros} tickLine={false} axisLine={false} tick={TEXTO_EJE} width={48} />
            <Tooltip
              cursor={{ stroke: "#857B69", strokeWidth: 1 }}
              content={({ active, payload }: Contenido) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload;
                return (
                  <Globo
                    titulo={fecha(p.fecha)}
                    filas={[
                      { color: COLOR_VALOR, texto: "Valor", valor: p.valor },
                      { color: COLOR_APORTADO, texto: "Aportado", valor: p.aportado },
                      { color: COLOR_ALT, texto: `Al ${tasa} %`, valor: p.alternativa },
                    ]}
                  />
                );
              }}
            />
            <Line type="monotone" dataKey="aportado" stroke={COLOR_APORTADO} strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="alternativa" stroke={COLOR_ALT} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="valor" stroke={COLOR_VALOR} strokeWidth={2.5} dot={{ r: 4, fill: COLOR_VALOR, stroke: "#F8F1E6", strokeWidth: 2 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ComoTabla cabecera={["Fecha", "Valor", "Aportado", `Al ${tasa} %`]} filas={serie.map((s) => [fecha(s.fecha), s.valor, s.aportado, s.alternativa])} />
    </div>
  );
}

/** Lo ahorrado por cuentas, apilado: Ahorro TR, Inversión TR y hucha. */
export function AhorroApilado({ datos }: { datos: { mes: string; ahorroTr: number; inversionTr: number; hucha: number }[] }) {
  if (datos.length < 2) return <p className="py-8 text-center text-sm text-tinta-3">Hace falta más de un mes para ver la evolución.</p>;
  const capas = [
    { k: "ahorroTr", nombre: "Ahorro TR", color: COLOR_CUENTA.ahorro_tr },
    { k: "inversionTr", nombre: "Inversión TR", color: COLOR_CUENTA.inversion_tr },
    { k: "hucha", nombre: "Hucha", color: COLOR_CUENTA.hucha_revolut },
  ] as const;
  const total = (d: (typeof datos)[number]) => d.ahorroTr + d.inversionTr + d.hucha;
  const marcas = marcasEje(0, Math.max(...datos.map(total)), 4);
  return (
    <div>
      <Leyenda items={capas.map((c) => ({ color: c.color, texto: c.nombre }))} />
      <div className="mt-3 h-52" role="img" aria-label="Evolución del ahorro por cuentas">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={datos} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={REJILLA} />
            <XAxis dataKey="mes" tickFormatter={mesCorto} tickLine={false} axisLine={{ stroke: REJILLA }} tick={TEXTO_EJE} />
            <YAxis domain={[0, marcas.at(-1)!]} ticks={marcas} tickFormatter={ejeEuros} tickLine={false} axisLine={false} tick={TEXTO_EJE} width={48} />
            <Tooltip
              cursor={{ stroke: "#857B69", strokeWidth: 1 }}
              content={({ active, payload }: Contenido) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload;
                return <Globo titulo={`${mayuscula(nombreMes(p.mes))} · ${eur(total(p))}`} filas={capas.map((c) => ({ color: c.color, texto: c.nombre, valor: p[c.k] }))} />;
              }}
            />
            {capas.map((c) => (
              <Area key={c.k} type="monotone" dataKey={c.k} stackId="1" stroke="#F8F1E6" strokeWidth={2} fill={c.color} fillOpacity={0.85} isAnimationActive={false} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <ComoTabla cabecera={["Mes", ...capas.map((c) => c.nombre), "Total"]} filas={datos.map((d) => [mayuscula(nombreMes(d.mes)), d.ahorroTr, d.inversionTr, d.hucha, total(d)])} />
    </div>
  );
}

/** Minigráfico de las últimas cifras de una cuenta (sin ejes: solo la tendencia). */
export function Tendencia({ valores, color }: { valores: number[]; color: string }) {
  if (valores.length < 2) return null;
  const W = 96, H = 30, mn = Math.min(...valores), mx = Math.max(...valores), r = mx - mn || 1;
  const pts = valores.map((v, i) => [3 + (i / (valores.length - 1)) * (W - 6), H - 4 - ((v - mn) / r) * (H - 8)]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-7 w-24 shrink-0" aria-hidden>
      <polyline points={pts.map((p) => p.map((n) => n.toFixed(1)).join(",")).join(" ")} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts.at(-1)![0]} cy={pts.at(-1)![1]} r={3} fill={color} />
    </svg>
  );
}
