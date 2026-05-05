import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { loadEnvConfig } from "@next/env";
import { sql } from "drizzle-orm";

loadEnvConfig(process.cwd());
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL not set");

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

async function clear() {
  console.log("Clearing tables for migration...");
  try {
    await db.execute(sql`DELETE FROM grade_records;`);
    await db.execute(sql`DELETE FROM teacher_assignments;`);
    await db.execute(sql`DELETE FROM subjects;`);
    console.log("Tables cleared.");
  } finally {
    await client.end();
  }
}

clear().catch((err) => {
  console.error("❌ Clear-for-migration failed:", err);
  process.exit(1);
});
