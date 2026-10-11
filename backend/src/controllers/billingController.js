const db = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

const mapBill = (row) => ({
  ...row,
  total_amount: row.amount,
  totalAmount: row.amount,
  status: row.payment_status,
});

exports.getBills = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT b.*, a.patient_id, a.doctor_id, p.name AS patient_name, d.name AS doctor_name
       FROM bill b
       JOIN appointment a ON a.appointment_id = b.appointment_id
       JOIN patient p ON p.patient_id = a.patient_id
       JOIN doctor d ON d.doctor_id = a.doctor_id
       ORDER BY b.bill_id DESC`
    );
    return sendSuccess(res, 200, { bills: result.rows.map(mapBill) });
  } catch (error) {
    next(error);
  }
};

exports.getBillById = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT b.*, a.patient_id, a.doctor_id, p.name AS patient_name, d.name AS doctor_name
       FROM bill b
       JOIN appointment a ON a.appointment_id = b.appointment_id
       JOIN patient p ON p.patient_id = a.patient_id
       JOIN doctor d ON d.doctor_id = a.doctor_id
       WHERE b.bill_id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) return sendError(res, 404, 'Bill not found.');
    return sendSuccess(res, 200, { bill: mapBill(result.rows[0]) });
  } catch (error) {
    next(error);
  }
};

exports.createBill = async (req, res, next) => {
  try {
    let appointmentId = req.body.appointmentId || req.body.appointment_id;
    const patientId = req.body.patientId || req.body.patient_id;
    let branchId = req.body.branchId || req.body.branch_id;
    const amount = req.body.amount !== undefined ? req.body.amount : (req.body.total_amount !== undefined ? req.body.total_amount : req.body.totalAmount);
    const paymentStatus = req.body.paymentStatus || req.body.payment_status || req.body.status || 'unpaid';
    const otScheduleId = req.body.otScheduleId || req.body.ot_schedule_id;

    if (!appointmentId && patientId) {
      // Find latest unbilled appointment for this patient
      const unbilled = await db.query(
        `SELECT a.appointment_id, a.branch_id
         FROM appointment a
         WHERE a.patient_id = $1
           AND NOT EXISTS (SELECT 1 FROM bill b WHERE b.appointment_id = a.appointment_id)
         ORDER BY a.appointment_date DESC, a.appointment_time DESC
         LIMIT 1`,
        [patientId]
      );

      if (unbilled.rows.length) {
        appointmentId = unbilled.rows[0].appointment_id;
        if (!branchId) branchId = unbilled.rows[0].branch_id;
      } else {
        // Auto-create a consultation appointment for this patient to satisfy the BCNF appointment_id FK
        const doc = await db.query('SELECT doctor_id, branch_id FROM doctor LIMIT 1');
        const docId = doc.rows[0]?.doctor_id || 1;
        const bId = branchId || doc.rows[0]?.branch_id || 1;
        const maxTok = await db.query('SELECT COALESCE(MAX(token_no), 0) + 1 AS next_tok FROM appointment WHERE branch_id = $1 AND appointment_date = CURRENT_DATE', [bId]);
        const tok = maxTok.rows[0].next_tok;

        const newAppt = await db.query(
          `INSERT INTO appointment (patient_id, doctor_id, branch_id, appointment_date, appointment_time, token_no, status)
           VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_TIME, $4, 'completed')
           RETURNING appointment_id, branch_id`,
          [patientId, docId, bId, tok]
        );
        appointmentId = newAppt.rows[0].appointment_id;
        if (!branchId) branchId = newAppt.rows[0].branch_id;
      }
    }

    if (!appointmentId) return sendError(res, 400, 'Appointment or patient is required.');

    // Auto-derive branchId from appointment if omitted
    if (!branchId) {
      const appt = await db.query('SELECT branch_id FROM appointment WHERE appointment_id = $1', [appointmentId]);
      if (!appt.rows.length) return sendError(res, 404, 'Referenced appointment not found.');
      branchId = appt.rows[0].branch_id;
    }

    // The DB trigger check_bill_operation_complete validates branch match and OT rules
    const result = await db.query(
      `INSERT INTO bill (appointment_id, branch_id, amount, payment_status, ot_schedule_id)
       VALUES ($1, $2, COALESCE($3, 0), COALESCE($4, 'unpaid'), $5)
       RETURNING *`,
      [appointmentId, branchId, Number(amount || 0), paymentStatus, otScheduleId || null]
    );

    return sendSuccess(res, 201, { bill: mapBill(result.rows[0]) });
  } catch (error) {
    if (error.message && error.message.includes('RAISE')) {
      return sendError(res, 400, error.message);
    }
    next(error);
  }
};

exports.updateBill = async (req, res, next) => {
  try {
    const result = await db.query(
      `UPDATE bill
       SET amount = COALESCE($1, amount),
           payment_status = COALESCE($2, payment_status)
       WHERE bill_id = $3
       RETURNING *`,
      [req.body.amount, req.body.paymentStatus, req.params.id]
    );

    if (!result.rows.length) return sendError(res, 404, 'Bill not found.');
    return sendSuccess(res, 200, { bill: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.recordPayment = async (req, res, next) => {
  try {
    const { amount: paymentAmount } = req.body;
    const current = await db.query('SELECT * FROM bill WHERE bill_id = $1', [req.params.id]);
    if (!current.rows.length) return sendError(res, 404, 'Bill not found.');

    const bill = current.rows[0];
    const total = Number(bill.amount || 0);
    const paid = Number(paymentAmount || total);

    if (paid < 0 || paid > total) {
      return sendError(res, 400, 'Payment amount must be between 0 and the bill total.');
    }

    const nextStatus = paid >= total ? 'paid' : 'partial';
    const result = await db.query(
      `UPDATE bill
       SET payment_status = $1
       WHERE bill_id = $2
       RETURNING *`,
      [nextStatus, req.params.id]
    );

    return sendSuccess(res, 200, {
      bill: result.rows[0],
      message: nextStatus === 'paid' ? 'Payment recorded successfully.' : 'Partial payment recorded successfully.',
    });
  } catch (error) {
    next(error);
  }
};
