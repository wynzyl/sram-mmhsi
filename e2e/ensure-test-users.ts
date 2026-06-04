import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { loadEnvConfig } from "@next/env";
import { users } from "../src/lib/db/schema";
import { e2eSuperAdmin, e2eStaffAdmin, e2eRegistrar, e2eFinance } from "./credentials";

loadEnvConfig(process.cwd());

type E2eUserSpec = {
  username: string;
  password: string;
  role: "super_admin" | "admin" | "registrar" | "finance_officer";
};

const E2E_USERS: E2eUserSpec[] = [
  { ...e2eSuperAdmin, role: "super_admin" },
  { ...e2eStaffAdmin, role: "admin" },
  { ...e2eRegistrar, role: "registrar" },
  { ...e2eFinance, role: "finance_officer" },
];

/**
 * Ensures the synthetic staff accounts used by Playwright exist
 * (super admin, admin, registrar, finance officer).
 */
export async function ensureE2eTestUsers(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn(
      "[e2e] DATABASE_URL is not set; skipping E2E user provisioning (login tests may fail)."
    );
    return;
  }

  const client = postgres(connectionString, { max: 1 });

  try {
    const db = drizzle(client);

    for (const spec of E2E_USERS) {
      const passwordHash = await hash(spec.password, 12);
      const email = `${spec.username}@srams-e2e.invalid`;

      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, spec.username))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(users)
          .set({
            email,
            passwordHash,
            role: spec.role,
            isActive: true,
            forcePasswordChange: false,
            updatedAt: new Date(),
          })
          .where(eq(users.username, spec.username));
      } else {
        await db.insert(users).values({
          email,
          username: spec.username,
          passwordHash,
          role: spec.role,
          isActive: true,
          forcePasswordChange: false,
        });
      }
    }
  } finally {
    await client.end();
  }
}
