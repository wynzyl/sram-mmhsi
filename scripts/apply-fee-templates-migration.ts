/**
 * Manually apply fee templates migration and register it in drizzle migrations
 * This is needed because the drizzle meta state is out of sync with the database
 */
import { readFileSync } from "fs";
import { join } from "path";
import postgres from "postgres";
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import crypto from "crypto";

expand(config({ path: ".env.local" }));

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

async function applyMigration() {
  console.log("🚀 Applying fee templates migration manually...\n");

  try {
    // Read the migration SQL file
    const migrationPath = join(process.cwd(), "drizzle", "0010_add_fee_templates.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    // Calculate hash for the migration (same method drizzle uses)
    const hash = crypto.createHash("sha256").update(migrationSQL).digest("hex");

    // Check if already applied
    const existing = await sql`
      SELECT * FROM drizzle.__drizzle_migrations
      WHERE hash = ${hash}
    `;

    if (existing.length > 0) {
      console.log("✓ Migration already applied (found matching hash)");
      await sql.end();
      return;
    }

    console.log("1️⃣ Applying migration SQL...");

    // Execute the migration in a transaction
    await sql.begin(async (tx) => {
      // Execute the migration SQL
      await tx.unsafe(migrationSQL);

      // Register the migration
      await tx`
        INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
        VALUES (${hash}, ${Date.now()})
      `;
    });

    console.log("✅ Migration applied successfully!\n");

    // Verify tables were created
    console.log("2️⃣ Verifying new tables...");
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('fee_item_types', 'fee_templates', 'fee_template_items', 'school_year_fee_schedules', 'fee_schedule_overrides')
      ORDER BY table_name
    `;

    console.log("✓ Created tables:");
    tables.forEach((t) => console.log(`  - ${t.table_name}`));

    // Check new columns
    const columns = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'assessment_items'
      AND column_name IN ('fee_template_item_id', 'fee_item_type_id')
      ORDER BY column_name
    `;

    console.log("\n✓ Added columns to assessment_items:");
    columns.forEach((c) => console.log(`  - ${c.column_name}`));

    console.log("\n🎉 Migration complete!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

applyMigration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
