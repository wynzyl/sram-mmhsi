/**
 * Database Health Check Script
 *
 * Run with: npx tsx scripts/check-db.ts
 *
 * Verifies:
 * 1. DATABASE_URL is set
 * 2. Database connection works
 * 3. Required tables exist
 * 4. Schema matches migrations
 */

import { config } from "dotenv";
import { expand } from "dotenv-expand";
import postgres from "postgres";

// Load environment variables
expand(config({ path: ".env.local" }));
expand(config({ path: ".env" }));

const DATABASE_URL = process.env.DATABASE_URL;

async function checkDatabase() {
  console.log("🔍 SRAMS Database Health Check\n");

  // Step 1: Check DATABASE_URL
  console.log("1️⃣ Checking DATABASE_URL...");
  if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL is not set in .env.local");
    console.log("\n💡 Create .env.local with:");
    console.log('DATABASE_URL="postgresql://user:password@localhost:5432/srams_db"');
    process.exit(1);
  }
  console.log("✅ DATABASE_URL is set");

  // Step 2: Test connection
  console.log("\n2️⃣ Testing database connection...");
  let sql;
  try {
    sql = postgres(DATABASE_URL, { max: 1 });
    await sql`SELECT 1 as test`;
    console.log("✅ Database connection successful");
  } catch (error) {
    console.error("❌ Cannot connect to database");
    console.error("Error:", error instanceof Error ? error.message : String(error));
    console.log("\n💡 Possible fixes:");
    console.log("- Ensure PostgreSQL is running");
    console.log("- Check DATABASE_URL credentials");
    console.log("- Verify database exists (create with: createdb srams_db)");
    process.exit(1);
  }

  // Step 3: Check required tables
  console.log("\n3️⃣ Checking required tables...");
  try {
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    const requiredTables = [
      "users",
      "students",
      "enrollments",
      "assessments",
      "payments",
      "audit_logs",
    ];

    const existingTableNames = tables.map((t: any) => t.table_name);
    const missingTables = requiredTables.filter(
      (t) => !existingTableNames.includes(t)
    );

    if (missingTables.length > 0) {
      console.error("❌ Missing tables:", missingTables.join(", "));
      console.log("\n💡 Run migrations:");
      console.log("npm run db:migrate");
      await sql.end();
      process.exit(1);
    }

    console.log("✅ All required tables exist");
    console.log(`   Found ${tables.length} tables:`, existingTableNames.join(", "));
  } catch (error) {
    console.error("❌ Error checking tables");
    console.error("Error:", error instanceof Error ? error.message : String(error));
    await sql.end();
    process.exit(1);
  }

  // Step 4: Check users table structure
  console.log("\n4️⃣ Checking users table structure...");
  try {
    const columns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
      ORDER BY ordinal_position
    `;

    const requiredColumns = [
      "id",
      "email",
      "username",
      "password_hash",
      "role",
      "is_active",
      "force_password_change",
    ];

    const existingColumnNames = columns.map((c: any) => c.column_name);
    const missingColumns = requiredColumns.filter(
      (c) => !existingColumnNames.includes(c)
    );

    if (missingColumns.length > 0) {
      console.error("❌ Missing columns in users table:", missingColumns.join(", "));
      console.log("\n💡 Schema mismatch detected. Run:");
      console.log("npm run db:migrate");
      await sql.end();
      process.exit(1);
    }

    console.log("✅ Users table structure is correct");
  } catch (error) {
    console.error("❌ Error checking users table structure");
    console.error("Error:", error instanceof Error ? error.message : String(error));
    await sql.end();
    process.exit(1);
  }

  // Step 5: Check for existing users
  console.log("\n5️⃣ Checking for existing users...");
  try {
    const userCount = await sql`SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL`;
    const count = parseInt(userCount[0].count, 10);

    if (count === 0) {
      console.log("⚠️  No users found in database");
      console.log("\n💡 Seed the database:");
      console.log("npm run db:seed-config  # Creates default admin user");
    } else {
      console.log(`✅ Found ${count} active user(s)`);
    }
  } catch (error) {
    console.error("❌ Error checking users");
    console.error("Error:", error instanceof Error ? error.message : String(error));
  }

  await sql.end();

  console.log("\n✅ Database health check complete!");
  console.log("\n🚀 You can now run: npm run dev");
}

checkDatabase().catch((error) => {
  console.error("\n💥 Unexpected error:");
  console.error(error);
  process.exit(1);
});
