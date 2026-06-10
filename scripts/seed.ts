/**
 * SRAMS Unified Database Seed Script
 * Seeds all initial data: system configuration, super admin user, fee types, and discount types.
 * Run: npx tsx scripts/seed.ts
 *
 * Per Engineering spec §9 — session + user model.
 * Per Engineering spec §8.5 — passwords hashed with bcrypt.
 */

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hash } from "bcryptjs";
import { users } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import { loadEnvConfig } from "@next/env";
import { existsSync } from "fs";

import { seedConfig } from "./seed-config";
import { seedFeeItemTypes } from "./seed-fee-item-types";
import { seedDiscountTypes } from "./seed-discount-types";

import { logDbTarget } from "./lib/db-target";

// Only load env files when running on host (not inside Docker)
const isInsideDocker = !existsSync(".env.production");
if (!isInsideDocker) {
  loadEnvConfig(process.cwd());
}

const raw = process.env.DATABASE_URL;
if (!raw) throw new Error("DATABASE_URL not set");

// Resolve hostname: Docker uses service name, host uses localhost
const connectionString = isInsideDocker
  ? raw.replace("@db:", "@srams_db:")
  : raw.replace("@db:", "@localhost:");

logDbTarget("seed", connectionString);
const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

// ─── Super Admin Seed ─────────────────────────────────────────────────────────
async function seedAdminUser(db: PostgresJsDatabase): Promise<void> {
  console.log("🌱 Seeding super admin user...");

  const SUPER_ADMIN_USERNAME = "admin";
  const SUPER_ADMIN_EMAIL = "admin@srams.local";
  const SUPER_ADMIN_PASSWORD = "Admin@2026!"; // Change immediately after first login

  // Check if bootstrap super admin already exists
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, SUPER_ADMIN_USERNAME))
    .limit(1);

  if (existing.length > 0) {
    console.log("✅ Super admin user already exists. Skipping.");
    return;
  }

  const passwordHash = await hash(SUPER_ADMIN_PASSWORD, 12);

  await db.insert(users).values({
    email: SUPER_ADMIN_EMAIL,
    username: SUPER_ADMIN_USERNAME,
    passwordHash,
    role: "super_admin",
    isActive: true,
    forcePasswordChange: true, // Force password change on first login
  });

  console.log("✅ Super admin user created:");
  console.log(`   Username : ${SUPER_ADMIN_USERNAME}`);
  console.log(`   Email    : ${SUPER_ADMIN_EMAIL}`);
  console.log(`   Password : ${SUPER_ADMIN_PASSWORD}`);
  console.log("\n⚠️  IMPORTANT: Change the super admin password immediately after first login!");
}

// ─── Main Seed Orchestrator ───────────────────────────────────────────────────
async function seed() {
  console.log("🚀 Starting unified database seed...\n");

  // Step 1: System configuration (school years, grade levels)
  console.log("━".repeat(50));
  console.log("📚 Step 1/4: System Configuration");
  console.log("━".repeat(50));
  await seedConfig(db);

  // Step 2: Super admin user
  console.log("\n" + "━".repeat(50));
  console.log("👤 Step 2/4: Super Admin User");
  console.log("━".repeat(50));
  await seedAdminUser(db);

  // Step 3: Fee item types
  console.log("\n" + "━".repeat(50));
  console.log("💰 Step 3/4: Fee Item Types");
  console.log("━".repeat(50));
  await seedFeeItemTypes(db);

  // Step 4: Discount types
  console.log("\n" + "━".repeat(50));
  console.log("🎫 Step 4/4: Discount Types");
  console.log("━".repeat(50));
  await seedDiscountTypes(db);

  console.log("\n" + "═".repeat(50));
  console.log("✅ SRAMS Database Setup Complete!");
  console.log("═".repeat(50));

  await client.end();
}

seed().catch(async (err) => {
  console.error("❌ Seed failed:", err);
  await client.end();
  process.exit(1);
});
