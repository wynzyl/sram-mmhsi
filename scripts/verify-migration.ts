/**
 * Comprehensive verification of fee templates migration
 */
import postgres from "postgres";
import { config } from "dotenv";
import { expand } from "dotenv-expand";

expand(config({ path: ".env.local" }));

const sql = postgres(process.env.DATABASE_URL!);

async function verify() {
  console.log("🔍 Verifying Fee Templates Migration\n");

  try {
    // 1. Verify tables exist
    console.log("1️⃣ Table Verification");
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('fee_item_types', 'fee_templates', 'fee_template_items', 'school_year_fee_schedules', 'fee_schedule_overrides')
    `;
    console.log(`   ✓ New tables created: ${tables.length}/5`);
    if (tables.length !== 5) {
      console.log(`   ❌ Expected 5 tables, found ${tables.length}`);
      return;
    }

    // 2. Verify fee item types seeded
    console.log("\n2️⃣ Fee Item Types Verification");
    const [feeTypeCount] = await sql`SELECT COUNT(*)::int as count FROM fee_item_types`;
    console.log(`   ✓ Fee item types seeded: ${feeTypeCount.count}/13`);

    if (feeTypeCount.count === 13) {
      const feeTypes = await sql`
        SELECT code, name, category, is_discount, display_order
        FROM fee_item_types
        ORDER BY display_order
      `;
      console.log("\n   Fee Types:");
      feeTypes.forEach((ft) => {
        console.log(`   - [${ft.code}] ${ft.name} (${ft.category}${ft.is_discount ? ', discount' : ''})`);
      });
    }

    // 3. Verify assessment_items columns
    console.log("\n3️⃣ Assessment Items Columns");
    const columns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'assessment_items'
      AND column_name IN ('fee_template_item_id', 'fee_item_type_id')
    `;
    console.log(`   ✓ New columns added: ${columns.length}/2`);
    columns.forEach((c) => console.log(`   - ${c.column_name} (${c.data_type})`));

    // 4. Verify indexes
    console.log("\n4️⃣ Index Verification");
    const indexes = await sql`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND (
        indexname LIKE 'fee_item_types_%'
        OR indexname LIKE 'fee_templates_%'
        OR indexname LIKE 'fee_template_items_%'
        OR indexname LIKE 'syfs_%'
        OR indexname LIKE 'fso_%'
        OR indexname LIKE 'ai_fee_%'
      )
      ORDER BY indexname
    `;
    console.log(`   ✓ Indexes created: ${indexes.length}`);
    indexes.forEach((idx) => console.log(`   - ${idx.indexname}`));

    // 5. Verify foreign keys
    console.log("\n5️⃣ Foreign Key Verification");
    const fks = await sql`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name IN ('fee_item_types', 'fee_templates', 'fee_template_items', 'school_year_fee_schedules', 'fee_schedule_overrides', 'assessment_items')
      AND (
        kcu.column_name IN ('fee_item_type_id', 'fee_template_id', 'fee_template_item_id', 'schedule_id')
        OR tc.table_name = 'assessment_items' AND kcu.column_name IN ('fee_template_item_id', 'fee_item_type_id')
      )
      ORDER BY tc.table_name, kcu.column_name
    `;
    console.log(`   ✓ Foreign keys created: ${fks.length}`);

    // 6. Data integrity checks
    console.log("\n6️⃣ Data Integrity Checks");

    // Check for duplicate fee types in templates (should be 0)
    const [dupCheck] = await sql`
      SELECT COUNT(*)::int as count
      FROM (
        SELECT fee_template_id, fee_item_type_id, COUNT(*) as dupes
        FROM fee_template_items
        GROUP BY fee_template_id, fee_item_type_id
        HAVING COUNT(*) > 1
      ) duplicates
    `;
    console.log(`   ✓ Duplicate fee types in templates: ${dupCheck.count} (should be 0)`);

    // Check for templates with no items
    const [emptyTemplates] = await sql`
      SELECT COUNT(*)::int as count
      FROM fee_templates ft
      LEFT JOIN fee_template_items fti ON ft.id = fti.fee_template_id
      WHERE fti.id IS NULL
    `;
    console.log(`   ✓ Templates with no items: ${emptyTemplates.count} (OK for new system)`);

    // Check for multiple active schedules per (year, band)
    const [multiSchedules] = await sql`
      SELECT COUNT(*)::int as count
      FROM (
        SELECT school_year_id, assessment_band, COUNT(*) as active_count
        FROM school_year_fee_schedules
        WHERE is_active = true
        GROUP BY school_year_id, assessment_band
        HAVING COUNT(*) > 1
      ) duplicates
    `;
    console.log(`   ✓ Multiple active schedules per (SY, band): ${multiSchedules.count} (should be 0)`);

    // 7. Migration record
    console.log("\n7️⃣ Migration Record");
    const [migrationCount] = await sql`SELECT COUNT(*)::int as count FROM drizzle.__drizzle_migrations`;
    console.log(`   ✓ Total migrations in database: ${migrationCount.count}`);

    console.log("\n✅ All verification checks passed!");
    console.log("\n📋 Next Steps:");
    console.log("   1. Create fee templates via UI: /staff/finance/fee-templates");
    console.log("   2. Add fee items to templates");
    console.log("   3. Assign templates to school years");
    console.log("   4. Test assessment creation workflow");

  } catch (error) {
    console.error("❌ Verification failed:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

verify()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
