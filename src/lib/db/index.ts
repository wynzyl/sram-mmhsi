import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "[SRAMS] DATABASE_URL is not set. Check your .env.local file."
  );
}

// Prevent multiple connections in development (Next.js HMR)
const globalForDb = globalThis as unknown as {
  connection: ReturnType<typeof postgres> | undefined;
};

// Configure postgres connection with production-ready settings
const connection =
  globalForDb.connection ??
  postgres(connectionString, {
    max: 20, // Increased pool size for concurrent requests
    idle_timeout: 30, // Close idle connections after 30s
    connect_timeout: 10, // 10s connect timeout
    max_lifetime: 3600, // 1hr max connection age
    onnotice: () => {}, // Suppress notices
    debug: process.env.NODE_ENV === "development",
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.connection = connection;
}

export const db = drizzle(connection, { schema });
