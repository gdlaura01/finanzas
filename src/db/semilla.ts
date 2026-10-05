/**
 * Datos iniciales: configuración de partida de la app.
 * Los movimientos de mayo a octubre no van aquí: los carga el importador
 * de la carga inicial a partir de tu hoja de seguimiento.
 */
import { sql } from "drizzle-orm";
import type { BaseDatos } from ".";
import * as t from "./schema";

const GRUPOS = [
  { nombre: "Gasolina", color: "#BA6A4C", presupuestoCent: 43500, efectivoPrevistoCent: 20000 },
  { nombre: "Formación", color: "#46553F", presupuestoCent: 3000 },
  { nombre: "IA", color: "#8C9C7C", presupuestoCent: 3000 },
  { nombre: "SCOUTS", color: "#BE8A2A", presupuestoCent: 2500 },
  { nombre: "Regalos", color: "#7B2525", presupuestoCent: null, esDinamico: true },
  { nombre: "Salud", color: "#607456", presupuestoCent: 2500 },
  { nombre: "Ropa", color: "#D9977A", presupuestoCent: 7000 },
  { nombre: "Caprichos", color: "#9E4A33", presupuestoCent: 17000 },
  { nombre: "Iglesia", color: "#6E5A4A", presupuestoCent: 1000 },
  { nombre: "Otros", color: "#A8977F", presupuestoCent: 7000 },
];

export const PARAMETROS: Record<string, unknown> = {
  nomina_cent: 133191,
  traspaso_tr_cent: 80000,
  paso_inversion_cent: 15000,
  objetivo_hucha_cent: 15000,
  tasa_ahorro_tr: 2.5,
  colchon_meses: 3,
  fecha_corte: "2026-08-31",
};

