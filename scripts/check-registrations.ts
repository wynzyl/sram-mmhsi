import postgres from "postgres";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function check() {
  const client = postgres(process.env.DATABASE_URL!, { max: 1 });

  const rows = await client`
    SELECT sy.label, sy.is_active, r.status, COUNT(*)::int as count
    FROM registrations r
    JOIN school_years sy ON r.school_year_id = sy.id
    GROUP BY sy.label, sy.is_active, r.status
    ORDER BY sy.label, r.status
  `;
  console.log("Registrations by school year / status:");
  console.table(rows);

  const activeSy = await client`SELECT id, label FROM school_years WHERE is_active = true LIMIT 1`;
  console.log("\nActive school year:", activeSy[0] ?? "NONE");

  const enroll = await client`
    SELECT e.status, COUNT(*)::int as count
    FROM enrollments e
    JOIN school_years sy ON e.school_year_id = sy.id
    WHERE sy.is_active = true
    GROUP BY e.status
  `;
  console.log("\nEnrollments in active SY:");
  console.table(enroll.length ? enroll : [{ status: "none", count: 0 }]);

  await client.end();
}

check().catch((e) => { console.error(e); process.exit(1); });
