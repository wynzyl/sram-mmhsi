/**
 * Run migration 0038_periods_grade_level_id directly
 * npx tsx scripts/run-migration-0038.ts
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { readFileSync } from "fs";
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in .env.local");
}

console.log("[migration] Connecting to database...");
const client = postgres(DATABASE_URL, { max: 1 });

async function run() {
  const sql = readFileSync("./drizzle/0038_periods_grade_level_id.sql", "utf-8");

  // Remove comment lines and split by statements
  const cleanedSql = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  const statements = cleanedSql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`[migration] Running ${statements.length} statements...`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.substring(0, 60).replace(/\n/g, " ");
    console.log(`[${i + 1}/${statements.length}] ${preview}...`);

    try {
      await client.unsafe(stmt);
      console.log(`    ✓ OK`);
    } catch (err: any) {
      // Ignore "already exists" errors for idempotency
      if (err.code === "42701" || err.code === "42P07" || err.code === "42710") {
        console.log(`    ⚠ Already exists, skipping`);
      } else {
        console.error(`    ✗ Error:`, err.message);
        throw err;
      }
    }
  }

  console.log("\n[migration] Migration 0038 completed successfully!");
  await client.end();
}

run().catch(async (err) => {
  console.error("[migration] Failed:", err);
  await client.end();
  process.exit(1);
});
