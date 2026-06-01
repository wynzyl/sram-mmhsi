/**
 * Data Migration: Update Advance Casa Assessment Band
 *
 * Updates the existing "Advance Casa" grade level row to use the new
 * 'advance_casa' assessment band instead of the shared 'casa' band.
 *
 * Run: npx tsx scripts/migrate-advance-casa-band.ts
 *
 * This is a one-time migration script. Safe to run multiple times
 * (idempotent - only updates if current band is 'casa').
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { gradeLevels } from "../src/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { config } from "dotenv";
import { expand } from "dotenv-expand";

expand(config({ path: ".env.local" }));
expand(config());

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL not set");

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

async function migrateAdvanceCasaBand() {
  console.log("🔄 Migrating Advance Casa assessment band...\n");

  // Check current state
  const advanceCasa = await db
    .select({
      id: gradeLevels.id,
      name: gradeLevels.name,
      assessmentBand: gradeLevels.assessmentBand,
    })
    .from(gradeLevels)
    .where(eq(gradeLevels.name, "Advance Casa"))
    .limit(1);

  if (advanceCasa.length === 0) {
    console.log("⚠️  No 'Advance Casa' grade level found in database.");
    console.log("   Run 'npm run db:seed-config' to create grade levels first.");
    await client.end();
    return;
  }

  const current = advanceCasa[0];
  console.log(`Found: ${current.name} (id: ${current.id})`);
  console.log(`Current band: ${current.assessmentBand}`);

  if (current.assessmentBand === "advance_casa") {
    console.log("\n✅ Already using 'advance_casa' band. No changes needed.");
    await client.end();
    return;
  }

  // Update to new band
  const [updated] = await db
    .update(gradeLevels)
    .set({ assessmentBand: "advance_casa" })
    .where(
      and(
        eq(gradeLevels.name, "Advance Casa"),
        eq(gradeLevels.assessmentBand, "casa")
      )
    )
    .returning({
      id: gradeLevels.id,
      name: gradeLevels.name,
      assessmentBand: gradeLevels.assessmentBand,
    });

  if (updated) {
    console.log(`\n✅ Updated: ${updated.name} → ${updated.assessmentBand}`);
  } else {
    console.log("\n⚠️  No rows updated (unexpected state).");
  }

  console.log("\n📋 Post-migration steps for Finance:");
  console.log("   1. Create a new fee template for 'Advance Casa' band");
  console.log("   2. Assign the template to the active school year");
  console.log("   Until done, new Advance Casa assessments will have no fee schedule.\n");

  await client.end();
}

migrateAdvanceCasaBand().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
