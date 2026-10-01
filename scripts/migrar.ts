import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { abrirBaseDatos } from "../src/db";

const db = abrirBaseDatos();
migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migraciones aplicadas.");
