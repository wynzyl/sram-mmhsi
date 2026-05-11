import postgres from "postgres";
import { config } from "dotenv";
import { expand } from "dotenv-expand";

expand(config({ path: ".env.local" }));

const sql = postgres(process.env.DATABASE_URL!);

async function checkMigrations() {
  try {
    const migrations = await sql`
      SELECT * FROM drizzle.__drizzle_migrations
      ORDER BY created_at
    `;

    console.log(`Applied migrations: ${migrations.length}`);
    migrations.forEach((m, i) => {
      console.log(`${i + 1}. ${m.hash}`);
    });

    // Check if fee_item_types table exists
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE 'fee%'
      ORDER BY table_name
    `;

    console.log('\nFee-related tables:');
    tables.forEach(t => console.log(`- ${t.table_name}`));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

checkMigrations();
