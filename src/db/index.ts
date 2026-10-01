import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as schema from "./schema";

export type BaseDatos = BetterSQLite3Database<typeof schema>;

export function abrirBaseDatos(ruta = process.env.DB_PATH ?? "./data/finanzas.db"): BaseDatos {
  if (ruta !== ":memory:") mkdirSync(dirname(ruta), { recursive: true });
  const sqlite = new Database(ruta);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

// Una sola conexión por proceso; en desarrollo sobrevive a las recargas de Next.
const global_ = globalThis as unknown as { __db?: BaseDatos };
export function db(): BaseDatos {
  global_.__db ??= abrirBaseDatos();
  return global_.__db;
}
