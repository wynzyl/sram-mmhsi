/**
 * SRAMS Database Seed Script
 * Creates the initial super admin user.
 * Run: npx tsx scripts/seed.ts
 *
 * Per Engineering spec §9 — session + user model.
 * Per Engineering spec §8.5 — passwords hashed with bcrypt.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hash } from "bcryptjs";
import { users } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL not set");

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

async function seed() {
  console.log("🌱 Seeding SRAMS database...");

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
    console.log("✅ Super admin user already exists. Skipping seed.");
    await client.end();
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
  console.log("\n⚠️  IMPORTANT: Change the super admin password immediately after first login!\n");

  await client.end();
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
