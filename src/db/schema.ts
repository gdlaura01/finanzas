/**
 * Esquema de la base de datos (SQLite + Drizzle).
 *
 * Convenciones:
 * - Importes en céntimos enteros (`*_cent`) para no arrastrar errores de redondeo.
 * - Fechas como texto ISO `AAAA-MM-DD`; meses como `AAAA-MM`.
 * - El mes de un movimiento lo decide su `fecha_cargo`.
 */
import { sql } from "drizzle-orm";
import {
  sqliteTable,
  integer,
  text,
  index,
  uniqueIndex,
  primaryKey,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

export const TIPOS = ["gasto", "ingreso", "ahorro", "traspaso", "interno"] as const;
export const MEDIOS = ["imagin", "revolut", "efectivo", "trade_republic"] as const;
export const CUENTAS = ["imagin", "ahorro_tr", "inversion_tr", "hucha_revolut"] as const;
export const ORIGENES = ["manual", "atajo", "recurrente", "importacion", "carga_inicial"] as const;
export const CLASES_RECURRENTE = ["entrada", "gasto", "ahorro", "hucha", "interno", "interes", "valoracion"] as const;
export const VINCULOS_RECURRENTE = ["nomina", "traspaso_tr", "paso_inversion"] as const;
export const CLASES_ATAJO = ["gasto", "entrada", "ahorro", "hucha", "retirada"] as const;

export type Tipo = (typeof TIPOS)[number];
export type Medio = (typeof MEDIOS)[number];
export type Cuenta = (typeof CUENTAS)[number];

const ahora = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

export const grupos = sqliteTable("grupos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nombre: text("nombre").notNull().unique(),
  color: text("color").notNull(),
  orden: integer("orden").notNull(),
  // Nulo en grupos dinámicos (Regalos): su presupuesto sale del calendario.
  presupuestoCent: integer("presupuesto_cent"),
  // Parte del presupuesto que se espera pagar en efectivo (no resta de la nómina).
  efectivoPrevistoCent: integer("efectivo_previsto_cent").notNull().default(0),
  esDinamico: integer("es_dinamico", { mode: "boolean" }).notNull().default(false),
  // Un grupo con movimientos no se borra: se archiva.
  activo: integer("activo", { mode: "boolean" }).notNull().default(true),
  creadoEn: text("creado_en").notNull().default(ahora),
});

export const importaciones = sqliteTable("importaciones", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fecha: text("fecha").notNull().default(ahora),
  archivo: text("archivo").notNull(),
  mapeoId: integer("mapeo_id").references(() => mapeosExtracto.id),
  filasLeidas: integer("filas_leidas").notNull().default(0),
  aceptadas: integer("aceptadas").notNull().default(0),
  descartadas: integer("descartadas").notNull().default(0),
});

export const mapeosExtracto = sqliteTable("mapeos_extracto", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nombre: text("nombre").notNull().unique(),
  // Columnas, formato de fecha e importe, filas que saltar… en JSON.
  configuracion: text("configuracion", { mode: "json" }).notNull(),
});

export const recurrentes = sqliteTable("recurrentes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  concepto: text("concepto").notNull(),
  clase: text("clase", { enum: CLASES_RECURRENTE }).notNull(),
  grupoId: integer("grupo_id").references(() => grupos.id),
  etiqueta: text("etiqueta"),
  medio: text("medio", { enum: MEDIOS }).notNull(),
  cuentaOrigen: text("cuenta_origen", { enum: CUENTAS }),
  cuentaDestino: text("cuenta_destino", { enum: CUENTAS }),
  // Nulo = importe variable (intereses, valor de la inversión) o vinculado a un parámetro.
  importeCent: integer("importe_cent"),
  // Si tiene vínculo, el importe se toma del parámetro correspondiente.
  vinculo: text("vinculo", { enum: VINCULOS_RECURRENTE }),
  // Nulo = sin día fijo (por ejemplo, la nómina).
  dia: integer("dia"),
  // false = se pide confirmar en Pendientes con la fecha real.
  auto: integer("auto", { mode: "boolean" }).notNull().default(false),
  activo: integer("activo", { mode: "boolean" }).notNull().default(true),
  desde: text("desde").notNull(),
});

export const recurrentesOmitidos = sqliteTable(
  "recurrentes_omitidos",
  {
    recurrenteId: integer("recurrente_id")
      .notNull()
      .references(() => recurrentes.id, { onDelete: "cascade" }),
    periodo: text("periodo").notNull(),
  },
  (t) => [primaryKey({ columns: [t.recurrenteId, t.periodo] })],
);

