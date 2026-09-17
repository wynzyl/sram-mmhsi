/**
 * Fix script: Map existing period names to matching grade level names
 *
 * Run with: npx tsx scripts/fix-period-grade-levels.ts
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { periods, gradeLevels } from "../src/lib/db/schema";
import { eq, isNull, and } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const client = postgres(DATABASE_URL);
const db = drizzle(client);

async function fixPeriodGradeLevels() {
  console.log("🔧 Fixing period grade levels...\n");

  // Get all grade levels
  const allGradeLevels = await db
    .select({ id: gradeLevels.id, name: gradeLevels.name })
    .from(gradeLevels);

  console.log(`Found ${allGradeLevels.length} grade levels:`);
  allGradeLevels.forEach((gl) => console.log(`  - ${gl.name}`));
  console.log("");

  // Get all periods without grade level
  const periodsWithoutGradeLevel = await db
    .select({
      id: periods.id,
      name: periods.name,
      periodNumber: periods.periodNumber,
    })
    .from(periods)
    .where(isNull(periods.gradeLevelId));

  console.log(`Found ${periodsWithoutGradeLevel.length} periods without grade level:`);
  periodsWithoutGradeLevel.forEach((p) =>
    console.log(`  - #${p.periodNumber}: ${p.name}`)
  );
  console.log("");

  // Build a lookup map (lowercase name -> grade level id)
  const gradeLevelMap = new Map<string, string>();
  for (const gl of allGradeLevels) {
    gradeLevelMap.set(gl.name.toLowerCase().trim(), gl.id);
  }

  // Update periods whose names match grade level names
  let updated = 0;
  for (const period of periodsWithoutGradeLevel) {
    const normalizedName = period.name.toLowerCase().trim();
    const matchingGradeLevelId = gradeLevelMap.get(normalizedName);

    if (matchingGradeLevelId) {
      await db
        .update(periods)
        .set({ gradeLevelId: matchingGradeLevelId })
        .where(eq(periods.id, period.id));

      const matchedGradeLevel = allGradeLevels.find(
        (gl) => gl.id === matchingGradeLevelId
      );
      console.log(
        `✅ Mapped period "${period.name}" → grade level "${matchedGradeLevel?.name}"`
      );
      updated++;
    }
  }

  console.log(`\n📊 Summary: Updated ${updated} periods out of ${periodsWithoutGradeLevel.length}`);

  // Show remaining unassigned periods
  const stillUnassigned = await db
    .select({
      id: periods.id,
      name: periods.name,
      periodNumber: periods.periodNumber,
    })
    .from(periods)
    .where(isNull(periods.gradeLevelId));

  if (stillUnassigned.length > 0) {
    console.log(`\n⚠️  ${stillUnassigned.length} periods still need manual grade level assignment:`);
    stillUnassigned.forEach((p) =>
      console.log(`  - #${p.periodNumber}: ${p.name}`)
    );
    console.log("\nUse the Period Management UI to assign grade levels to these periods.");
  } else {
    console.log("\n✅ All periods have been assigned grade levels!");
  }

  await client.end();
  process.exit(0);
}

fixPeriodGradeLevels().catch(async (error) => {
  console.error("Error fixing period grade levels:", error);
  await client.end();
  process.exit(1);
});
