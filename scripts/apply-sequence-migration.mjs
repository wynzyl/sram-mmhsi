import postgres from 'postgres';
import { config } from 'dotenv';
import { expand } from 'dotenv-expand';
import { readFileSync } from 'fs';

// Load environment variables
expand(config({ path: '.env.local' }));
expand(config({ path: '.env' }));

const sql = postgres(process.env.DATABASE_URL);

try {
  console.log('Applying student reference sequence migration...');

  // Read and execute the migration SQL
  const migrationSQL = readFileSync('./drizzle/0008_add_student_reference_sequence.sql', 'utf8');
  await sql.unsafe(migrationSQL);

  console.log('✓ Migration applied successfully!');

  // Verify sequence exists
  const result = await sql`
    SELECT EXISTS (
      SELECT 1 FROM pg_class
      WHERE relkind = 'S' AND relname = 'student_ref_seq'
    ) as exists;
  `;

  console.log('✓ Sequence exists:', result[0].exists);

  if (result[0].exists) {
    const currentVal = await sql`SELECT last_value FROM student_ref_seq`;
    console.log('✓ Current sequence value:', currentVal[0].last_value);
  }

  // Record in migrations table
  await sql`
    INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
    VALUES ('manual_student_ref_seq_2026_05_09', ${Date.now()})
    ON CONFLICT DO NOTHING
  `;

  console.log('✓ Migration recorded in drizzle migrations table');

  await sql.end();
} catch (error) {
  console.error('✗ Error applying migration:', error);
  await sql.end();
  process.exit(1);
}
