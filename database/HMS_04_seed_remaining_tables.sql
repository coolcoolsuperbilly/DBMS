-- EXTRA DATA FOR REMAINING HMS TABLES (PostgreSQL 14+).
-- Run once IN A FRESH DATABASE after:
--   1. HMS_01_final_BCNF_schema.sql
--   2. HMS_02_normalization_demo_33_raw_visits.sql
-- Do NOT combine with original 02 demo (both use the same nf_demo schema).
-- Not a seed for an unknown/different GitHub schema.
-- Uses only SYNTHETIC data. All IDs and their relationships are deterministic.

BEGIN;

INSERT INTO hms.nurse(nurse_id,name,shift,branch_id) VALUES
(1000,'Nurse Mira','Morning',100),(1001,'Nurse Jaya','Evening',100),
(1002,'Nurse Sunita','Morning',101),(1003,'Nurse Omar','Evening',101),
(1004,'Nurse Nikhil','Morning',102),(1005,'Nurse Kavi','Evening',102);

INSERT INTO hms.staff(staff_id,name,role,shift,branch_id) VALUES
(1100,'Staff Anna','Receptionist','Morning',100),
(1101,'Staff Bala','Lab Technician','Morning',100),
(1102,'Staff Charu','Pharmacist','Morning',101),
(1103,'Staff Diya','Receptionist','Evening',101),
(1104,'Staff Eshan','Lab Technician','Morning',102),
(1105,'Staff Farah','Billing Clerk','Evening',102);

INSERT INTO hms.nurse_assignment(nurse_id,patient_id,assignment_date)
SELECT 1000 + 2*((patient_id-20)%3), patient_id, CURRENT_DATE - 1
FROM hms.patient WHERE patient_id BETWEEN 20 AND 31;

INSERT INTO hms.staff_assignment(staff_id,patient_id,assignment_date)
SELECT 1100 + 2*((patient_id-20)%3), patient_id, CURRENT_DATE - 1
FROM hms.patient WHERE patient_id BETWEEN 20 AND 31;

INSERT INTO hms.room(branch_id,room_no,room_type,critical_care_monitoring,availability_status)
SELECT b.branch_id,
       CASE n WHEN 4 THEN 'ICU-1' ELSE 'R10' || n::TEXT END,
       CASE n WHEN 4 THEN 'icu' WHEN 1 THEN 'private' ELSE 'general' END,
       (n = 4), 'available'
FROM hms.branch b CROSS JOIN generate_series(1,4) AS rooms(n)
WHERE b.branch_id IN (100,101,102);

INSERT INTO hms.admission(admission_id,patient_id,branch_id,room_no,admit_date_time,discharge_date_time) VALUES
(3000,20,100,'R101',CURRENT_DATE - 2 + TIME '08:00',NULL),
(3001,21,101,'R101',CURRENT_DATE - 3 + TIME '08:00',NULL),
(3002,22,102,'R101',CURRENT_DATE - 4 + TIME '08:00',NULL),
(3003,23,100,'ICU-1',CURRENT_DATE - 1 + TIME '11:00',NULL),
(3004,24,101,'ICU-1',CURRENT_DATE - 1 + TIME '11:00',NULL),
(3005,25,102,'R102',CURRENT_DATE - 2 + TIME '08:00',NULL);

UPDATE hms.room r SET availability_status = 'occupied'
WHERE EXISTS (SELECT 1 FROM hms.admission a
              WHERE a.branch_id = r.branch_id AND a.room_no = r.room_no
              AND a.discharge_date_time IS NULL);

INSERT INTO hms.pharmacy(pharmacy_id,branch_id) VALUES (901,101),(902,102);
INSERT INTO hms.pharmacy_inventory(pharmacy_id,medicine_id,stock_quantity,price,reorder_level)
SELECT p.pharmacy_id, m.medicine_id,
       CASE WHEN (p.pharmacy_id + m.medicine_id) % 3 = 0 THEN 12 ELSE 90 END,
       CASE p.pharmacy_id WHEN 900 THEN 3.25 WHEN 901 THEN 3.75 ELSE 4.20 END,
       25
