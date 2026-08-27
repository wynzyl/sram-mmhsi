/**
 * SRAMS Duplicate Grade Levels Cleanup Script
 *
 * Removes duplicate grade level records caused by running seed script twice.
 *
 * Problem: Every grade level was seeded twice:
 * - First set (2026-06-10 02:24:56): Has sections and enrollments attached (KEEP)
 * - Second set (2026-06-10 06:10:21): Empty duplicates (DELETE)
 *
 * Exception: Grade 7's duplicate has 1 enrollment that needs reassignment first.
 *
 * Run: npx tsx scripts/cleanup-duplicate-grade-levels.ts
 * Docker: docker compose -f docker-compose.prod.yml run --rm migrate npx tsx scripts/cleanup-duplicate-grade-levels.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { gradeLevels, sections, enrollments, subjects, curriculumAdoptions, registrations } from "../src/lib/db/schema";
import { eq, sql, and, inArray } from "drizzle-orm";
import { config } from "dotenv";
import { expand } from "dotenv-expand";

expand(config({ path: ".env.local" }));
expand(config());

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL not set");

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

interface GradeLevelRecord {
  id: string;
  name: string;
  order: number;
  createdAt: Date;
}

interface DependencyCount {
  sections: number;
  enrollments: number;
  registrations: number;
  subjects: number;
  adoptions: number;
}

async function getDependencyCounts(gradeLevelId: string): Promise<DependencyCount> {
  const [sectionCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sections)
    .where(eq(sections.gradeLevelId, gradeLevelId));

  const [enrollmentCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(enrollments)
    .where(eq(enrollments.gradeLevelId, gradeLevelId));

  const [registrationCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(registrations)
    .where(eq(registrations.gradeLevelId, gradeLevelId));

  const [subjectCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(subjects)
    .where(eq(subjects.gradeLevelId, gradeLevelId));

  const [adoptionCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(curriculumAdoptions)
    .where(eq(curriculumAdoptions.gradeLevelId, gradeLevelId));

  return {
    sections: sectionCount?.count ?? 0,
    enrollments: enrollmentCount?.count ?? 0,
    registrations: registrationCount?.count ?? 0,
    subjects: subjectCount?.count ?? 0,
    adoptions: adoptionCount?.count ?? 0,
  };
}

function totalDependencies(deps: DependencyCount): number {
  return deps.sections + deps.enrollments + deps.registrations + deps.subjects + deps.adoptions;
}

async function cleanupDuplicateGradeLevels() {
  console.log("🧹 Starting duplicate grade level cleanup...\n");

  // Step 1: Find all grade level names with duplicates
  const duplicateNames = await db
    .select({
      name: gradeLevels.name,
      count: sql<number>`count(*)::int`,
    })
    .from(gradeLevels)
    .groupBy(gradeLevels.name)
    .having(sql`count(*) > 1`);

  if (duplicateNames.length === 0) {
    console.log("✅ No duplicate grade levels found. Database is clean.");
    await client.end();
    process.exit(0);
  }

  console.log(`Found ${duplicateNames.length} grade level names with duplicates:\n`);
  duplicateNames.forEach((d) => console.log(`  - ${d.name} (${d.count} copies)`));
  console.log("");

  // Step 2: For each duplicate name, identify keeper and duplicate
  const toDelete: string[] = [];
  const reassignments: { from: string; to: string; name: string; enrollments: number; registrations: number }[] = [];

  for (const { name } of duplicateNames) {
    // Get all records for this name
    const records = await db
      .select({
        id: gradeLevels.id,
        name: gradeLevels.name,
        order: gradeLevels.order,
        createdAt: gradeLevels.createdAt,
      })
      .from(gradeLevels)
      .where(eq(gradeLevels.name, name))
      .orderBy(gradeLevels.createdAt);

    if (records.length !== 2) {
      console.log(`⚠️  Unexpected: ${name} has ${records.length} records, skipping...`);
      continue;
    }

    const [older, newer] = records;

    // Get dependency counts for both
    const olderDeps = await getDependencyCounts(older.id);
    const newerDeps = await getDependencyCounts(newer.id);

    console.log(`📋 ${name}:`);
    console.log(`   Older (${older.createdAt.toISOString()}): ${totalDependencies(olderDeps)} dependencies`);
    console.log(`     - sections: ${olderDeps.sections}, enrollments: ${olderDeps.enrollments}, registrations: ${olderDeps.registrations}, subjects: ${olderDeps.subjects}, adoptions: ${olderDeps.adoptions}`);
    console.log(`   Newer (${newer.createdAt.toISOString()}): ${totalDependencies(newerDeps)} dependencies`);
    console.log(`     - sections: ${newerDeps.sections}, enrollments: ${newerDeps.enrollments}, registrations: ${newerDeps.registrations}, subjects: ${newerDeps.subjects}, adoptions: ${newerDeps.adoptions}`);

    // Determine keeper: prefer the one with more dependencies, or older if tied
    let keeper: GradeLevelRecord;
    let duplicate: GradeLevelRecord;
    let keeperDeps: DependencyCount;
    let duplicateDeps: DependencyCount;

    if (totalDependencies(olderDeps) >= totalDependencies(newerDeps)) {
      keeper = older;
      duplicate = newer;
      keeperDeps = olderDeps;
      duplicateDeps = newerDeps;
    } else {
      keeper = newer;
      duplicate = older;
      keeperDeps = newerDeps;
      duplicateDeps = olderDeps;
    }

    console.log(`   → Keeping: ${keeper.id} (${keeper.createdAt.toISOString()})`);
    console.log(`   → Deleting: ${duplicate.id} (${duplicate.createdAt.toISOString()})`);

    // Check if duplicate has any dependencies that need reassignment
    if (duplicateDeps.enrollments > 0 || duplicateDeps.registrations > 0) {
      reassignments.push({
        from: duplicate.id,
        to: keeper.id,
        name,
        enrollments: duplicateDeps.enrollments,
        registrations: duplicateDeps.registrations,
      });
    }

    if (duplicateDeps.sections > 0 || duplicateDeps.subjects > 0 || duplicateDeps.adoptions > 0) {
      console.log(`   ⚠️  Warning: Duplicate has other dependencies that need manual review`);
    }

    toDelete.push(duplicate.id);
    console.log("");
  }

  // Step 3: Perform reassignments
  if (reassignments.length > 0) {
    console.log("🔄 Reassigning enrollments and registrations from duplicates to keepers...\n");

    for (const { from, to, name, enrollments: enrollmentCount, registrations: registrationCount } of reassignments) {
      if (enrollmentCount > 0) {
        console.log(`   ${name}: Moving ${enrollmentCount} enrollment(s) from ${from} to ${to}`);
        await db
          .update(enrollments)
          .set({ gradeLevelId: to })
          .where(eq(enrollments.gradeLevelId, from));
      }

      if (registrationCount > 0) {
        console.log(`   ${name}: Moving ${registrationCount} registration(s) from ${from} to ${to}`);
        await db
          .update(registrations)
          .set({ gradeLevelId: to })
          .where(eq(registrations.gradeLevelId, from));
      }
    }

    console.log("\n✅ Reassignments complete.\n");
  }

  // Step 4: Delete empty duplicates
  if (toDelete.length > 0) {
    console.log(`🗑️  Deleting ${toDelete.length} duplicate grade level records...\n`);

    // Verify no remaining dependencies before deletion
    const cannotDelete: string[] = [];
    for (const id of toDelete) {
      const deps = await getDependencyCounts(id);
      if (totalDependencies(deps) > 0) {
        console.log(`   ❌ Cannot delete ${id}: still has ${totalDependencies(deps)} dependencies`);
        console.log(`      sections: ${deps.sections}, enrollments: ${deps.enrollments}, registrations: ${deps.registrations}, subjects: ${deps.subjects}, adoptions: ${deps.adoptions}`);
        cannotDelete.push(id);
      }
    }

    // Filter out records that still have dependencies
    const safeToDelete = toDelete.filter((id) => !cannotDelete.includes(id));
    if (safeToDelete.length === 0) {
      console.log("\n⚠️  No records can be safely deleted. Manual cleanup required.");
      await client.end();
      process.exit(1);
    }

    const deleted = await db
      .delete(gradeLevels)
      .where(inArray(gradeLevels.id, safeToDelete))
      .returning({ id: gradeLevels.id, name: gradeLevels.name });

    console.log(`✅ Deleted ${deleted.length} duplicate grade level records:`);
    deleted.forEach((d) => console.log(`   - ${d.name} (${d.id})`));
  }

  // Step 5: Final verification
  console.log("\n📊 Final verification...\n");

  const remainingDuplicates = await db
    .select({
      name: gradeLevels.name,
      count: sql<number>`count(*)::int`,
    })
    .from(gradeLevels)
    .groupBy(gradeLevels.name)
    .having(sql`count(*) > 1`);

  if (remainingDuplicates.length === 0) {
    console.log("✅ Success! No duplicate grade levels remain.");
  } else {
    console.log(`⚠️  Warning: ${remainingDuplicates.length} grade levels still have duplicates:`);
    remainingDuplicates.forEach((d) => console.log(`   - ${d.name} (${d.count} copies)`));
  }

  const totalGradeLevels = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(gradeLevels);

  console.log(`\n📈 Total grade levels in database: ${totalGradeLevels[0]?.count ?? 0}`);

  await client.end();
  process.exit(0);
}

cleanupDuplicateGradeLevels().catch((err) => {
  console.error("❌ Cleanup failed:", err);
  client.end();
  process.exit(1);
});
