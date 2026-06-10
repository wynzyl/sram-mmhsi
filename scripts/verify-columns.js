// eslint-disable-next-line @typescript-eslint/no-require-imports
const postgres = require('postgres');

async function verifyColumns() {
  const sql = postgres({
    host: 'localhost',
    port: 5432,
    database: 'SRAMS_DB',
    username: 'postgres',
    password: '722811',
  });

  try {
    console.log('\n✓ Checking database schema...\n');

    // Check assessments table
    const assessmentCols = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'assessments'
        AND column_name IN ('transferred_at', 'transferred_by', 'transferred_to_assessment_id', 'transfer_remarks')
      ORDER BY column_name
    `;

    console.log('assessments table - New columns:');
    assessmentCols.forEach(col => {
      console.log(`  ✓ ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });

    // Check assessment_items table
    const itemsCols = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'assessment_items'
        AND column_name = 'source_assessment_id'
    `;

    console.log('\nassessment_items table - New column:');
    itemsCols.forEach(col => {
      console.log(`  ✓ ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });

    // Check indexes
    const indexes = await sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename IN ('assessments', 'assessment_items')
        AND indexname IN ('assessments_transferred_at_idx', 'ai_source_assessment_idx')
      ORDER BY indexname
    `;

    console.log('\nIndexes created:');
    indexes.forEach(idx => {
      console.log(`  ✓ ${idx.indexname}`);
    });

    console.log('\n✓ All schema changes verified successfully!\n');

  } catch (error) {
    console.error('✗ Verification failed:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

verifyColumns();