FROM hms.pharmacy p CROSS JOIN hms.medicine m
ON CONFLICT (pharmacy_id, medicine_id) DO NOTHING;

INSERT INTO hms.lab_result(lab_result_id,patient_id,test_type,order_date,result_date,result_details)
SELECT 4000 + (patient_id - 20), patient_id,
       CASE patient_id%3 WHEN 0 THEN 'Blood Test' WHEN 1 THEN 'ECG' ELSE 'X-Ray' END,
       CURRENT_DATE - 2, CURRENT_DATE - 1, 'Synthetic normal findings'
FROM hms.patient WHERE patient_id BETWEEN 20 AND 31;

INSERT INTO hms.operation_theatre(ot_id,branch_id,status) VALUES
(5000,100,'available'),(5001,101,'available'),(5002,102,'available');

INSERT INTO hms.ot_schedule(ot_schedule_id,ot_id,patient_id,doctor_id,nurse_id,procedure,
                             schedule_start,schedule_end,status) VALUES
(6000,5000,20,200,1000,'Minor cardiac procedure',
 CURRENT_DATE - 4 + TIME '09:00',CURRENT_DATE - 4 + TIME '10:00','completed'),
(6001,5001,21,201,1002,'Orthopedic day procedure',
 CURRENT_DATE - 3 + TIME '09:00',CURRENT_DATE - 3 + TIME '10:00','completed'),
(6002,5002,22,202,1004,'Neurology intervention',
 CURRENT_DATE + 10 + TIME '10:00',CURRENT_DATE + 10 + TIME '11:00','scheduled'),
(6003,5000,23,200,1001,'Follow-up procedure',
 CURRENT_DATE + 11 + TIME '10:00',CURRENT_DATE + 11 + TIME '11:00','scheduled');

INSERT INTO hms.equipment(equipment_id,branch_id,name,location,maintenance_date,status) VALUES
(6500,100,'ECG Monitor','Cardiology Lab',CURRENT_DATE - 15,'available'),
(6501,100,'Ventilator','ICU',CURRENT_DATE - 20,'in_use'),
(6502,101,'Ultrasound','Radiology',CURRENT_DATE - 10,'available'),
(6503,101,'Portable X-Ray','Radiology',CURRENT_DATE - 25,'available'),
(6504,102,'Infusion Pump','ICU',CURRENT_DATE - 12,'available'),
(6505,102,'Defibrillator','Emergency',CURRENT_DATE - 7,'available');

-- Appointment 601/602 were set 5 days before today in the raw data demo.
-- Mark them completed before adding linked operation bills.
UPDATE hms.appointment SET status = 'completed' WHERE appointment_id IN (601,602);

INSERT INTO hms.bill(bill_id,appointment_id,branch_id,amount,bill_date,payment_status,ot_schedule_id) VALUES
(7000,601,100,4500.00,CURRENT_DATE - 2,'paid',6000),
(7001,602,101,6200.00,CURRENT_DATE - 1,'paid',6001),
(7002,603,102,850.00,CURRENT_DATE,'unpaid',NULL);

INSERT INTO hms.shift_log(shift_log_id,branch_id,doctor_id,nurse_id,staff_id,shift_date,
                          start_time,end_time,status) VALUES
(8000,100,200,NULL,NULL,(date_trunc('month',CURRENT_DATE - INTERVAL '1 month')::date)+10,
 TIME '09:00',TIME '17:00','completed'),
(8001,100,NULL,1000,NULL,(date_trunc('month',CURRENT_DATE - INTERVAL '1 month')::date)+10,
 TIME '09:00',TIME '17:00','completed'),
(8002,100,NULL,NULL,1100,(date_trunc('month',CURRENT_DATE - INTERVAL '1 month')::date)+10,
 TIME '09:00',TIME '17:00','completed'),
