import { Cabecera } from "@/components/app/marco";
import { SelectorMes } from "@/components/app/selector-mes";
import { CampoGrupo, CampoParametro } from "@/components/presupuesto/campos";
import { db } from "@/db";
import { leerParametros, todosLosGrupos } from "@/db/movimientos";
import * as t from "@/db/schema";
import { esMes, eur, hoy, MESES, menos } from "@/lib/formato";
import { planMes } from "@/lib/plan";
import { eventosDelMes, presupuestoGrupo } from "@/lib/reglas";
import { cn } from "@/lib/utils";

export const metadata = { title: "Presupuesto · Finanzas" };

const COLOR = { ahorro: "#607456", hucha: "#8C9C7C", gasto: "#BA6A4C" };

export default async function Presupuesto({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes: param } = await searchParams;
  const mes = esMes(param) ? param : hoy().slice(0, 7);
  const nombre = MESES[Number(mes.slice(5)) - 1];
  const base = db();
  const p = leerParametros(base) as Record<string, number>;
  const grupos = todosLosGrupos(base).filter((g) => g.activo);
  const eventos = base.select().from(t.eventos).all();

  const nomina = p.nomina_cent ?? 0, traspaso = p.traspaso_tr_cent ?? 0, paso = p.paso_inversion_cent ?? 0, hucha = p.objetivo_hucha_cent ?? 0;
  const plan = planMes({ grupos, eventos, mes, nominaCent: nomina, traspasoTrCent: traspaso, huchaCent: hucha });
  const filas = [
    { nombre: "Ahorro e inversión", detalle: "Traspaso a Trade Republic", valor: traspaso, color: COLOR.ahorro },
    { nombre: "Hucha de Revolut", detalle: "Objetivo mensual", valor: hucha, color: COLOR.hucha },
    {
      nombre: "Gasto con cargo a la nómina",
      detalle: `Presupuesto de los grupos en ${nombre} (${eur(plan.presupuesto)}) menos lo previsto en efectivo (${eur(plan.efectivo)})`,
      valor: plan.conNomina,
      color: COLOR.gasto,
    },
  ];
  const usado = traspaso + hucha + plan.conNomina;
  const escala = Math.max(nomina, usado) || 1;
  const ancho = (v: number) => `${(Math.max(v, 0) / escala) * 100}%`;
  const estado = { no_cierra: ["No cierra", "bg-burdeos-claro text-[#4e1717]"], justo: ["Cierra muy justo", "bg-terracota-claro text-[#7a3b23]"], cierra: ["Cierra", "bg-oliva-claro text-oliva-osc"] }[plan.estado];

  return (
    <main className="pb-12">
      <Cabecera titulo="Presupuesto">
        <SelectorMes ruta="/presupuesto" mes={mes} />
      </Cabecera>
      <div className="flex flex-col gap-8 px-4 pt-3 sm:px-8">
        <section className="grid gap-5 lg:grid-cols-2">
          {/* El plan: cómo se reparte la nómina */}
          <div className="flex flex-col gap-3 rounded-xl border border-linea-suave bg-papel p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-tinta-2">Margen del plan · {nombre}</span>
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", estado[1])}>{estado[0]}</span>
            </div>
            <p className={cn("text-5xl font-bold tracking-tight", plan.margen < 0 && "text-burdeos")}>{eur(plan.margen)}</p>
            <p className="text-sm text-tinta-3">
              {plan.margen < 0
                ? `Al gasto presupuestado le faltan ${eur(-plan.margen)} de nómina después de ahorrar.`
                : "Lo que sobra de la nómina después de ahorrar y cubrir el presupuesto."}
            </p>
            <div className="relative mt-1 flex h-3 gap-[2px]" role="img" aria-label={`Reparto de la nómina: ${filas.map((f) => `${f.nombre} ${eur(f.valor)}`).join(", ")}${plan.margen > 0 ? `, margen ${eur(plan.margen)}` : ""}`}>
              {filas.map((f) => (
                <i key={f.nombre} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: ancho(f.valor), background: f.color }} title={`${f.nombre}: ${eur(f.valor)}`} />
              ))}
              {plan.margen > 0 && <i className="h-full rounded-r-full bg-linea-suave" style={{ width: ancho(plan.margen) }} title={`Margen: ${eur(plan.margen)}`} />}
              {plan.margen < 0 && <b className="absolute -inset-y-1 w-0.5 bg-tinta" style={{ left: ancho(nomina) }} title="Hasta aquí llega la nómina" />}
            </div>
            <dl className="num mt-2 divide-y divide-linea-suave text-sm">
              <div className="flex justify-between py-2 font-bold">
                <dt>Nómina neta</dt>
                <dd>{eur(nomina)}</dd>
              </div>
              {filas.map((f) => (
                <div key={f.nombre} className="flex justify-between gap-4 py-2">
                  <dt className="flex gap-2">
                    <i className="mt-1.5 size-2.5 shrink-0 rounded-sm" style={{ background: f.color }} aria-hidden />
                    <span>
                      {f.nombre}
                      <small className="block text-xs text-tinta-3">{f.detalle}</small>
                    </span>
                  </dt>
                  <dd className="whitespace-nowrap font-bold">{menos(f.valor)}</dd>
                </div>
              ))}
              <div className={cn("flex justify-between border-t-2 py-2 text-base font-bold", plan.margen < 0 && "text-burdeos")}>
                <dt>{plan.margen < 0 ? "Falta" : "Margen"}</dt>
                <dd>{eur(plan.margen)}</dd>
              </div>
            </dl>
          </div>

          {/* Ingresos y ahorro */}
          <div className="rounded-xl border border-linea-suave bg-papel p-5 sm:p-6">
            <h2 className="text-lg font-bold">Ingresos y ahorro</h2>
            <div className="mt-4 grid grid-cols-[minmax(0,1fr)_8.5rem] items-center gap-x-4 gap-y-3">
              {(
                [
                  ["nomina_cent", "Nómina neta mensual", nomina],
                  ["traspaso_tr_cent", "Traspaso mensual a Trade Republic", traspaso],
                  ["paso_inversion_cent", "De ello, pasa a Inversión TR el día 2", paso],
                  ["objetivo_hucha_cent", "Objetivo mensual de la hucha", hucha],
                ] as const
              ).map(([clave, texto, valor]) => (
                <div key={clave} className="contents">
                  <label htmlFor={`p-${clave}`} className="text-sm font-semibold">
                    {texto}
                  </label>
                  <CampoParametro clave={clave} valorCent={valor} etiqueta={texto} />
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-tinta-3">
              Se guarda al salir de cada casilla. Se quedan {eur(traspaso - paso)} en Ahorro TR y {eur(paso)} pasan a Inversión TR. Es el importe habitual: cada mes
              puedes cambiarlo al confirmarlo en Movimientos.
            </p>
          </div>
        </section>

        {/* Presupuesto por grupo */}
        <section>
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
            <h2 className="text-xl font-bold">Presupuesto mensual por grupo</h2>
            <p className="text-sm text-tinta-3">El presupuesto de {nombre} suma a cada grupo sus eventos del calendario. Regalos solo tiene eventos.</p>
          </div>
          <div className="rounded-xl border border-linea-suave bg-papel p-5 sm:p-6">
            <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] items-center gap-x-2 gap-y-2.5 sm:grid-cols-[minmax(0,1fr)_8.5rem_8.5rem] sm:gap-x-3">
              <span className="text-xs font-bold uppercase tracking-[0.1em] text-tinta-2">Grupo</span>
              <span className="text-right text-xs font-bold uppercase tracking-[0.1em] text-tinta-2">Presupuesto</span>
              <span className="text-right text-xs font-bold uppercase tracking-[0.1em] text-tinta-2">
                <span className="sm:hidden">Efectivo</span>
                <span className="max-sm:hidden">De ello, en efectivo</span>
              </span>
              {grupos.map((g) => {
                const deEventos = eventosDelMes(eventos, mes, g.id).reduce((a, e) => a + e.importePrevistoCent, 0);
                return (
                  <div key={g.id} className="contents">
                    <label htmlFor={g.esDinamico ? `g${g.id}-efectivoPrevistoCent` : `g${g.id}-presupuestoCent`} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 font-semibold max-sm:text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <i className="size-2.5 shrink-0 rounded-sm" style={{ background: g.color }} aria-hidden />
                        <span className="truncate">{g.nombre}</span>
                      </span>
                      {g.esDinamico ? (
                        <span className="rounded-full bg-papel-2 px-2 py-px text-[11px] font-bold text-tinta-2">según calendario</span>
                      ) : deEventos > 0 ? (
                        <span className="rounded-full bg-terracota-claro px-2 py-px text-[11px] font-bold text-[#7a3b23]" title={`Eventos del calendario en ${nombre}`}>
                          +{eur(deEventos)} de eventos
                        </span>
                      ) : null}
                    </label>
                    {g.esDinamico ? (
                      <span className="num pr-3 text-right" title="Se cambia en el calendario anual">
                        {eur(presupuestoGrupo(g, mes, eventos))}
                      </span>
                    ) : (
                      <CampoGrupo id={g.id} campo="presupuestoCent" valorCent={g.presupuestoCent ?? 0} etiqueta={`Presupuesto de ${g.nombre}`} />
                    )}
                    <CampoGrupo id={g.id} campo="efectivoPrevistoCent" valorCent={g.efectivoPrevistoCent} etiqueta={`Parte en efectivo de ${g.nombre}`} />
                  </div>
                );
              })}
              <span className="border-t border-linea pt-2.5 font-bold">
                Total<span className="max-sm:hidden"> presupuestado en {nombre}</span>
              </span>
              <span className="num border-t border-linea pr-3 pt-2.5 text-right font-bold">{eur(plan.presupuesto)}</span>
              <span className="num border-t border-linea pr-3 pt-2.5 text-right font-bold">{eur(plan.efectivo)}</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
