/**
 * Programmatic migration runner.
 *
 * Replaces `drizzle-kit migrate`, which exits 1 in this environment even when
 * there is nothing to apply. Uses drizzle-orm's postgres-js migrator against the
 * same `drizzle/` folder + `drizzle.__drizzle_migrations` bookkeeping table.
 *
 * Env loading mirrors drizzle.config.ts: load .env.local on the host and rewrite
 * the Docker hostname (@db:) to the exposed localhost port.
 */
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import { existsSync } from "fs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { logDbTarget } from "./lib/db-target";

const isInsideDocker = !existsSync(".env.production");
if (!isInsideDocker) {
  expand(config({ path: ".env.production", override: true }));
}

const raw = process.env.DATABASE_URL;
if (!raw) {
  console.error("[migrate] DATABASE_URL is not set. Check your .env.production file.");
  process.exit(1);
}
const databaseUrl = isInsideDocker
  ? raw.replace("@db:", "@srams_db:")   // Docker: use service hostname
  : raw.replace("@db:", "@localhost:"); // Host: use localhost

async function main() {
  // Migrations require a single sequential connection.
  const client = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  const db = drizzle(client);

  logDbTarget("migrate", databaseUrl);
  console.log("[migrate] applying pending migrations…");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("[migrate] done — schema is up to date.");

  await client.end();
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
