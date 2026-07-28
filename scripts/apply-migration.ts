/**
 * Apply a single migration manually
 * Run: npx tsx scripts/apply-migration.ts
 */
import postgres from "postgres";

// Force localhost connection
const DATABASE_URL = "postgresql://postgres:722811@localhost:5432/SRAMS_DB";

console.log("Connecting to:", DATABASE_URL.replace(/:[^:@]+@/, ":****@"));

async function applyMigration() {
  const sql = postgres(DATABASE_URL!, { max: 1 });

  try {
    // First, list tables to verify connection
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    console.log("Found tables:", tables.map((t) => t.table_name).join(", "));

    console.log("\nApplying migration: add source_curriculum_id to subject_offerings...");

    // Check if column exists
    const [existing] = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'subject_offerings'
      AND column_name = 'source_curriculum_id'
    `;

    if (existing) {
      console.log("Column already exists, skipping.");
    } else {
      await sql`
        ALTER TABLE subject_offerings
        ADD COLUMN source_curriculum_id UUID REFERENCES curriculums(id)
      `;
      console.log("Column added successfully.");

      await sql`
        CREATE INDEX IF NOT EXISTS subject_offerings_source_curriculum_idx
        ON subject_offerings (source_curriculum_id)
      `;
      console.log("Index created successfully.");
    }

    console.log("Migration complete!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

applyMigration();
