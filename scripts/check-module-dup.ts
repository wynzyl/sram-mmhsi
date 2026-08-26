import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function check() {
  // Import twice to simulate potential module duplication
  const { db: db1 } = await import("../src/lib/db");
  const { db: db2 } = await import("../src/lib/db");
  const { gradeLevels } = await import("../src/lib/db/schema");
  
  console.log("db1 === db2:", db1 === db2);
  
  const result1 = await db1.select({ id: gradeLevels.id, name: gradeLevels.name }).from(gradeLevels);
  const result2 = await db2.select({ id: gradeLevels.id, name: gradeLevels.name }).from(gradeLevels);
  
  console.log("Query 1 returned:", result1.length, "rows");
  console.log("Query 2 returned:", result2.length, "rows");
  
  // Simulate concatenation bug
  const combined = [...result1, ...result2];
  console.log("Combined would be:", combined.length, "rows");
  
  process.exit(0);
}

check().catch(e => {
  console.error(e);
  process.exit(1);
});
