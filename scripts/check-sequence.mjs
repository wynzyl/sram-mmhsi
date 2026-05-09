import postgres from 'postgres';
import { config } from 'dotenv';
import { expand } from 'dotenv-expand';

// Load environment variables
expand(config({ path: '.env.local' }));
expand(config({ path: '.env' }));

const sql = postgres(process.env.DATABASE_URL);

try {
  // Check if sequence exists
  const result = await sql`
    SELECT EXISTS (
      SELECT 1 FROM pg_class
      WHERE relkind = 'S' AND relname = 'student_ref_seq'
    ) as exists;
  `;

  console.log('Sequence exists:', result[0].exists);

  if (result[0].exists) {
    // Get current value
    const currentVal = await sql`SELECT last_value FROM student_ref_seq`;
    console.log('Current sequence value:', currentVal[0].last_value);
  }

  await sql.end();
} catch (error) {
  console.error('Error checking sequence:', error);
  await sql.end();
  process.exit(1);
}
