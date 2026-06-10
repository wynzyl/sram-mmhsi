/**
 * Apply Pending Migrations (0011 and 0012)
 *
 * This script manually applies migrations that exist but weren't applied yet.
 * Run: npx tsx scripts/apply-pending-migrations.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import fs from "fs";
import path from "path";

expand(config({ path: ".env.local" }));
expand(config());

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL not set");

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

const migrations = [
  {
    idx: 11,
    tag: "0011_add_soft_delete_to_student_guardian_links",
    file: "drizzle/0011_add_soft_delete_to_student_guardian_links.sql",
  },
  {
    idx: 12,
    tag: "0012_add_soft_delete_to_fee_templates",
    file: "drizzle/0012_add_soft_delete_to_fee_templates.sql",
  },
];

async function checkColumnExists(table: string, column: string): Promise<boolean> {
  const [result] = await db.execute(sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = ${table}
      AND column_name = ${column}
    ) as exists;
  `);
  return (result as { exists: boolean }).exists;
}

async function applyMigrations() {
  console.log("🔍 Checking pending migrations...\n");

  for (const migration of migrations) {
    console.log(`📄 Processing: ${migration.tag}`);

    try {
      // Check if migration already applied (check for deleted_at column)
      const tableName =
        migration.idx === 11 ? "student_guardian_links" : "fee_templates";
      const exists = await checkColumnExists(tableName, "deleted_at");

      if (exists) {
        console.log(`   ⏭️  Already applied, skipping\n`);
        continue;
      }

      // Read migration SQL file
      const filePath = path.join(process.cwd(), migration.file);
      const sqlContent = fs.readFileSync(filePath, "utf-8");

      // Apply migration
      await db.execute(sql.raw(sqlContent));
      console.log(`   ✅ Applied successfully\n`);

      // Record in drizzle migrations table
      await db.execute(sql`
        INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
        VALUES (${migration.tag}, CURRENT_TIMESTAMP);
      `);
      console.log(`   📝 Recorded in migrations table\n`);
    } catch (error) {
      console.error(`   ❌ Error applying migration: ${error}\n`);
      throw error;
    }
  }

  console.log("✨ All pending migrations applied!");
}

applyMigrations()
  .then(() => {
    console.log("✅ Done!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Failed:", err);
    process.exit(1);
  })
  .finally(() => {
    client.end();
  });
