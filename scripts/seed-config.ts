/**
 * SRAMS Configuration Seed Script
 * Seeds school years and grade levels needed for the student registration form.
 * Run: npx tsx scripts/seed-config.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { schoolYears, gradeLevels } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import { config } from "dotenv";
import { expand } from "dotenv-expand";

expand(config({ path: ".env.local" }));
expand(config());

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL not set");

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

async function seedConfig() {
  console.log("🌱 Seeding school configuration...");

  // ─── School Year ────────────────────────────────────────────────────────────
  const existingSY = await db
    .select({ id: schoolYears.id })
    .from(schoolYears)
    .where(eq(schoolYears.label, "2025-2026"))
    .limit(1);

  let schoolYearId: string;

  if (existingSY.length > 0) {
    schoolYearId = existingSY[0].id;
    console.log("✅ School year 2025-2026 already exists. Skipping.");
  } else {
    const [sy] = await db
      .insert(schoolYears)
      .values({
        label: "2025-2026",
        startDate: new Date("2025-06-01"),
        endDate: new Date("2026-03-31"),
        isActive: true,
      })
      .returning({ id: schoolYears.id });
    schoolYearId = sy.id;
    console.log("✅ School year 2025-2026 created:", schoolYearId);
  }

  // ─── Grade Levels ───────────────────────────────────────────────────────────
  /** Maps each grade to a fee assessment band. Junior/Senior Casa share 'casa' band; Advance Casa has its own 'advance_casa' band. */
  const gradeData = [
    { name: "Junior Casa", order: 1, assessmentBand: "casa" as const },
    { name: "Senior Casa", order: 2, assessmentBand: "casa" as const },
    { name: "Advance Casa", order: 3, assessmentBand: "advance_casa" as const },
    { name: "Grade 1", order: 4, assessmentBand: "lower_elementary" as const },
    { name: "Grade 2", order: 5, assessmentBand: "lower_elementary" as const },
    { name: "Grade 3", order: 6, assessmentBand: "lower_elementary" as const },
    { name: "Grade 4", order: 7, assessmentBand: "higher_elementary" as const },
    { name: "Grade 5", order: 8, assessmentBand: "higher_elementary" as const },
    { name: "Grade 6", order: 9, assessmentBand: "higher_elementary" as const },
    { name: "Grade 7", order: 10, assessmentBand: "junior_high" as const },
    { name: "Grade 8", order: 11, assessmentBand: "junior_high" as const },
    { name: "Grade 9", order: 12, assessmentBand: "junior_high" as const },
    { name: "Grade 10", order: 13, assessmentBand: "junior_high" as const },
    { name: "Grade 11", order: 14, assessmentBand: "senior_high" as const },
    { name: "Grade 12", order: 15, assessmentBand: "senior_high" as const },
  ];

  const existingGLs = await db
    .select({ name: gradeLevels.name })
    .from(gradeLevels);

  const existingNames = new Set(existingGLs.map((g) => g.name));
  const toInsert = gradeData.filter((g) => !existingNames.has(g.name));

  if (toInsert.length > 0) {
    await db.insert(gradeLevels).values(toInsert);
    console.log(`✅ Created ${toInsert.length} grade levels.`);
  } else {
    console.log("✅ All grade levels already exist. Skipping.");
  }

  console.log("\n✅ Configuration seeding complete!");
  await client.end();
}

seedConfig().catch((err) => {
  console.error("❌ Config seed failed:", err);
  process.exit(1);
});
