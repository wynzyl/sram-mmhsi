/**
 * One-time data fix: Set cancelledAt for assessments that have
 * billingStatus = 'cancelled' but cancelledAt = NULL
 *
 * This fixes data inconsistency that blocks re-assessment creation
 * due to the partial unique index: assessments_enrollment_id_uidx
 *
 * Run with: npx tsx scripts/fix-cancelled-assessments.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { assessments } from "../src/lib/db/schema";
import * as schema from "../src/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { config } from "dotenv";
import { expand } from "dotenv-expand";

expand(config({ path: ".env.local" }));
expand(config());

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL not set");

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client, { schema });

async function fixCancelledAssessments() {
  console.log("🔍 Finding assessments with inconsistent cancelled state...");

  // Find all assessments where billingStatus = 'cancelled' but cancelledAt = NULL
  const inconsistentAssessments = await db.query.assessments.findMany({
    where: and(
      eq(assessments.billingStatus, "cancelled"),
      isNull(assessments.cancelledAt)
    ),
    columns: {
      id: true,
      enrollmentId: true,
      billingStatus: true,
      updatedAt: true,
    },
  });

  if (inconsistentAssessments.length === 0) {
    console.log("✅ No inconsistent assessments found. Database is clean.");
    return;
  }

  console.log(
    `⚠️  Found ${inconsistentAssessments.length} assessment(s) with inconsistent state:`
  );
  for (const assessment of inconsistentAssessments) {
    console.log(
      `   - Assessment ${assessment.id} (enrollment: ${assessment.enrollmentId})`
    );
  }

  console.log("\n🔧 Fixing inconsistent records...");

  // Update each assessment, setting cancelledAt to updatedAt
  let fixedCount = 0;
  for (const assessment of inconsistentAssessments) {
    await db
      .update(assessments)
      .set({
        cancelledAt: assessment.updatedAt ?? new Date(),
      })
      .where(eq(assessments.id, assessment.id));

    fixedCount++;
    console.log(`   ✓ Fixed assessment ${assessment.id}`);
  }

  console.log(`\n✅ Fixed ${fixedCount} assessment(s).`);
  console.log(
    "   The partial unique index (assessments_enrollment_id_uidx) will now exclude cancelled assessments."
  );
  console.log("   Re-assessment should now work for affected enrollments.");
}

fixCancelledAssessments()
  .then(async () => {
    console.log("\n🎉 Script completed successfully.");
    await client.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("\n❌ Error:", err);
    await client.end();
    process.exit(1);
  });
