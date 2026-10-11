# HMS Data generation and loading (for the earlier SQL pack)

These scripts target the `hms` and `nf_demo` PostgreSQL schemas in the files
created earlier in this conversation. They have NOT been tested against the
current GitHub repository (which was not accessible), and are NOT universal seeds.

## Fresh PostgreSQL database

```bash
createdb hms_evaluation
psql -X -v ON_ERROR_STOP=1 -d hms_evaluation -f HMS_01_final_BCNF_schema.sql
psql -X -v ON_ERROR_STOP=1 -d hms_evaluation -f HMS_02_normalization_demo_33_raw_visits.sql
psql -X -v ON_ERROR_STOP=1 -d hms_evaluation -f HMS_04_seed_remaining_tables.sql
psql -X -v ON_ERROR_STOP=1 -d hms_evaluation -f HMS_03_basic_queries.sql
```

Use `-U <username> -h <host>` when your PostgreSQL installation needs them.
Or execute the four files in order with pgAdmin's Query Tool.

## What you get

- **33 unnormalized raw visits** with redundant hospital/doctor/patient fields and
  repeating medicine-list values; source of the 1NF, 2NF, 3NF demonstration.
- **33 normalized appointments** with 30-minute nonoverlapping slots.
- **26 final HMS tables**, now populated with small synthetic examples.
- Visits spanning different branches, plus pharmacy stock, admitted patients,
  clinical tests, OT surgery schedules, billing and payroll data.
- Example joins, grouped output, simple CRUD with rollback, and an inventory
  dispensing demonstration using `HMS_03_basic_queries.sql`.

## Important

1. Run on a **new DB**. The scripts assume an empty `hms` schema.
2. Do **not** also run the original `HMS_02_normalization_demo.sql`: the
   enhanced `_33_raw_visits.sql` is a replacement.
3. Capture screenshots of `nf_demo.raw_visit`, `nf_demo.nf1_visit`,
   `nf_demo.nf2_visit`, `nf_demo.nf3_*`, and final `hms.*` tables.
4. The normalization demo covers a representative slice, not each of the
   26 relations individually. Present the documented FDs/candidate keys for
   the other tables.
5. `HMS_01_final_BCNF_schema.sql` was statically reviewed here but these files
   have not been run against a live PostgreSQL server.
6. Small authentication tables outside the HMS core are fine; document their
   purpose and use appropriately normalized fields even for auth records.

## Useful queries

```sql
SELECT COUNT(*) FROM nf_demo.raw_visit;
SELECT COUNT(*) FROM nf_demo.nf1_visit;
SELECT COUNT(*) FROM nf_demo.nf2_visit;
SELECT * FROM nf_demo.nf3_patient ORDER BY patient_id;
SELECT * FROM hms.v_appointments_by_branch;
SELECT * FROM hms.v_pharmacy_low_stock;
```
