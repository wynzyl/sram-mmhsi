import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

async function check() {
  // Check sections count
  const sections = await sql`SELECT COUNT(*) as count FROM sections`;
  console.log("Total sections:", sections[0].count);
  
  // Check if sections have duplicate grade_level_id references
  const sectionsByGrade = await sql`
    SELECT gl.name, gl.id, COUNT(s.id) as section_count 
    FROM grade_levels gl 
    LEFT JOIN sections s ON s.grade_level_id = gl.id 
    GROUP BY gl.id, gl.name 
    ORDER BY gl."order"
  `;
  
  console.log("\nSections per grade level:");
  sectionsByGrade.forEach(r => console.log(`  ${r.name}: ${r.section_count} sections`));
  
  // Check for any weird joins that might cause duplication
  const testJoin = await sql`
    SELECT gl.id, gl.name 
    FROM grade_levels gl 
    ORDER BY gl."order"
  `;
  console.log("\nDirect grade_levels query:", testJoin.length, "rows");
  
  await sql.end();
}

check().catch(e => {
  console.error(e);
  process.exit(1);
});
