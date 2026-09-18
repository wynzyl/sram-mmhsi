/**
 * Programmatic migration runner.
 *
 * Replaces `drizzle-kit migrate`, which exits 1 in this environment even when
 * there is nothing to apply. Uses drizzle-orm's postgres-js migrator against the
 * same `drizzle/` folder + `drizzle.__drizzle_migrations` bookkeeping table.
 *
 * Env loading mirrors drizzle.config.ts: on the host, rewrite the Docker hostname
 * (@db:) to the exposed localhost port. Inside a container the compose-injected
 * hostname is already correct per stack (dev: db, prod: srams_db), so leave it as-is.
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
  // Prefer .env.local for local development, fall back to .env.production
  const envFile = existsSync(".env.local") ? ".env.local" : ".env.production";
  expand(config({ path: envFile, override: true }));
}

const raw = process.env.DATABASE_URL;
if (!raw) {
  console.error("[migrate] DATABASE_URL is not set. Check your .env.production file.");
  process.exit(1);
}
// Rewrite Docker hostnames to localhost when running on host
const databaseUrl = isInsideDocker
  ? raw
  : raw.replace(/@(db|srams_db):/, "@localhost:");

async function main() {
  // Migrations require a single sequential connection.
  const client = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  const db = drizzle(client);

  logDbTarget("migrate", databaseUrl);
  console.log("[migrate] applying pending migrations…");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("[migrate] done — schema is up to date.");

  await client.end();
  // Explicit exit to prevent dangling handles from causing non-zero exit
  process.exit(0);
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
