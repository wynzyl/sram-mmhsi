/**
 * Applies drizzle/0014_fee_assessment_band.sql statements (idempotent).
 * Use when the app expects fee_schedules.assessment_band / grade_levels.assessment_band but
 * `npm run db:migrate` did not apply migration 0014 (or the DB was restored without it).
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import postgres from "postgres";

expand(config({ path: ".env.local" }));
expand(config({ path: ".env" }));

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");

  const filePath = resolve(process.cwd(), "drizzle/0014_fee_assessment_band.sql");
  const raw = readFileSync(filePath, "utf8");
  const statements = raw
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  const sql = postgres(url, { max: 1 });
  try {
    for (const st of statements) {
      await sql.unsafe(st);
    }
    console.log("Fee assessment band columns and indexes are in place (0014, idempotent).");
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
