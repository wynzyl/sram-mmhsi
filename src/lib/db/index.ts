import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "[SRAMS] DATABASE_URL is not set. Check your .env.local file."
  );
}

// Share ONE pool process-wide via globalThis — in dev this guards against
// Next.js HMR re-evaluating the module, and in `next start` it guards against
// per-bundle module duplication: each route/action bundle has its own module
// registry, so without this every feature's first query created its OWN
// postgres() pool (fresh TCP connect → "first transaction of each kind is
// slow"). One shared pool also lets the instrumentation.ts warmup and the
// /api/readiness keepalive benefit every route.
const globalForDb = globalThis as unknown as {
  connection: ReturnType<typeof postgres> | undefined;
};

// Configure postgres connection with production-ready settings
const connection =
  globalForDb.connection ??
  postgres(connectionString, {
    max: 20, // Increased pool size for concurrent requests
    idle_timeout: 300, // Keep idle connections 5 min — office usage has frequent >30s gaps
    connect_timeout: 10, // 10s connect timeout
    max_lifetime: 3600, // 1hr max connection age
    onnotice: () => {}, // Suppress notices
    debug: process.env.NODE_ENV === "development",
  });

globalForDb.connection = connection;

export const db = drizzle(connection, { schema });
