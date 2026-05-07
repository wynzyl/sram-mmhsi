import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { loadEnvConfig } from "@next/env";
import { users } from "../lib/db/schema";
import { e2eStaffAdmin } from "./credentials";

loadEnvConfig(process.cwd());

/**
 * Ensures the synthetic `admin`-role account used by Playwright exists.
 * Super admin is expected to come from `npm run db:seed`.
 */
export async function ensureE2eTestUsers(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn(
      "[e2e] DATABASE_URL is not set; skipping E2E staff admin provisioning (login tests may fail)."
    );
    return;
  }

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  const passwordHash = await hash(e2eStaffAdmin.password, 12);
  const email = `${e2eStaffAdmin.username}@srams-e2e.invalid`;

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, e2eStaffAdmin.username))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(users)
      .set({
        email,
        passwordHash,
        role: "admin",
        isActive: true,
        forcePasswordChange: false,
        updatedAt: new Date(),
      })
      .where(eq(users.username, e2eStaffAdmin.username));
  } else {
    await db.insert(users).values({
      email,
      username: e2eStaffAdmin.username,
      passwordHash,
      role: "admin",
      isActive: true,
      forcePasswordChange: false,
    });
  }

  await client.end();
}
