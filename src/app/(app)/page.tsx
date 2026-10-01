import Link from "next/link";
import { AlertTriangle, Check, Clock, Pencil } from "lucide-react";
import { Cabecera } from "@/components/app/marco";
import { SelectorMes } from "@/components/app/selector-mes";
import { GraficoAhorro, GraficoIngresosGastos, RepartoGasto } from "@/components/panel/graficos";
import { db } from "@/db";
import { datosPanel } from "@/db/panel";
import type { Cuenta } from "@/db/schema";
import { esMes, eur, fecha, fechaCorta, hoy, MESES, menos, nombreMes, porcentaje, sumarMeses } from "@/lib/formato";
import { CLASES, claseDe, sentido } from "@/lib/movimientos";
import {
  avisosPanel,
  cierreMes,
  comprasSinCargar,
  fechaReferencia,
  filasGrupos,
  finDeMes,
  proximosEventos,
  rendimientoInversion,
  resumenPanel,
  saldos,
  serieAhorro,
  serieAnual,
  type Aviso,
  type FilaGrupo,
} from "@/lib/panel";
import { cn } from "@/lib/utils";

export const metadata = { title: "Panel · Finanzas" };

const COLOR_CUENTA: Record<Cuenta, string> = { imagin: "#BA6A4C", ahorro_tr: "#607456", inversion_tr: "#D9977A", hucha_revolut: "#BE8A2A" };

