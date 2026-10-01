import Link from "next/link";
import { AlertTriangle, Check } from "lucide-react";
import { Cabecera } from "@/components/app/marco";
import { AhorroApilado, BarrasMes, Tendencia, ValorFrenteAportado } from "@/components/cuentas/graficos";
import { BotonCuadrar, InteresEditable, QuitarValor, SelectorColchon } from "@/components/cuentas/interaccion";
import { db } from "@/db";
import { ultimoCuadre } from "@/db/cuentas";
import { leerParametros } from "@/db/movimientos";
import * as t from "@/db/schema";
import type { Cuenta } from "@/db/schema";
import { analisisInversion, COLOR_CUENTA, estadoColchon, flujosMes, haceDias, INFO_CUENTA, interesPrevisto, serieCuenta } from "@/lib/cuentas";
import { eur, fecha, fechaCorta, hoy, MESES, mayuscula, nombreMes, porcentaje, sumarMeses } from "@/lib/formato";
import { finDeMes, saldos, type DatosSaldos } from "@/lib/panel";
import { consumeHucha, esRetirada, movsDelMes } from "@/lib/reglas";
import { cn } from "@/lib/utils";

export const metadata = { title: "Cuentas y ahorro · Finanzas" };

const CUENTAS: Cuenta[] = ["imagin", "ahorro_tr", "inversion_tr", "hucha_revolut"];

