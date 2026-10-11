const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'medicare_hms',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  options: '-c search_path=hms,public',
});

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET search_path TO hms, public');

    console.log('Seeding BCNF-compliant sample data...');

    // 1. Branches
    await client.query(`
      INSERT INTO branch (branch_id, location, status)
      VALUES
        (1, 'Main Campus - Central Hospital, Kochi', 'active'),
        (2, 'City Annex - Medical Plaza, Ernakulam', 'active'),
        (3, 'North Annex - Care Clinic, Thrissur', 'inactive')
      ON CONFLICT (branch_id) DO NOTHING;
    `);

    // 2. Departments
    await client.query(`
      INSERT INTO department (department_id, department_name, branch_id, status)
      VALUES
        (1, 'Cardiology', 1, 'active'),
        (2, 'Neurology', 1, 'active'),
        (3, 'General Medicine', 1, 'active'),
        (4, 'Orthopedics', 2, 'active'),
        (5, 'Pediatrics', 2, 'active')
      ON CONFLICT (department_id) DO NOTHING;
    `);

    // 3. Doctors
    await client.query(`
      INSERT INTO doctor (doctor_id, name, specialization, phone, department_id)
      VALUES
        (1, 'Dr. Sarah Chen', 'Cardiology', '+91 9876543210', 1),
        (2, 'Dr. James Wilson', 'Neurology', '+91 9876543211', 2),
        (3, 'Dr. Priya Nair', 'General Medicine', '+91 9876543212', 3),
        (4, 'Dr. Ahmed Hassan', 'Orthopedics', '+91 9876543213', 4)
      ON CONFLICT (doctor_id) DO NOTHING;
    `);

    // 4. Doctor Shifts (essential for appointment booking business rules)
    await client.query(`
      INSERT INTO doctor_shift (doctor_id, branch_id, shift_start, shift_end)
      VALUES
        (1, 1, '2026-01-01 00:00:00', '2099-12-31 23:59:59'),
        (2, 1, '2026-01-01 00:00:00', '2099-12-31 23:59:59'),
        (3, 1, '2026-01-01 00:00:00', '2099-12-31 23:59:59'),
        (4, 2, '2026-01-01 00:00:00', '2099-12-31 23:59:59')
      ON CONFLICT (doctor_id, branch_id, shift_start) DO NOTHING;
    `);

    // 5. Nurses
    await client.query(`
      INSERT INTO nurse (nurse_id, name, shift, branch_id)
      VALUES
        (1, 'Margaret Ellis', 'Morning', 1),
        (2, 'Lucy Park', 'Evening', 1),
        (3, 'Carlos Mendez', 'Morning', 2)
      ON CONFLICT (nurse_id) DO NOTHING;
    `);

    // 6. Staff
    await client.query(`
      INSERT INTO staff (staff_id, name, role, shift, branch_id)
      VALUES
        (1, 'Kevin Tran', 'PHARMACIST', 'Morning', 1),
        (2, 'Samuel Okafor', 'LAB_TECH', 'Morning', 1),
        (3, 'Fiona Walsh', 'BILLING', 'General', 2)
      ON CONFLICT (staff_id) DO NOTHING;
    `);

    // 7. Rooms
    await client.query(`
      INSERT INTO room (branch_id, room_no, room_type, critical_care_monitoring, availability_status)
      VALUES
        (1, '101', 'private', false, 'available'),
        (1, '102', 'general', false, 'available'),
        (1, 'ICU-1', 'icu', true, 'occupied'),
        (2, '201', 'private', false, 'available'),
        (2, '202', 'general', false, 'available')
      ON CONFLICT (branch_id, room_no) DO NOTHING;
    `);

    // 8. Patients
    await client.query(`
      INSERT INTO patient (patient_id, name, dob, gender, street, city, state, pin_code, phone)
      VALUES
        (1, 'Emma Johnson', '1990-04-15', 'Female', '123 Marine Drive', 'Kochi', 'Kerala', '682001', '+91 9090909090'),
        (2, 'Michael Chen', '1972-08-20', 'Male', '45 Park Avenue', 'Kochi', 'Kerala', '682002', '+91 9090909091'),
        (3, 'Sophia Williams', '1994-01-05', 'Female', '78 Hill Road', 'Ernakulam', 'Kerala', '682016', '+91 9090909092'),
        (4, 'Robert Davis', '1957-09-16', 'Male', '12 Lake View', 'Kochi', 'Kerala', '682003', '+91 9090909093')
      ON CONFLICT (patient_id) DO NOTHING;
    `);

    // 9. Pharmacies
    await client.query(`
      INSERT INTO pharmacy (pharmacy_id, branch_id)
      VALUES
        (1, 1),
        (2, 2)
      ON CONFLICT (pharmacy_id) DO NOTHING;
    `);

    // 10. Medicines
    await client.query(`
      INSERT INTO medicine (medicine_id, name)
      VALUES
        (1, 'Paracetamol 500mg'),
        (2, 'Amoxicillin 250mg'),
        (3, 'Atorvastatin 20mg'),
        (4, 'Metformin 500mg'),
        (5, 'Lisinopril 10mg')
      ON CONFLICT (medicine_id) DO NOTHING;
    `);

    // 11. Pharmacy Inventory
    await client.query(`
      INSERT INTO pharmacy_inventory (pharmacy_id, medicine_id, stock_quantity, price, reorder_level)
      VALUES
        (1, 1, 500, 1.50, 50),
        (1, 2, 200, 4.00, 30),
        (1, 3, 150, 6.50, 25),
        (1, 4, 300, 2.25, 40),
        (2, 1, 350, 1.50, 50),
        (2, 5, 180, 3.20, 30)
      ON CONFLICT (pharmacy_id, medicine_id) DO NOTHING;
    `);

    // 12. Operation Theatres
    await client.query(`
      INSERT INTO operation_theatre (ot_id, branch_id, status)
      VALUES
        (1, 1, 'available'),
        (2, 2, 'available')
      ON CONFLICT (ot_id) DO NOTHING;
    `);

    // 13. Equipment
    await client.query(`
      INSERT INTO equipment (equipment_id, branch_id, name, location, maintenance_date, status)
      VALUES
        (1, 1, 'Cardiac Monitor', 'ICU-1', CURRENT_DATE - 15, 'available'),
        (2, 1, 'Anesthesia Machine', 'OT Block', CURRENT_DATE - 30, 'available'),
        (3, 2, 'Defibrillator', 'Emergency Wing', CURRENT_DATE - 10, 'available')
      ON CONFLICT (equipment_id) DO NOTHING;
    `);

    // 14. Pay Structures
    await client.query(`
      INSERT INTO pay_structure (pay_structure_id, employee_type, base_pay, allowance_rate, status)
      VALUES
        (1, 'doctor', 90000.00, 0.1500, 'active'),
        (2, 'nurse', 45000.00, 0.1000, 'active'),
        (3, 'staff', 38000.00, 0.0800, 'active')
      ON CONFLICT (pay_structure_id) DO NOTHING;
    `);

    // Synchronize identity sequences for any inserted explicit IDs
    const syncSequences = [
      ['branch', 'branch_id'],
      ['department', 'department_id'],
      ['doctor', 'doctor_id'],
      ['patient', 'patient_id'],
      ['nurse', 'nurse_id'],
      ['staff', 'staff_id'],
      ['pharmacy', 'pharmacy_id'],
      ['medicine', 'medicine_id'],
      ['operation_theatre', 'ot_id'],
      ['equipment', 'equipment_id'],
      ['pay_structure', 'pay_structure_id'],
    ];

    for (const [tbl, col] of syncSequences) {
      await client.query(`
        SELECT setval(
          pg_get_serial_sequence('hms.${tbl}', '${col}'),
          COALESCE((SELECT MAX(${col}) FROM hms.${tbl}), 1)
        );
      `);
    }

    await client.query('COMMIT');
    console.log('Sample data seeded successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
