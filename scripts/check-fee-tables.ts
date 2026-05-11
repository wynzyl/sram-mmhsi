import postgres from "postgres";
import { config } from "dotenv";
import { expand } from "dotenv-expand";

expand(config({ path: ".env.local" }));

const sql = postgres(process.env.DATABASE_URL!);

async function checkFeeTables() {
  try {
    const newTables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('fee_item_types', 'fee_templates', 'fee_template_items', 'school_year_fee_schedules', 'fee_schedule_overrides')
      ORDER BY table_name
    `;

    console.log('\n✓ New fee template tables:');
    if (newTables.length === 0) {
      console.log('  ❌ No new tables found!');
    } else {
      newTables.forEach(t => console.log(`  ✓ ${t.table_name}`));
    }

    // Check assessment_items columns
    const columns = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'assessment_items'
      AND column_name IN ('fee_template_item_id', 'fee_item_type_id')
      ORDER BY column_name
    `;

    console.log('\n✓ Assessment items new columns:');
    if (columns.length === 0) {
      console.log('  ❌ No new columns found!');
    } else {
      columns.forEach(c => console.log(`  ✓ ${c.column_name}`));
    }

    // Check migration hash
    const lastMigration = await sql`
      SELECT hash, created_at
      FROM drizzle.__drizzle_migrations
      ORDER BY created_at DESC
      LIMIT 1
    `;

    console.log('\n✓ Last applied migration:');
    console.log(`  Hash: ${lastMigration[0].hash.substring(0, 16)}...`);
    console.log(`  Date: ${lastMigration[0].created_at}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

checkFeeTables();
