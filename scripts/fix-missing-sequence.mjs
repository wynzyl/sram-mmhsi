import postgres from 'postgres';
import { config } from 'dotenv';
import { expand } from 'dotenv-expand';
import { readFileSync } from 'fs';

// Load environment variables
expand(config({ path: '.env.local' }));
expand(config({ path: '.env' }));

const sql = postgres(process.env.DATABASE_URL);

try {
  console.log('Checking if student_ref_seq exists...');

  const checkResult = await sql`
    SELECT EXISTS (
      SELECT 1 FROM pg_class
      WHERE relkind = 'S' AND relname = 'student_ref_seq'
    ) as exists;
  `;

  if (checkResult[0].exists) {
    console.log('✓ Sequence already exists');
    const currentVal = await sql`SELECT last_value FROM student_ref_seq`;
    console.log('  Current value:', currentVal[0].last_value);
  } else {
    console.log('✗ Sequence missing, creating it now...');

    // Read and execute the migration SQL
    const migrationSQL = readFileSync('./drizzle/0005_add_student_ref_sequence.sql', 'utf8');
    await sql.unsafe(migrationSQL);

    console.log('✓ Sequence created successfully!');

    // Verify
    const verifyResult = await sql`SELECT last_value FROM student_ref_seq`;
    console.log('  Current value:', verifyResult[0].last_value);
  }

  await sql.end();
  console.log('\n✓ Done! Student creation should now work.');
} catch (error) {
  console.error('✗ Error:', error.message);
  await sql.end();
  process.exit(1);
}