export default async function Panel({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes: param } = await searchParams;
  const hoyISO = hoy();
  const mesHoy = hoyISO.slice(0, 7);
  const mes = esMes(param) ? param : mesHoy;
  const nombre = MESES[Number(mes.slice(5)) - 1];
  const d = datosPanel(db(), mes, hoyISO);
  const p = d.parametros;

  const r = resumenPanel(d.movs, mes, d.grupos);
  const filas = filasGrupos(d.grupos, d.eventos, d.movs, mes);
  const proximos = proximosEventos(d.eventos, d.movs, hoyISO);
  const avisos = avisosPanel({ filas, proximos: mes === mesHoy ? proximos : [], porRevisar: d.porRevisar, nombreMes: nombre, eur, pct: porcentaje });
  const sinCargar = mes === mesHoy ? comprasSinCargar(d.movs, hoyISO) : [];

  const datosSaldos = { cuadres: d.cuadres, movs: d.movs, intereses: d.intereses, valoraciones: d.valoraciones };
  const ref = fechaReferencia(mes, hoyISO);
  const s = saldos(datosSaldos, ref);
  const arrastre = saldos(datosSaldos, finDeMes(sumarMeses(mes, -1))).imagin;
  const cuadreImagin = d.cuadres.filter((c) => c.cuenta === "imagin" && c.fecha <= ref).sort((a, b) => a.fecha.localeCompare(b.fecha)).pop();
  const inversion = rendimientoInversion(datosSaldos, ref);
  const interesMes = d.intereses.find((i) => i.cuenta === "ahorro_tr" && i.mes === mes)?.importeCent ?? 0;
  const total = (Object.values(s) as (number | null)[]).reduce<number>((a, v) => a + (v ?? 0), 0);
  const corte = typeof p.fecha_corte === "string" ? p.fecha_corte : "2026-08-31";
  const ahorro = serieAhorro(datosSaldos, corte, mes > mesHoy ? mesHoy : mes, hoyISO);
  const grupo = (id: number | null) => d.grupos.find((g) => g.id === id);

  const cuando = mes === mesHoy ? "hoy" : mes < mesHoy ? `al cierre de ${nombre}` : `previsto a fin de ${nombre}`;

  return (
    <main className="pb-12">
      <Cabecera titulo="Panel">
        <SelectorMes ruta="/" mes={mes} />
      </Cabecera>

      <div className="flex flex-col gap-8 px-4 pt-3 sm:px-8">
        {/* Arriba: lo que te queda y tus cuentas */}
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className={cn("flex flex-col gap-4 rounded-2xl p-6 text-[#fbf3e8] sm:p-8", r.disponible < 0 ? "bg-burdeos" : "bg-oliva-osc")}>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#f3e4d0]">{mes < mesHoy ? `Te sobró en ${nombre}` : `Te queda por gastar en ${nombre}`}</p>
            <p className="font-sans text-5xl font-bold tracking-tight sm:text-6xl">{eur(r.disponible)}</p>
            <p className="max-w-prose text-sm text-[#f3e4d0]">
              Lo que queda de la nómina de este mes. El efectivo y lo pagado con la hucha cuentan en su grupo, pero no restan de aquí.
            </p>
            {sinCargar.length > 0 && (
              <p className="text-sm">
                <b className="num">{eur(sinCargar.reduce((a, m) => a + m.importeCent, 0))}</b> de {sinCargar.length} compra{sinCargar.length > 1 ? "s" : ""} con tarjeta aún sin cargar en la cuenta.
              </p>
            )}
            <dl className="num mt-auto grid gap-x-6 gap-y-1 border-t border-white/20 pt-4 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-3">
                <dt className="text-[#f3e4d0]">Ingresos</dt>
                <dd>{eur(r.ingresos)}</dd>
              </div>
              {r.retiradas > 0 && (
                <div className="flex justify-between gap-3">
                  <dt className="text-[#f3e4d0]">Sacado de la hucha</dt>
                  <dd>+{eur(r.retiradas)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-[#f3e4d0]">A ahorro e inversión</dt>
                <dd>{menos(r.ahorro)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#f3e4d0]">A la hucha</dt>
                <dd>{menos(r.traspasos)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#f3e4d0]">Gasto que paga Imagin</dt>
                <dd>{menos(r.gastoTotal - r.gastoEfectivo - r.gastoRevolut)}</dd>
              </div>
            </dl>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-bold">Tus cuentas {cuando}</h2>
              <p className="text-sm text-tinta-3">
                Total <b className="num text-tinta">{eur(total)}</b>
              </p>
            </div>
            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
              <TarjetaCuenta nombre="Imagin" cuenta="imagin" valor={s.imagin}>
                {arrastre != null && <>Arrastras {eur(arrastre)} del mes anterior. </>}
                {cuadreImagin?.estimado ? (
                  <span className="rounded-full bg-terracota-claro px-2 py-px text-xs font-bold text-[#7a3b23]">estimado</span>
                ) : cuadreImagin ? (
                  <>Cuadrado el {fechaCorta(cuadreImagin.fecha)}.</>
                ) : null}
              </TarjetaCuenta>
              <TarjetaCuenta nombre="Ahorro TR" cuenta="ahorro_tr" valor={s.ahorro_tr}>
                Al {String(p.tasa_ahorro_tr ?? 2.5).replace(".", ",")} %. Interés de {nombre}: {eur(interesMes)}.
              </TarjetaCuenta>
              <TarjetaCuenta nombre="Inversión TR" cuenta="inversion_tr" valor={s.inversion_tr}>
                {inversion ? (
                  <>
                    Valor anotado el {fechaCorta(inversion.fecha)}
                    {inversion.ganancia != null && (
                      <>
                        {" "}
                        · {inversion.ganancia >= 0 ? "+" : "−"}
                        {eur(Math.abs(inversion.ganancia))} ({inversion.ganancia >= 0 ? "+" : "−"}
                        {porcentaje(Math.abs(inversion.ganancia) / inversion.aportado)}) sobre lo aportado
                      </>
                    )}
                    {s.inversion_tr !== inversion.valor && <>, más lo aportado después</>}.
                  </>
                ) : (
                  "Sin valoraciones anotadas."
                )}
              </TarjetaCuenta>
              <TarjetaCuenta nombre="Hucha" cuenta="hucha_revolut" valor={s.hucha_revolut}>
                Traspasado en {nombre}: {eur(r.traspasos)} de {eur(Number(p.objetivo_hucha_cent ?? 0))} previstos.
              </TarjetaCuenta>
            </div>
          </div>
        </section>

        {avisos.length > 0 && (
          <section aria-label="Avisos" className="flex flex-col gap-2">
            {avisos.map((a) => (
              <AvisoFila key={a.clave} a={a} />
            ))}
          </section>
        )}

        {/* Resumen del mes */}
        <section>
          <h2 className="mb-3 text-xl font-bold">Resumen de {nombre}</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Kpi etiqueta="Ingresos" valor={eur(r.ingresos)} />
            <Kpi etiqueta="Ahorro a Trade Republic" valor={eur(r.ahorro)} />
            <Kpi etiqueta="Traspasado a la hucha" valor={eur(r.traspasos)} />
            <Kpi etiqueta="Gasto total" valor={eur(r.gastoTotal)} />
            <Kpi etiqueta="Disponible restante" valor={eur(r.disponible)} malo={r.disponible < 0} />
            <Kpi etiqueta="Tasa de ahorro" valor={porcentaje(r.tasaAhorro)} />
            <Kpi etiqueta="Gasolina" valor={eur(r.gastoGasolina)} secundario />
            <Kpi etiqueta="Gasto sin gasolina" valor={eur(r.gastoSinGasolina)} secundario />
            <Kpi etiqueta="Pagado en efectivo" valor={eur(r.gastoEfectivo)} secundario />
            {r.gastoRevolut > 0 && <Kpi etiqueta="Pagado con la hucha" valor={eur(r.gastoRevolut)} secundario />}
            {r.retiradas > 0 && <Kpi etiqueta="Sacado de la hucha" valor={eur(r.retiradas)} secundario />}
          </div>
        </section>

        {/* Presupuesto: semáforo y reparto */}
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Semaforo filas={filas} />
          <Tarjeta titulo="Reparto del gasto" subtitulo={`Gasto neto de ${nombre} por grupo`}>
            <RepartoGasto grupos={filas.map((f) => ({ nombre: f.grupo.nombre, color: f.grupo.color, real: f.real }))} />
          </Tarjeta>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <Tarjeta titulo={`Ingresos frente a gastos · ${mes.slice(0, 4)}`}>
            <GraficoIngresosGastos datos={serieAnual(d.movs, Number(mes.slice(0, 4)))} mesActual={mes} />
          </Tarjeta>
          <Tarjeta titulo="Ahorro acumulado" subtitulo={`Ahorro TR + Inversión TR + hucha desde el ${fecha(corte)}`}>
            <GraficoAhorro datos={ahorro} />
          </Tarjeta>
        </section>

        {/* Abajo: pendientes, eventos y últimos movimientos */}
        <section className="grid gap-5 lg:grid-cols-3">
          <Tarjeta
            titulo="Pendientes de confirmar"
            accion={d.pendientes.length ? { href: `/movimientos?mes=${mes}#pendientes`, texto: "Confirmarlos →" } : undefined}
          >
            {d.pendientes.length ? (
              <ul className="divide-y divide-linea-suave text-sm">
                {d.pendientes.map((x) => {
                  const atrasado = x.fechaPrevista != null && x.fechaPrevista <= hoyISO;
                  const c = x.recurrente.clase;
                  const sale = c !== "entrada" && c !== "interes" && c !== "valoracion";
                  return (
                    <li key={x.recurrente.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="min-w-0">
                        <span className="block">{x.recurrente.concepto}</span>
                        <span className={cn("rounded-full px-2 py-px text-[11px] font-bold", atrasado ? "bg-terracota-claro text-[#7a3b23]" : "bg-papel-2 text-tinta-2")}>
                          {!x.fechaPrevista ? "sin día fijo" : x.fechaPrevista < hoyISO ? `atrasado · ${fechaCorta(x.fechaPrevista)}` : x.fechaPrevista === hoyISO ? "toca hoy" : `previsto el ${fechaCorta(x.fechaPrevista)}`}
                        </span>
                      </span>
                      <span className={cn("num whitespace-nowrap font-semibold", !sale && "text-oliva-osc")}>
                        {x.importeCent == null ? (c === "valoracion" ? "anotar" : "variable") : `${c === "interno" ? "⇄ " : sale ? "−" : "+"}${eur(x.importeCent)}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-tinta-3">Nada pendiente este mes.</p>
            )}
          </Tarjeta>

          <Tarjeta titulo="Próximos eventos" accion={{ href: "/calendario", texto: "Ver calendario →" }}>
            {proximos.length ? (
              <ul className="divide-y divide-linea-suave text-sm">
                {proximos.map((e) => (
                  <li key={`${e.id}-${e.fecha}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <i className="size-2.5 shrink-0 rounded-full" style={{ background: e.color ?? grupo(e.grupoId)?.color }} aria-hidden />
                      <span className="truncate">{e.nombre}</span>
                    </span>
                    <b className="num">{eur(e.importePrevistoCent)}</b>
                    <small className="col-span-2 pl-[18px] text-tinta-3">
                      {e.dia ? `${e.dia} de ` : ""}
                      {MESES[Number(e.fecha.slice(5, 7)) - 1]} · {grupo(e.grupoId)?.nombre} ·{" "}
                      <span className={cn(e.dias < 14 && "font-bold text-[#7a3b23]")}>{e.dias <= 0 ? (e.dia ? "hoy" : "este mes") : e.dias === 1 ? "mañana" : `faltan ${e.dias} días`}</span>
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-tinta-3">Ningún evento con fecha en los próximos 12 meses.</p>
            )}
            {d.eventos.some((e) => !e.mes) && (
              <p className="mt-2 border-t border-linea-suave pt-2 text-center text-xs text-tinta-3">
                {d.eventos.filter((e) => !e.mes).length} eventos sin mes asignado.{" "}
                <Link href="/calendario" className="font-bold text-oliva-osc hover:underline">
                  Asignarlos
                </Link>
              </p>
            )}
          </Tarjeta>

          <Tarjeta titulo="Últimos movimientos" accion={{ href: "/movimientos?mes=todos", texto: "Ver todos →" }}>
            {d.ultimos.length ? (
              <ul className="divide-y divide-linea-suave text-sm">
                {d.ultimos.map((m) => {
                  const sg = sentido(m);
                  return (
                    <li key={m.id} className="grid grid-cols-[44px_minmax(0,1fr)_auto_auto] items-center gap-2 py-1.5">
                      <span className="num text-xs text-tinta-3">{fechaCorta(m.fechaCargo)}</span>
                      <span className="min-w-0">
                        <span className="block truncate">{m.concepto}</span>
                        <small className="text-tinta-3">{grupo(m.grupoId)?.nombre ?? CLASES[claseDe(m)]}</small>
                      </span>
                      <span className={cn("num whitespace-nowrap font-semibold", sg > 0 && "text-oliva-osc")}>
                        {sg === 0 ? "⇄ " : sg > 0 ? "+" : "−"}
                        {eur(Math.abs(m.importeCent))}
                      </span>
                      <Link
                        href={`/movimientos?mes=${m.fechaCargo.slice(0, 7)}&editar=${m.id}`}
                        className="grid size-8 place-items-center rounded-md text-tinta-3 hover:bg-papel-2 hover:text-oliva-osc"
                        aria-label={`Editar ${m.concepto}`}
                        title="Editar"
                      >
                        <Pencil className="size-3.5" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-tinta-3">Aún no hay movimientos.</p>
            )}
          </Tarjeta>
        </section>

        {mes < mesHoy && <Cierre movs={d.movs} mes={mes} filas={filas} />}
      </div>
    </main>
  );
}

function Tarjeta({ titulo, subtitulo, accion, children }: { titulo: string; subtitulo?: string; accion?: { href: string; texto: string }; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-linea-suave bg-papel p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className="text-lg font-bold">{titulo}</h2>
        {accion && (
          <Link href={accion.href} className="text-sm font-bold text-oliva-osc hover:underline">
            {accion.texto}
          </Link>
        )}
        {subtitulo && <p className="w-full text-xs text-tinta-3">{subtitulo}</p>}
      </div>
      {children}
    </div>
  );
}

function TarjetaCuenta({ nombre, cuenta, valor, children }: { nombre: string; cuenta: Cuenta; valor: number | null; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-t-4 border-linea-suave bg-papel p-4" style={{ borderTopColor: COLOR_CUENTA[cuenta] }}>
      <span className="text-xs font-bold uppercase tracking-[0.1em] text-tinta-2">{nombre}</span>
      <span className={cn("text-2xl font-bold", valor != null && valor < 0 && "text-burdeos")}>{valor == null ? "—" : eur(valor)}</span>
      <span className="text-xs leading-relaxed text-tinta-3">{children}</span>
    </div>
  );
}

function Kpi({ etiqueta, valor, secundario, malo }: { etiqueta: string; valor: string; secundario?: boolean; malo?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-1 rounded-xl border p-4", secundario ? "border-dashed border-linea bg-transparent" : "border-linea-suave bg-papel")}>
      <span className="text-xs text-tinta-2">{etiqueta}</span>
      <span className={cn("font-bold", secundario ? "text-lg" : "text-2xl", malo && "text-burdeos")}>{valor}</span>
    </div>
  );
}

const TONO: Record<Aviso["tono"], { caja: string; icono: React.ElementType; etiqueta: string }> = {
  oliva: { caja: "border-[#c9d3b8] bg-oliva-claro text-[#2f3a2a]", icono: Check, etiqueta: "Para hacer" },
  ambar: { caja: "border-[#e5cf9c] bg-ambar-claro text-[#4f3a10]", icono: Clock, etiqueta: "Atención" },
  rojo: { caja: "border-[#dcb3aa] bg-burdeos-claro text-[#4e1717]", icono: AlertTriangle, etiqueta: "Aviso" },
};

function AvisoFila({ a }: { a: Aviso }) {
  const t = TONO[a.tono];
  const Icono = t.icono;
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border px-4 py-2.5 text-sm", t.caja)}>
      <Icono className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>
        <span className="sr-only">{t.etiqueta}: </span>
        <b>{a.titulo}</b> {a.texto}{" "}
        {a.enlace && (
          <Link href={a.enlace.href} className="font-bold underline">
            {a.enlace.texto}
          </Link>
        )}
      </p>
    </div>
  );
}

const ESTADO: Record<FilaGrupo["estado"], { barra: string; texto: string }> = {
  verde: { barra: "bg-oliva", texto: "bien" },
  ambar: { barra: "bg-ambar", texto: "cerca del límite" },
  rojo: { barra: "bg-burdeos", texto: "por encima" },
  sin: { barra: "bg-linea", texto: "sin presupuesto" },
};

function Semaforo({ filas }: { filas: FilaGrupo[] }) {
  const presupuesto = filas.reduce((a, f) => a + f.presupuesto, 0);
  const real = filas.reduce((a, f) => a + f.real, 0);
  return (
    <Tarjeta titulo="Semáforo por grupo" subtitulo={`${eur(real)} gastados de ${eur(presupuesto)} de presupuesto. Verde hasta el 80 %, ámbar hasta el 100 %, burdeos por encima.`}>
      <ul className="flex flex-col gap-3">
        {filas.map((f) => {
          const ancho = f.presupuesto > 0 ? Math.min(Math.max(f.real, 0) / f.presupuesto, 1) * 100 : f.real > 0 ? 100 : 0;
          const e = ESTADO[f.estado];
          return (
            <li key={f.grupo.id} className="grid grid-cols-[minmax(7rem,9rem)_minmax(0,1fr)] items-center gap-x-4 gap-y-1 sm:grid-cols-[9rem_minmax(0,1fr)_minmax(11rem,auto)]">
              <span className="flex min-w-0 items-center gap-2 font-semibold">
                <i className="size-2.5 shrink-0 rounded-full" style={{ background: f.grupo.color }} aria-hidden />
                <span className="truncate">{f.grupo.nombre}</span>
              </span>
              <div
                className="h-2 overflow-hidden rounded-full bg-papel-2"
                role="meter"
                aria-label={`${f.grupo.nombre}: ${e.texto}`}
                aria-valuemin={0}
                aria-valuemax={f.presupuesto}
                aria-valuenow={Math.max(f.real, 0)}
                aria-valuetext={`${eur(f.real)} de ${eur(f.presupuesto)}`}
              >
                <div className={cn("h-full rounded-full", e.barra)} style={{ width: `${ancho}%` }} />
              </div>
              <span className="num col-span-2 text-right text-sm sm:col-span-1">
                <b className={cn(f.estado === "rojo" && "text-burdeos")}>{eur(f.real)}</b>
                <span className="text-tinta-3">
                  {" "}
                  / {eur(f.presupuesto)}
                  {f.presupuesto > 0 && ` · ${Math.round((f.real / f.presupuesto) * 100)} %`}
                </span>
                {(f.grupo.efectivoPrevistoCent ?? 0) > 0 && (
                  <small className="block text-xs text-tinta-3">
                    en efectivo {eur(f.efectivo, 0)} de {eur(f.grupo.efectivoPrevistoCent ?? 0, 0)} previstos
                  </small>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </Tarjeta>
  );
}

function Cierre({ movs, mes, filas }: { movs: Parameters<typeof cierreMes>[0]; mes: string; filas: FilaGrupo[] }) {
  const c = cierreMes(movs, mes);
  const cambio = (v: number, subirEsMalo = false) => (
    <span className={cn("num", v !== 0 && (v > 0) === subirEsMalo && "text-burdeos")}>
      {v > 0 ? "+" : ""}
      {eur(v)}
    </span>
  );
  return (
    <section className="rounded-xl border border-linea-suave bg-papel p-5">
      <h2 className="text-lg font-bold">Cierre de {nombreMes(mes)}</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs text-tinta-2">Total ahorrado (Trade Republic + hucha)</p>
          <p className="text-2xl font-bold">{eur(c.ahorrado.valor)}</p>
          <p className="text-xs text-tinta-3">frente al mes anterior {cambio(c.ahorrado.cambio)}</p>
        </div>
        <div>
          <p className="text-xs text-tinta-2">Gasto total</p>
          <p className="text-2xl font-bold">{eur(c.gasto.valor)}</p>
          <p className="text-xs text-tinta-3">frente al mes anterior {cambio(c.gasto.cambio, true)}</p>
        </div>
        <div>
          <p className="text-xs text-tinta-2">Disponible final</p>
          <p className={cn("text-2xl font-bold", c.disponible.valor < 0 && "text-burdeos")}>{eur(c.disponible.valor)}</p>
          <p className="text-xs text-tinta-3">frente al mes anterior {cambio(c.disponible.cambio)}</p>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="num w-full text-sm">
          <thead className="text-left text-xs text-tinta-3">
            <tr>
              <th className="py-1.5 font-semibold">Grupo</th>
              <th className="py-1.5 text-right font-semibold">Presupuesto</th>
              <th className="py-1.5 text-right font-semibold">Real</th>
              <th className="py-1.5 text-right font-semibold">Diferencia</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-linea-suave">
            {filas
              .filter((f) => f.presupuesto || f.real)
              .map((f) => (
                <tr key={f.grupo.id}>
                  <td className="py-1.5">{f.grupo.nombre}</td>
                  <td className="py-1.5 text-right">{eur(f.presupuesto)}</td>
                  <td className="py-1.5 text-right">{eur(f.real)}</td>
                  <td className={cn("py-1.5 text-right", f.real > f.presupuesto && "font-bold text-burdeos")}>
                    {f.real > f.presupuesto ? "+" : ""}
                    {eur(f.real - f.presupuesto)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