export const movimientos = sqliteTable(
  "movimientos",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    fechaCompra: text("fecha_compra").notNull(),
    fechaCargo: text("fecha_cargo").notNull(),
    concepto: text("concepto").notNull(),
    conceptoNorm: text("concepto_norm").notNull(),
    grupoId: integer("grupo_id").references(() => grupos.id),
    etiqueta: text("etiqueta"),
    tipo: text("tipo", { enum: TIPOS }).notNull(),
    medio: text("medio", { enum: MEDIOS }).notNull(),
    // Siempre positivo salvo en gastos: un gasto negativo es una devolución o un bizum recibido.
    importeCent: integer("importe_cent").notNull(),
    cuentaOrigen: text("cuenta_origen", { enum: CUENTAS }),
    cuentaDestino: text("cuenta_destino", { enum: CUENTAS }),
    // Retirada de la hucha que cubre un gasto: se borra con el gasto.
    vinculadoId: integer("vinculado_id").references((): AnySQLiteColumn => movimientos.id, { onDelete: "cascade" }),
    recurrenteId: integer("recurrente_id").references(() => recurrentes.id, { onDelete: "set null" }),
    periodo: text("periodo"),
    origen: text("origen", { enum: ORIGENES }).notNull().default("manual"),
    importacionId: integer("importacion_id").references(() => importaciones.id),
    pendienteRevision: integer("pendiente_revision", { mode: "boolean" }).notNull().default(false),
    notas: text("notas"),
    creadoEn: text("creado_en").notNull().default(ahora),
    actualizadoEn: text("actualizado_en").notNull().default(ahora),
  },
  (t) => [
    index("mov_fecha_cargo").on(t.fechaCargo),
    index("mov_grupo_cargo").on(t.grupoId, t.fechaCargo),
    index("mov_etiqueta").on(t.etiqueta),
    index("mov_duplicados").on(t.fechaCargo, t.importeCent, t.conceptoNorm),
    // Un recurrente no se registra dos veces el mismo mes.
    uniqueIndex("mov_recurrente_periodo").on(t.recurrenteId, t.periodo),
  ],
);

export const eventos = sqliteTable("eventos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nombre: text("nombre").notNull(),
  // Nulo = sin mes asignado.
  mes: integer("mes"),
  dia: integer("dia"),
  // Nulo = se repite cada año; con valor = solo ese año.
  anio: integer("anio"),
  grupoId: integer("grupo_id")
    .notNull()
    .references(() => grupos.id),
  // Enlaza el gasto real con el evento.
  etiqueta: text("etiqueta").notNull().unique(),
  // Nulo = el color del grupo.
  color: text("color"),
  importePrevistoCent: integer("importe_previsto_cent").notNull(),
  notas: text("notas"),
});

export const atajos = sqliteTable("atajos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  textoBoton: text("texto_boton").notNull(),
  concepto: text("concepto").notNull(),
  clase: text("clase", { enum: CLASES_ATAJO }).notNull(),
  // Solo en entradas: forzar ingreso o devolución.
  entradaComo: text("entrada_como", { enum: ["ingreso", "devolucion"] }),
  grupoId: integer("grupo_id").references(() => grupos.id),
  etiqueta: text("etiqueta"),
  medio: text("medio", { enum: MEDIOS }).notNull(),
  // Nulo = importe variable.
  importeCent: integer("importe_cent"),
  orden: integer("orden").notNull(),
  usos: integer("usos").notNull().default(0),
});

export const reglasImportacion = sqliteTable("reglas_importacion", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // Palabras separadas por «|», sobre el concepto sin tildes ni mayúsculas.
  patron: text("patron").notNull(),
  grupoId: integer("grupo_id")
    .notNull()
    .references(() => grupos.id),
  etiqueta: text("etiqueta"),
  prioridad: integer("prioridad").notNull(),
});

export const parametros = sqliteTable("parametros", {
  clave: text("clave").primaryKey(),
  valor: text("valor", { mode: "json" }).notNull(),
});

export const cuadres = sqliteTable(
  "cuadres",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    cuenta: text("cuenta", { enum: CUENTAS }).notNull(),
    fecha: text("fecha").notNull(),
    saldoRealCent: integer("saldo_real_cent").notNull(),
    // Lo que calculaba la app al cuadrar; nulo en los saldos de partida.
    saldoCalculadoCent: integer("saldo_calculado_cent"),
    esPartida: integer("es_partida", { mode: "boolean" }).notNull().default(false),
    estimado: integer("estimado", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("cuadre_cuenta_fecha").on(t.cuenta, t.fecha)],
);

export const intereses = sqliteTable(
  "intereses",
  {
    cuenta: text("cuenta", { enum: CUENTAS }).notNull(),
    // Se cobran el día 1 del mes indicado.
    mes: text("mes").notNull(),
    importeCent: integer("importe_cent").notNull(),
  },
  (t) => [primaryKey({ columns: [t.cuenta, t.mes] })],
);

export const valoracionesInversion = sqliteTable("valoraciones_inversion", {
  fecha: text("fecha").primaryKey(),
  valorCent: integer("valor_cent").notNull(),
});

export const syncDrive = sqliteTable("sync_drive", {
  id: integer("id").primaryKey(),
  estado: text("estado", { enum: ["ok", "pendiente", "error"] }).notNull().default("ok"),
  pendiente: integer("pendiente", { mode: "boolean" }).notNull().default(false),
  intentos: integer("intentos").notNull().default(0),
  proximoIntento: text("proximo_intento"),
  ultimoError: text("ultimo_error"),
  ultimoOk: text("ultimo_ok"),
  fileId: text("file_id"),
});

