import { db } from "../src/lib/db";
import { sql } from "drizzle-orm";

async function main() {
  try {
    const result = await db.execute<{ nextval: string }>(sql`SELECT nextval('bfx_reference_seq') AS nextval`);
    console.log("✓ Sequence bfx_reference_seq works! Current value:", result[0].nextval);

    // Reset it back one step to not consume a number
    await db.execute(sql`SELECT setval('bfx_reference_seq', currval('bfx_reference_seq') - 1)`);
    console.log("✓ Reset sequence back to previous value");
    
    process.exit(0);
  } catch (error: any) {
    console.error("✗ Error:", error.message);
    process.exit(1);
  }
}

main();
