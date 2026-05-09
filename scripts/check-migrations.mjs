import postgres from 'postgres';
import { config } from 'dotenv';
import { expand } from 'dotenv-expand';

// Load environment variables
expand(config({ path: '.env.local' }));
expand(config({ path: '.env' }));

const sql = postgres(process.env.DATABASE_URL);

try {
  // Check applied migrations
  const migrations = await sql`
    SELECT * FROM drizzle.__drizzle_migrations
    ORDER BY created_at DESC;
  `;

  console.log('Applied migrations:');
  migrations.forEach(m => {
    console.log(`- ${m.hash} (${m.created_at})`);
  });

  await sql.end();
} catch (error) {
  console.error('Error checking migrations:', error);
  await sql.end();
  process.exit(1);
}
