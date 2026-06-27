import postgres from 'postgres';

const sql = postgres('postgresql://postgres:722811@localhost:5432/SRAMS_DB', { max: 1 });

async function check() {
  try {
    // Check what students exist
    const students = await sql`
      SELECT reference_number, first_name, last_name 
      FROM students 
      WHERE deleted_at IS NULL
      ORDER BY reference_number
      LIMIT 10
    `;
    console.log('Available students:');
    console.log(JSON.stringify(students, null, 2));
    
    // Check for any balance forward payments
    const bfx = await sql`
      SELECT 
        p.id,
        p.kind,
        p.status,
        p.reference_number as bfx_number,
        p.amount,
        s.reference_number as student_ref,
        s.first_name,
        s.last_name
      FROM payments p
      JOIN assessments a ON a.id = p.assessment_id
      JOIN enrollments e ON e.id = a.enrollment_id
      JOIN students s ON s.id = e.student_id
      WHERE p.kind = 'balance_forward'
        AND s.deleted_at IS NULL
      ORDER BY p.created_at DESC
      LIMIT 10
    `;
    console.log('\nBalance Forward Payments:');
    console.log(JSON.stringify(bfx, null, 2));
    
    // Check for assessments with balance_forwarded status
    const transferred = await sql`
      SELECT 
        a.id as assessment_id,
        a.billing_status,
        a.balance,
        a.transferred_at,
        s.reference_number as student_ref,
        e.status as enrollment_status,
        sy.label as school_year
      FROM assessments a
      JOIN enrollments e ON e.id = a.enrollment_id
      JOIN students s ON s.id = e.student_id
      JOIN school_years sy ON sy.id = e.school_year_id
      WHERE a.billing_status = 'balance_forwarded'
        AND s.deleted_at IS NULL
      ORDER BY a.transferred_at DESC
      LIMIT 10
    `;
    console.log('\nTransferred (Balance Forwarded) Assessments:');
    console.log(JSON.stringify(transferred, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

check();