(8003,101,201,NULL,NULL,(date_trunc('month',CURRENT_DATE - INTERVAL '1 month')::date)+11,
 TIME '09:00',TIME '17:00','completed'),
(8004,101,NULL,1002,NULL,(date_trunc('month',CURRENT_DATE - INTERVAL '1 month')::date)+11,
 TIME '09:00',TIME '17:00','completed'),
(8005,101,NULL,NULL,1102,(date_trunc('month',CURRENT_DATE - INTERVAL '1 month')::date)+11,
 TIME '09:00',TIME '17:00','completed');

INSERT INTO hms.pay_structure(pay_structure_id,employee_type,base_pay,allowance_rate,status) VALUES
(9000,'doctor',100000.00,0.1000,'active'),
(9001,'nurse',55000.00,0.0800,'active'),
(9002,'staff',35000.00,0.0500,'active');

INSERT INTO hms.salary(salary_id,branch_id,doctor_id,nurse_id,staff_id,pay_structure_id,pay_month,
                       base_pay_applied,allowance_applied,salary_amount) VALUES
(9100,100,200,NULL,NULL,9000,date_trunc('month',CURRENT_DATE - INTERVAL '1 month')::date,100000,10000,110000),
(9101,100,NULL,1000,NULL,9001,date_trunc('month',CURRENT_DATE - INTERVAL '1 month')::date,55000,4400,59400),
(9102,100,NULL,NULL,1100,9002,date_trunc('month',CURRENT_DATE - INTERVAL '1 month')::date,35000,1750,36750),
(9103,101,201,NULL,NULL,9000,date_trunc('month',CURRENT_DATE - INTERVAL '1 month')::date,100000,10000,110000),
(9104,101,NULL,1002,NULL,9001,date_trunc('month',CURRENT_DATE - INTERVAL '1 month')::date,55000,4400,59400),
(9105,101,NULL,NULL,1102,9002,date_trunc('month',CURRENT_DATE - INTERVAL '1 month')::date,35000,1750,36750);

INSERT INTO hms.salary_shift_log(salary_id,shift_log_id) VALUES
(9100,8000),(9101,8001),(9102,8002),(9103,8003),(9104,8004),(9105,8005);

-- Identity counters: avoid clashes when your application inserts rows later.
DO $$
DECLARE table_name TEXT; identity_column TEXT; max_id BIGINT;
BEGIN
    FOR table_name, identity_column IN
        SELECT c.table_name, c.column_name
        FROM information_schema.columns c
        WHERE c.table_schema = 'hms' AND c.is_identity = 'YES'
    LOOP
        EXECUTE format('SELECT COALESCE(MAX(%I), 1) FROM hms.%I', identity_column, table_name) INTO max_id;
        PERFORM setval(pg_get_serial_sequence(format('hms.%s', table_name), identity_column), max_id);
    END LOOP;
END;
$$;

COMMIT;

-- Exact row counts for all documented relations (not pg_stat estimates).
CREATE TEMP TABLE hms_seed_table_counts(table_name TEXT, row_count BIGINT);
DO $$
DECLARE r RECORD; c BIGINT;
BEGIN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'hms' LOOP
        EXECUTE format('SELECT COUNT(*) FROM hms.%I', r.tablename) INTO c;
        INSERT INTO hms_seed_table_counts VALUES (r.tablename, c);
    END LOOP;
END;
$$;
SELECT * FROM hms_seed_table_counts ORDER BY table_name;
SELECT (SELECT COUNT(*) FROM hms.appointment) AS appointments,
       (SELECT COUNT(*) FROM hms.patient) AS patients,
       (SELECT COUNT(*) FROM hms.admission) AS admissions,
       (SELECT COUNT(*) FROM hms.bill) AS bills;
SELECT * FROM hms.v_pharmacy_low_stock ORDER BY pharmacy_id,medicine_id;
