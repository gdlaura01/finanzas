/** Los scripts leen .env.local igual que la app (por ejemplo, DB_PATH). Importarlo el primero. */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