export function sembrar(db: BaseDatos) {
  const yaHay = db.select({ n: sql<number>`count(*)` }).from(t.grupos).get();
  if (yaHay && yaHay.n > 0) return false;

  db.transaction((tx) => {
    tx.insert(t.grupos).values(GRUPOS.map((g, i) => ({ ...g, orden: i + 1 }))).run();
    const id = Object.fromEntries(tx.select().from(t.grupos).all().map((g) => [g.nombre, g.id]));

    tx.insert(t.parametros).values(Object.entries(PARAMETROS).map(([clave, valor]) => ({ clave, valor }))).run();

    tx.insert(t.eventos)
      .values([
        { nombre: "Navidad (total de regalos)", mes: 12, grupoId: id.Regalos, etiqueta: "Navidad", importePrevistoCent: 20000 },
        { nombre: "Aniversario", grupoId: id.Regalos, etiqueta: "Aniversario", importePrevistoCent: 4000 },
        ...Array.from({ length: 8 }, (_, i) => ({
          nombre: `Cumpleaños ${i + 1}`,
          grupoId: id.Regalos,
          etiqueta: `Cumple ${i + 1}`,
          importePrevistoCent: 4000,
        })),
      ])
      .run();

    const desde = "2026-10";
    tx.insert(t.recurrentes)
      .values([
        { concepto: "Nómina", clase: "entrada", vinculo: "nomina", medio: "imagin", cuentaDestino: "imagin", desde },
        { concepto: "Traspaso a Trade Republic (ahorro + inversión)", clase: "ahorro", vinculo: "traspaso_tr", medio: "trade_republic", cuentaOrigen: "imagin", cuentaDestino: "ahorro_tr", desde },
        { concepto: "Paso de Ahorro TR a Inversión TR", clase: "interno", vinculo: "paso_inversion", medio: "trade_republic", cuentaOrigen: "ahorro_tr", cuentaDestino: "inversion_tr", dia: 2, desde },
        { concepto: "Intereses de Ahorro TR", clase: "interes", medio: "trade_republic", cuentaDestino: "ahorro_tr", dia: 1, desde },
        { concepto: "Traspaso a la hucha", clase: "hucha", medio: "revolut", cuentaOrigen: "imagin", cuentaDestino: "hucha_revolut", importeCent: 15000, dia: 5, desde },
        { concepto: "Claude", clase: "gasto", grupoId: id.IA, etiqueta: "Suscripción", medio: "imagin", importeCent: 2178, dia: 16, desde },
        { concepto: "Spotify", clase: "gasto", grupoId: id.Caprichos, etiqueta: "Suscripción", medio: "imagin", importeCent: 1199, dia: 28, desde },
        { concepto: "Anotar el valor de Inversión TR", clase: "valoracion", medio: "trade_republic", cuentaDestino: "inversion_tr", dia: 28, desde },
      ])
      .run();

    tx.insert(t.atajos)
      .values([
        { textoBoton: "Gasolina efectivo", concepto: "Gasolina", clase: "gasto", grupoId: id.Gasolina, etiqueta: "Trabajo", medio: "efectivo", importeCent: 5000 },
        { textoBoton: "Gasolina tarjeta", concepto: "Gasolina", clase: "gasto", grupoId: id.Gasolina, etiqueta: "Trabajo", medio: "imagin" },
        { textoBoton: "Bizum enviado", concepto: "Bizum enviado", clase: "gasto", grupoId: id.Otros, medio: "imagin" },
        { textoBoton: "Bizum recibido", concepto: "Bizum recibido", clase: "entrada", entradaComo: "devolucion", grupoId: id.Otros, medio: "imagin" },
        { textoBoton: "Café / bar", concepto: "Bar", clase: "gasto", grupoId: id.Caprichos, medio: "imagin" },
        { textoBoton: "Sacar de la hucha", concepto: "Retirada de la hucha", clase: "retirada", medio: "revolut" },
        { textoBoton: "Claude", concepto: "Claude", clase: "gasto", grupoId: id.IA, etiqueta: "Suscripción", medio: "imagin", importeCent: 2178 },
      ].map((a, i) => ({ ...a, orden: i + 1 } as typeof t.atajos.$inferInsert)))
      .run();

    const reglas: [string, string, string | null][] = [
      // Cómo escribe Imagin algunos conceptos (también en la migración 0001_reglas_banco)
      ["^h m$|\\beci\\b", "Ropa", null],
      ["viryi nails|^bk", "Caprichos", null],
      ["anthropic", "IA", null],
      ["econoil|plenoil|petroil|^eess |^e\\. ?s\\. ", "Gasolina", "Trabajo"],
      ["gasolina|petroprix|repsol|cepsa", "Gasolina", "Trabajo"],
      ["udemy|curso", "Formación", "Suscripción"],
      ["claude|openai|chatgpt", "IA", null],
      ["prozis|gimnasio|saiyanworkout|farmacia", "Salud", null],
      ["zara|lefties|springfield|^hm$|la redoute|shein|corte ingles|^eci$|cc la sierra", "Ropa", null],
      ["spotify|netflix", "Caprichos", "Suscripción"],
      ["casa del libro|comic|libreria", "Caprichos", "Lectura"],
      ["viryinails|burger|^bar|cafe|pizza|cine|teatro|museo|tattoo|mandragora|caseta|pinky|barsa|gioelia|hotel|beanywood|joy", "Caprichos", null],
      ["iglesia|colecta|parroquia", "Iglesia", null],
      ["scout", "SCOUTS", null],
      ["bizum|mercadona|aldi|market|deza|autoservicio|amazon|metro|alsa|ouigo|parking|paypal|locutorio|puerto", "Otros", null],
    ];
    tx.insert(t.reglasImportacion)
      .values(reglas.map(([patron, g, etiqueta], i) => ({ patron, grupoId: id[g], etiqueta, prioridad: (i + 1) * 10 })))
      .run();

    // Saldos de partida. Imagin es una estimación desde tu hoja (351,51 € a 30/04).
    tx.insert(t.cuadres)
      .values([
        { cuenta: "imagin", fecha: "2026-04-30", saldoRealCent: 35151, esPartida: true, estimado: true },
        { cuenta: "ahorro_tr", fecha: "2026-08-31", saldoRealCent: 191166, esPartida: true },
        { cuenta: "hucha_revolut", fecha: "2026-08-31", saldoRealCent: 0, esPartida: true },
      ])
      .run();

    const pagos: [string, number][] = [
      ["2026-02", 9], ["2026-03", 25], ["2026-04", 28], ["2026-05", 49], ["2026-06", 110],
      ["2026-07", 197], ["2026-08", 312], ["2026-09", 369], ["2026-10", 462],
    ];
    tx.insert(t.intereses).values(pagos.map(([mes, importeCent]) => ({ cuenta: "ahorro_tr" as const, mes, importeCent }))).run();

    tx.insert(t.valoracionesInversion)
      .values([
        { fecha: "2026-05-31", valorCent: 20378 },
        { fecha: "2026-06-30", valorCent: 50374 },
        { fecha: "2026-07-31", valorCent: 79656 },
        { fecha: "2026-08-31", valorCent: 111225 },
        { fecha: "2026-09-30", valorCent: 144888 },
      ])
      .run();

    tx.insert(t.syncDrive).values({ id: 1 }).run();
  });
  return true;
}
