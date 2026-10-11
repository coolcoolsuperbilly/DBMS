-- OPTIONAL: basic visualization queries + safe editing (PostgreSQL).
-- Run after files 01 and 02.

-- 1. Data for a bar chart: appointments by branch.
SELECT * FROM hms.v_appointments_by_branch ORDER BY branch_id;

-- 2. Data for a bar chart: appointments by doctor.
SELECT d.name AS doctor, COUNT(a.appointment_id) AS appointment_count
FROM hms.doctor d LEFT JOIN hms.appointment a ON a.doctor_id = d.doctor_id
GROUP BY d.doctor_id, d.name ORDER BY appointment_count DESC;

-- 3. Pharmacy stock alert view (per pharmacy).
SELECT * FROM hms.v_pharmacy_low_stock ORDER BY pharmacy_id, medicine_id;

-- 4. Basic JOIN for readable patient appointment data.
SELECT a.appointment_id, p.name AS patient, d.name AS doctor,
       b.location, a.appointment_date, a.appointment_time, a.status
FROM hms.appointment a
JOIN hms.patient p ON p.patient_id = a.patient_id
JOIN hms.doctor d ON d.doctor_id = a.doctor_id
JOIN hms.branch b ON b.branch_id = a.branch_id
ORDER BY a.appointment_date, a.appointment_time;

-- 5. Demonstrate UPDATE and DELETE safely inside a transaction.
-- ROLLBACK means demo changes are NOT permanently saved.
BEGIN;
UPDATE hms.patient SET phone = '9999999999' WHERE patient_id = 10;
SELECT patient_id, name, phone FROM hms.patient WHERE patient_id = 10;
-- Create and remove a purely demo patient, showing basic CRUD.
INSERT INTO hms.patient(patient_id, name, city)
VALUES (90001, 'Temporary Test Patient', 'Kochi');
DELETE FROM hms.patient WHERE patient_id = 90001;
ROLLBACK;

-- 6. Demonstrate dispensing safely (actual sale would COMMIT instead).
BEGIN;
SELECT hms.dispense_medicine(900, 3001, 2) AS stock_after_dispensing;
ROLLBACK;

-- 7. Verify the documented key constraints (important for BCNF viva).
SELECT table_name, constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'hms'
  AND table_name IN ('doctor_shift', 'room', 'prescription_detail',
                     'pharmacy_inventory', 'salary_shift_log', 'bill')
  AND constraint_type IN ('PRIMARY KEY', 'UNIQUE')
ORDER BY table_name, constraint_name;
