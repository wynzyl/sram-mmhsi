const postgres = require('postgres');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  const sql = postgres({
    host: 'localhost',
    port: 5432,
    database: 'SRAMS_DB',
    username: 'postgres',
    password: '722811',
  });

  try {
    console.log('✓ Connected to database');

    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'drizzle', '0011_assessment_transfer_soft_delete_tracking.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    // Split by statement breakpoint
    const statements = migrationSql
      .split('--> statement-breakpoint')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`\n✓ Found ${statements.length} SQL statements\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`[${i + 1}/${statements.length}] Executing: ${statement.substring(0, 60)}...`);

      try {
        await sql.unsafe(statement);
        console.log(`  ✓ Success`);
      } catch (error) {
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
          console.log(`  ⚠ Already applied (skipping)`);
        } else {
          throw error;
        }
      }
    }

    console.log('\n✓ Migration completed successfully!\n');

    // Verify columns were created
    const result = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'assessments'
        AND column_name IN ('transferred_at', 'transferred_by', 'transferred_to_assessment_id', 'transfer_remarks')
      ORDER BY column_name
    `;

    console.log('✓ Verification - New columns in assessments table:');
    result.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });

  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

applyMigration();
