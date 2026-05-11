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

const connection =
  globalForDb.connection ?? postgres(connectionString, { max: 10 });

if (process.env.NODE_ENV !== "production") {
  globalForDb.connection = connection;
}

export const db = drizzle(connection, { schema });