export default async function Cuentas({ searchParams }: { searchParams: Promise<{ cuenta?: string }> }) {
  const { cuenta: param } = await searchParams;
  const sel: Cuenta = CUENTAS.includes(param as Cuenta) ? (param as Cuenta) : "ahorro_tr";
  const base = db();
  const hoyISO = hoy();
  const mesHoy = hoyISO.slice(0, 7);
  const p = leerParametros(base) as Record<string, number | string>;
  const tasa = Number(p.tasa_ahorro_tr ?? 2.5);
  const d: DatosCuentas = {
    cuadres: base.select().from(t.cuadres).all(),
    movs: base.select().from(t.movimientos).all(),
    intereses: base.select().from(t.intereses).all(),
    valoraciones: base.select().from(t.valoracionesInversion).all(),
  };
  const ahora = saldos(d, hoyISO);
  const antes = saldos(d, finDeMes(sumarMeses(mesHoy, -1)));
  const total = CUENTAS.reduce((a, c) => a + (ahora[c] ?? 0), 0);
  const primerMes = (c: Cuenta) => (c === "inversion_tr" ? ([...d.valoraciones].sort((a, b) => a.fecha.localeCompare(b.fecha))[0]?.fecha.slice(0, 7) ?? mesHoy) : (ultimoCuadreMasAntiguo(d, c) ?? mesHoy));
  const series = Object.fromEntries(CUENTAS.map((c) => [c, serieCuenta(c, d, primerMes(c), hoyISO)])) as Record<Cuenta, { mes: string; saldo: number }[]>;

  const textoCuadre = (c: Cuenta) => {
    if (c === "inversion_tr") {
      const v = [...d.valoraciones].sort((a, b) => a.fecha.localeCompare(b.fecha)).at(-1);
      return v ? `Valor anotado ${haceDias(v.fecha, hoyISO)}` : "Sin valores anotados";
    }
    const u = ultimoCuadre(base, c);
    if (!u) return "Sin saldo de partida";
    if (u.estimado) return "estimado";
    return u.esPartida ? `Desde el saldo del ${fechaCorta(u.fecha)}` : `Cuadrado ${haceDias(u.fecha, hoyISO)}`;
  };

  const colchonMeses = Number(p.colchon_meses ?? 3);
  const colchon = estadoColchon(d, hoyISO, colchonMeses);
  const corte = String(p.fecha_corte ?? "2026-08-31").slice(0, 7);
  const apilado = series.ahorro_tr
    .filter((s) => s.mes >= corte)
    .map((s) => ({
      mes: s.mes,
      ahorroTr: s.saldo,
      inversionTr: series.inversion_tr.find((x) => x.mes === s.mes)?.saldo ?? 0,
      hucha: series.hucha_revolut.find((x) => x.mes === s.mes)?.saldo ?? 0,
    }));

  return (
    <main className="pb-12">
      <Cabecera titulo="Cuentas y ahorro" />
      <div className="flex flex-col gap-6 px-4 pt-3 sm:px-8">
        <section>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-bold">Tus cuentas hoy</h2>
            <p className="text-sm text-tinta-3">
              Total <b className="num text-tinta">{eur(total)}</b> · pulsa una cuenta para ver su detalle
            </p>
          </div>
          <nav aria-label="Cuentas" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {CUENTAS.map((c) => {
              const dif = ahora[c] != null && antes[c] != null ? ahora[c]! - antes[c]! : null;
              const txt = textoCuadre(c);
              return (
                <Link
                  key={c}
                  href={`/cuentas?cuenta=${c}`}
                  aria-current={c === sel ? "page" : undefined}
                  className={cn("flex flex-col gap-1 rounded-xl border border-t-4 bg-papel p-4 transition-colors hover:bg-campo", c === sel ? "border-linea bg-campo shadow-sm" : "border-linea-suave")}
                  style={{ borderTopColor: COLOR_CUENTA[c] }}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span>
                      <b className="block">{INFO_CUENTA[c].nombre}</b>
                      <small className="text-xs text-tinta-3">{INFO_CUENTA[c].sub}</small>
                    </span>
                    <Tendencia valores={series[c].slice(-6).map((s) => s.saldo)} color={COLOR_CUENTA[c]} />
                  </span>
                  <span className={cn("text-2xl font-bold", (ahora[c] ?? 0) < 0 && "text-burdeos")}>{ahora[c] == null ? "—" : eur(ahora[c]!)}</span>
                  {dif != null && (
                    <span className="text-xs text-tinta-3">
                      <span className={cn("num font-semibold", dif < 0 ? "text-burdeos" : "text-oliva-osc")}>
                        {dif >= 0 ? "+" : "−"}
                        {eur(Math.abs(dif))}
                      </span>{" "}
                      desde {MESES[Number(sumarMeses(mesHoy, -1).slice(5)) - 1]}
                    </span>
                  )}
                  <span className="text-xs text-tinta-3">
                    {txt === "estimado" ? <span className="rounded-full bg-terracota-claro px-2 py-px font-bold text-[#7a3b23]">estimado</span> : txt}
                  </span>
                </Link>
              );
            })}
          </nav>
        </section>

        <section className="rounded-xl border border-l-4 border-linea-suave bg-papel p-5 sm:p-6" style={{ borderLeftColor: COLOR_CUENTA[sel] }}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-tinta-2">{INFO_CUENTA[sel].sub}</p>
              <h2 className="text-2xl font-bold">{INFO_CUENTA[sel].nombre}</h2>
            </div>
            <span className="text-3xl font-bold">{ahora[sel] == null ? "—" : eur(ahora[sel]!)}</span>
            <BotonCuadrar cuenta={sel} nombre={INFO_CUENTA[sel].nombre} calculado={ahora[sel]} hoy={hoyISO} />
          </div>
          <Ficha cuenta={sel} d={d} hoyISO={hoyISO} tasa={tasa} serie={series[sel]} p={p} />
        </section>

        <section className="grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
          <div className="flex flex-col gap-4 rounded-xl border border-linea-suave bg-papel p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-tinta-2">Colchón de seguridad</p>
                <p className="text-3xl font-bold">
                  {porcentaje(Math.min(colchon.cubierto, 9.99), 0)} <small className="text-sm font-normal text-tinta-3">cubierto</small>
                </p>
              </div>
              <SelectorColchon meses={colchonMeses} />
            </div>
            <BarraColchon liquido={colchon.liquido} objetivo={colchon.objetivo} />
            <dl className="num divide-y divide-linea-suave text-sm">
              {(
                [
                  ["Gasto medio al mes", "últimos 3 meses", colchon.medio],
                  ["Objetivo", `${colchonMeses} meses de gasto`, colchon.objetivo],
                  ["Tienes", "Ahorro TR + hucha", colchon.liquido],
                ] as const
              ).map(([a, b, v]) => (
                <div key={a} className="flex justify-between gap-3 py-2">
                  <dt>
                    {a}
                    <small className="block text-xs text-tinta-3">{b}</small>
                  </dt>
                  <dd className="font-bold">{eur(v)}</dd>
                </div>
              ))}
            </dl>
            {colchon.objetivo > 0 && (
              <p className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-sm", colchon.cubierto >= 1 ? "border-[#c9d3b8] bg-oliva-claro text-[#2f3a2a]" : "border-[#e5cf9c] bg-ambar-claro text-[#4f3a10]")}>
                {colchon.cubierto >= 1 ? <Check className="mt-0.5 size-4 shrink-0" aria-hidden /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />}
                <span>
                  {colchon.cubierto >= 1 ? (
                    <>
                      Colchón completo. Lo que pase de <b className="num">{eur(colchon.objetivo)}</b> (ahora <b className="num">{eur(colchon.sobra)}</b>) puede ir a Inversión TR.
                    </>
                  ) : (
                    <>
                      Te faltan <b className="num">{eur(-colchon.sobra)}</b> para completarlo antes de invertir más.
                    </>
                  )}
                </span>
              </p>
            )}
          </div>
          <div className="rounded-xl border border-linea-suave bg-papel p-5">
            <h2 className="mb-3 text-lg font-bold">Evolución del ahorro por cuentas</h2>
            <AhorroApilado datos={apilado} />
          </div>
        </section>
      </div>
    </main>
  );
}

type DatosCuentas = Omit<DatosSaldos, "cuadres"> & { cuadres: (typeof t.cuadres.$inferSelect)[] };

function ultimoCuadreMasAntiguo(d: DatosSaldos, c: Cuenta) {
  return d.cuadres.filter((x) => x.cuenta === c).map((x) => x.fecha).sort()[0]?.slice(0, 7) ?? null;
}

function BarraColchon({ liquido, objetivo }: { liquido: number; objetivo: number }) {
  const tope = Math.max(objetivo, liquido) || 1;
  const cubierto = objetivo ? liquido / objetivo : 0;
  return (
    <div className="relative pt-5" role="img" aria-label={`Tienes ${eur(liquido)} de un objetivo de ${eur(objetivo)}`}>
      <div className="h-3 overflow-hidden rounded-full bg-papel-2">
        <div className={cn("h-full rounded-full", cubierto >= 1 ? "bg-oliva" : cubierto >= 0.5 ? "bg-ambar" : "bg-burdeos")} style={{ width: `${(Math.max(liquido, 0) / tope) * 100}%` }} />
      </div>
      <span className="absolute top-0 flex -translate-x-1/2 flex-col items-center text-[11px] text-tinta-3" style={{ left: `${(objetivo / tope) * 100}%` }}>
        objetivo
        <i className="h-6 w-0.5 bg-tinta" />
      </span>
    </div>
  );
}

function Tabla({ cabecera, filas }: { cabecera: string[]; filas: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-linea-suave">
      <table className="num w-full text-sm">
        <thead className="bg-papel-2 text-left text-xs text-tinta-2">
          <tr>
            {cabecera.map((c, i) => (
              <th key={c} className={cn("px-3 py-2 font-semibold", i > 0 && "text-right")}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-linea-suave bg-campo">
          {filas.map((f, i) => (
            <tr key={i}>
              {f.map((c, j) => (
                <td key={j} className={cn("px-3 py-1.5", j > 0 && "whitespace-nowrap text-right")}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const fmt = (v: number | null | undefined) => (v == null ? "—" : eur(v));
const menos = (v: number) => (v ? `−${eur(v)}` : eur(0));

function Ficha({ cuenta, d, hoyISO, tasa, serie, p }: { cuenta: Cuenta; d: DatosCuentas; hoyISO: string; tasa: number; serie: { mes: string; saldo: number }[]; p: Record<string, number | string> }) {
  const mesHoy = hoyISO.slice(0, 7);
  const partida = d.cuadres.filter((c) => c.cuenta === cuenta).sort((a, b) => a.fecha.localeCompare(b.fecha)).at(-1);
  const info = partida?.esPartida ? (
    <p className="mb-4 text-sm text-tinta-3">Se calcula desde el saldo de partida del {fecha(partida.fecha)}. Cuádralo con el banco para asegurarte.</p>
  ) : partida && !partida.estimado ? (
    <p className="mb-4 text-sm text-tinta-3">
      Último cuadre: {fecha(partida.fecha)} ({haceDias(partida.fecha, hoyISO)})
      {partida.saldoCalculadoCent != null && partida.saldoCalculadoCent !== partida.saldoRealCent && (
        <>
          {" "}
          · la app iba {eur(Math.abs(partida.saldoRealCent - partida.saldoCalculadoCent))} {partida.saldoRealCent > partida.saldoCalculadoCent ? "por debajo" : "por encima"} del banco
        </>
      )}
      .
    </p>
  ) : null;

  if (cuenta === "imagin") {
    return (
      <>
        {partida?.estimado ? (
          <Aviso>
            El saldo es una <b>estimación</b>: parte de los {eur(partida.saldoRealCent)} que tenías a {fecha(partida.fecha)} según tu hoja. Cuádralo una vez con tu saldo real y desde ahí
            será exacto.
          </Aviso>
        ) : (
          info
        )}
        <div className="grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
          <BarrasMes datos={serie.map((s) => ({ mes: s.mes, valor: Math.max(s.saldo, 0) }))} color={COLOR_CUENTA.imagin} etiqueta="Saldo a fin de mes" />
          <Tabla
            cabecera={["Mes", "Entra", "Sale", "Saldo"]}
            filas={[...serie].reverse().map((s) => {
              const f = flujosMes("imagin", d.movs, s.mes);
              return [mayuscula(nombreMes(s.mes)), eur(f.entra), menos(f.sale), <b key="s">{eur(s.saldo)}</b>];
            })}
          />
        </div>
      </>
    );
  }

  if (cuenta === "ahorro_tr") {
    const ints = d.intereses.filter((i) => i.cuenta === "ahorro_tr").sort((a, b) => a.mes.localeCompare(b.mes));
    const desde = ints[0]?.mes ?? serie[0]?.mes ?? mesHoy;
    const meses: string[] = [];
    for (let m = desde; m <= mesHoy; m = sumarMeses(m, 1)) meses.push(m);
    const saldoHoy = serie.at(-1)?.saldo ?? 0;
    // Aviso del error de la hoja original mientras el saldo de partida no se haya cuadrado
    const erroJunio = partida?.esPartida && partida.fecha === "2026-08-31" && partida.saldoRealCent === 191166;
    return (
      <>
        {info}
        {erroJunio && (
          <Aviso>
            <b>Revisa el saldo de partida.</b> En tu hoja original, el saldo de junio está mal calculado: en vez de sumar los 500 € que aportaste ese mes, suma dos veces el interés de
            1,10 €. Ese error arrastra a julio y agosto. Si se corrige, a 31/08 tendrías <b className="num">2.410,56 €</b> y no 1.911,66 €. Los intereses que te ha pagado Trade
            Republic encajan mejor con la cifra corregida. Pulsa «Cuadrar con el banco» y escribe tu saldo real para salir de dudas.
          </Aviso>
        )}
        <div className="grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
          <div>
            <h3 className="font-bold">Intereses cobrados</h3>
            <p className="mb-2 text-xs text-tinta-3">
              Netos, el día 1 de cada mes. Al {String(tasa).replace(".", ",")} % y con el saldo de hoy, unos <b className="num">{eur(interesPrevisto(saldoHoy, tasa / 100))}</b> en los próximos 12
              meses (con un 19 % de retención).
            </p>
            <BarrasMes datos={ints.map((i) => ({ mes: i.mes, valor: i.importeCent }))} color={COLOR_CUENTA.ahorro_tr} etiqueta="Interés neto" decimales={2} />
          </div>
          <div>
            <Tabla
              cabecera={["Mes", "Entra", "A Inversión TR", "Interés", "Saldo"]}
              filas={[...meses].reverse().map((m) => {
                const xs = movsDelMes(d.movs, m);
                const entra = xs.filter((x) => x.tipo === "ahorro" && x.cuentaDestino === "ahorro_tr").reduce((a, x) => a + x.importeCent, 0);
                const sale = xs.filter((x) => x.tipo === "interno" && x.cuentaOrigen === "ahorro_tr").reduce((a, x) => a + x.importeCent, 0);
                const interes = ints.find((i) => i.mes === m)?.importeCent ?? 0;
                return [
                  mayuscula(nombreMes(m)),
                  eur(entra),
                  menos(sale),
                  <InteresEditable key="i" mes={m} valor={interes} etiqueta={`Interés de ${nombreMes(m)}`} />,
                  <b key="s">{fmt(serie.find((s) => s.mes === m)?.saldo)}</b>,
                ];
              })}
            />
            <p className="mt-2 text-xs text-tinta-3">El interés lo liquida el banco: si no coincide, corrígelo en la tabla (se guarda al salir de la casilla).</p>
          </div>
        </div>
      </>
    );
  }

  if (cuenta === "hucha_revolut") {
    return (
      <>
        {info}
        <p className="mb-4 text-sm text-tinta-2">
          Tu hucha para lo que quieras: imprevistos, regalos o caprichos. Recibe {eur(Number(p.objetivo_hucha_cent ?? 0))} al mes. Si Revolut te paga intereses, cuadra la hucha con tu
          saldo real y quedarán recogidos.
        </p>
        <Tabla
          cabecera={["Mes", "Traspasos", "Pagado con Revolut", "Sacado a Imagin", "Saldo"]}
          filas={[...serie].reverse().map((s) => {
            const xs = movsDelMes(d.movs, s.mes);
            const suma = (f: (x: (typeof xs)[number]) => boolean) => xs.filter(f).reduce((a, x) => a + x.importeCent, 0);
            return [mayuscula(nombreMes(s.mes)), eur(suma((x) => x.tipo === "traspaso")), menos(suma(consumeHucha)), menos(suma(esRetirada)), <b key="s">{eur(s.saldo)}</b>];
          })}
        />
      </>
    );
  }

  // Inversión TR
  const a = analisisInversion(d, tasa / 100);
  const tasaTxt = String(tasa).replace(".", ",");
  if (!a) return <p className="py-6 text-center text-sm text-tinta-3">Aún no hay valores anotados con aportaciones. Anota el valor de hoy para empezar.</p>;
  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi etiqueta="Has aportado" valor={eur(a.aportado)} />
        <Kpi etiqueta="Ganancia" valor={`${a.ganancia >= 0 ? "+" : "−"}${eur(Math.abs(a.ganancia))}`} nota={`${a.ganancia >= 0 ? "+" : "−"}${porcentaje(Math.abs(a.pct))} sobre lo aportado`} bueno={a.ganancia >= 0} />
        <Kpi etiqueta="Rentabilidad anual (TIR)" valor={a.tir == null ? "—" : porcentaje(a.tir)} nota={`Ahorro TR da un ${tasaTxt} %`} />
        <Kpi
          etiqueta="Frente a dejarlo en Ahorro TR"
          valor={`${a.frenteACuenta >= 0 ? "+" : "−"}${eur(Math.abs(a.frenteACuenta))}`}
          nota={`tendrías ${eur(a.alternativa)}`}
          bueno={a.frenteACuenta >= 0}
        />
      </div>
      <div className="grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        <div>
          <h3 className="mb-2 font-bold">Valor frente a lo aportado</h3>
          <ValorFrenteAportado serie={a.serie} tasa={tasaTxt} />
        </div>
        <Tabla
          cabecera={["Fecha", "Valor", "Rendimiento", ""]}
          filas={[...a.valores].reverse().map((v) => [
            fecha(v.fecha),
            <span key="v">
              <b>{eur(v.valor)}</b>
              {v.aportadoEntre > 0 && <small className="block text-xs text-tinta-3">+{eur(v.aportadoEntre)} aportado</small>}
            </span>,
            v.rendimiento == null ? (
              "—"
            ) : (
              <span key="r" className={cn(v.rendimiento < 0 ? "text-burdeos" : "text-oliva-osc")}>
                {v.rendimiento >= 0 ? "+" : "−"}
                {eur(Math.abs(v.rendimiento))}
                <small className="block text-xs">
                  {v.rendimiento >= 0 ? "+" : "−"}
                  {porcentaje(Math.abs(v.pct!))}
                </small>
              </span>
            ),
            <QuitarValor key="q" fecha={v.fecha} texto={fecha(v.fecha)} />,
          ])}
        />
      </div>
      <p className="mt-4 text-xs text-tinta-3">
        {a.meses < 12 && `Llevas unos ${a.meses} meses: con tan poco historial la TIR se mueve mucho. Júzgala a 3–5 años. `}
        La comparación es aproximada: los intereses de la cuenta llegan netos y las ganancias de Inversión TR tributan al vender.
      </p>
    </>
  );
}

function Kpi({ etiqueta, valor, nota, bueno }: { etiqueta: string; valor: string; nota?: string; bueno?: boolean }) {
  return (
    <div className="rounded-xl border border-linea-suave bg-campo p-4">
      <p className="text-xs text-tinta-2">{etiqueta}</p>
      <p className={cn("text-xl font-bold", bueno === true && "text-oliva-osc", bueno === false && "text-burdeos")}>{valor}</p>
      {nota && <p className="text-xs text-tinta-3">{nota}</p>}
    </div>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 flex items-start gap-2 rounded-lg border border-[#e5cf9c] bg-ambar-claro px-3 py-2 text-sm text-[#4f3a10]">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
