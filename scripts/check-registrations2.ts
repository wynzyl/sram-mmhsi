import postgres from "postgres";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function check() {
  const client = postgres(process.env.DATABASE_URL!, { max: 1 });

  const rows = await client`
    SELECT s.reference_number, s.first_name, s.last_name,
           r.status AS reg_status, e.status AS enroll_status
    FROM registrations r
    JOIN students s ON r.student_id = s.id
    JOIN school_years sy ON r.school_year_id = sy.id
    LEFT JOIN enrollments e ON e.student_id = s.id AND e.school_year_id = sy.id
    WHERE sy.is_active = true AND r.status = 'approved'
    ORDER BY s.reference_number
  `;
  console.table(rows);
  await client.end();
}

check().catch((e) => { console.error(e); process.exit(1); });
