import { config } from 'dotenv';
import { expand } from 'dotenv-expand';
import postgres from 'postgres';

expand(config({ path: '.env.local' }));
expand(config({ path: '.env' }));

const DATABASE_URL = process.env.DATABASE_URL?.replace('db:', 'localhost:');
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 1 });

async function checkStudent() {
  try {
    const result = await sql`
      SELECT 
        s.reference_number,
        s.first_name,
        s.last_name,
        e.id as enrollment_id,
        e.status as enrollment_status,
        e.student_type,
        e.school_year_id,
        sy.label as school_year,
        a.id as assessment_id,
        a.billing_status,
        a.balance,
        a.transferred_at,
        a.transferred_to_assessment_id
      FROM students s
      LEFT JOIN enrollments e ON e.student_id = s.id AND e.cancelled_at IS NULL
      LEFT JOIN school_years sy ON sy.id = e.school_year_id
      LEFT JOIN assessments a ON a.enrollment_id = e.id AND a.cancelled_at IS NULL
      WHERE s.reference_number = '0000001'
        AND s.deleted_at IS NULL
      ORDER BY sy.start_date DESC
    `;
    
    console.log('Student 0000001 Enrollment Status:');
    console.log(JSON.stringify(result, null, 2));
    
    // Also check payments
    const payments = await sql`
      SELECT 
        p.id,
        p.kind,
        p.status,
        p.amount,
        p.reference_number,
        p.payment_date,
        p.assessment_id
      FROM payments p
      JOIN assessments a ON a.id = p.assessment_id
      JOIN enrollments e ON e.id = a.enrollment_id
      JOIN students s ON s.id = e.student_id
      WHERE s.reference_number = '0000001'
        AND s.deleted_at IS NULL
      ORDER BY p.payment_date DESC
    `;
    
    console.log('\nPayments for Student 0000001:');
    console.log(JSON.stringify(payments, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

checkStudent();
