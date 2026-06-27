import postgres from 'postgres';
import { config } from 'dotenv';
import { expand } from 'dotenv-expand';

expand(config({ path: '.env.local' }));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Define it in .env.local or the runtime environment.');
}

const sql = postgres(DATABASE_URL, { max: 1 });

// Check a student with balance forward - Elena Mendoza (SRAMS-2026-00005)
async function check() {
  try {
    // Get all enrollments for this student
    const enrollments = await sql`
      SELECT 
        e.id as enrollment_id,
        e.status as enrollment_status,
        e.student_type,
        sy.label as school_year,
        sy.start_date,
        a.id as assessment_id,
        a.billing_status,
        a.balance,
        a.total_amount,
        a.total_paid,
        a.transferred_at,
        a.transferred_to_assessment_id
      FROM enrollments e
      JOIN students s ON s.id = e.student_id
      JOIN school_years sy ON sy.id = e.school_year_id
      LEFT JOIN assessments a ON a.enrollment_id = e.id AND a.cancelled_at IS NULL
      WHERE s.reference_number = 'SRAMS-2026-00005'
      ORDER BY sy.start_date ASC
    `;
    console.log('=== Elena Mendoza (SRAMS-2026-00005) All Enrollments ===');
    console.log(JSON.stringify(enrollments, null, 2));
    
    // Get payments for this student
    const payments = await sql`
      SELECT 
        p.id,
        p.kind,
        p.status,
        p.reference_number,
        p.or_number,
        p.amount,
        p.payment_date,
        sy.label as school_year,
        a.billing_status
      FROM payments p
      JOIN assessments a ON a.id = p.assessment_id
      JOIN enrollments e ON e.id = a.enrollment_id
      JOIN students s ON s.id = e.student_id
      JOIN school_years sy ON sy.id = e.school_year_id
      WHERE s.reference_number = 'SRAMS-2026-00005'
      ORDER BY p.payment_date DESC
    `;
    console.log('\n=== All Payments for Elena Mendoza ===');
    console.log(JSON.stringify(payments, null, 2));
    
    // Check assessment items for BFX
    const bfxItems = await sql`
      SELECT 
        ai.id,
        ai.description,
        ai.amount,
        ai.source_assessment_id,
        a.billing_status as current_assessment_status,
        sy.label as school_year
      FROM assessment_items ai
      JOIN assessments a ON a.id = ai.assessment_id
      JOIN enrollments e ON e.id = a.enrollment_id
      JOIN students s ON s.id = e.student_id
      JOIN school_years sy ON sy.id = e.school_year_id
      WHERE s.reference_number = 'SRAMS-2026-00005'
        AND ai.source_assessment_id IS NOT NULL
      ORDER BY ai.created_at
    `;
    console.log('\n=== Balance Forward Items for Elena Mendoza ===');
    console.log(JSON.stringify(bfxItems, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

check();
