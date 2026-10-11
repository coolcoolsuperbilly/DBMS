const db = require('../config/db');
const { sendSuccess } = require('../utils/response');

exports.getRevenueReport = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT TO_CHAR(month_start, 'Mon') AS month,
              TO_CHAR(month_start, 'Mon YYYY') AS month_name,
              COALESCE(paid_amount, total_amount, 0) AS revenue,
              0 AS expenses
       FROM v_revenue_summary
       ORDER BY month_start ASC`
    );
    const totalRev = result.rows.reduce((sum, r) => sum + Number(r.revenue || 0), 0);
    return sendSuccess(res, 200, {
      report: result.rows,
      data: result.rows,
      summary: { ytdRevenue: totalRev },
    });
  } catch (error) {
    next(error);
  }
};

exports.getPatientReport = async (req, res, next) => {
  try {
    const totalResult = await db.query('SELECT COUNT(*) AS total FROM patient');
    const total = Number(totalResult.rows[0]?.total || 0);

    const monthlyResult = await db.query(
      `SELECT TO_CHAR(appointment_date, 'Mon') AS month,
              COUNT(DISTINCT patient_id) AS count,
              COUNT(DISTINCT patient_id) AS total
       FROM appointment
       GROUP BY TO_CHAR(appointment_date, 'Mon')
       LIMIT 6`
    );

    const rows = monthlyResult.rows.length ? monthlyResult.rows : [{ month: 'Current', count: total, total }];

    return sendSuccess(res, 200, {
      report: rows,
      data: rows,
      summary: { total },
    });
  } catch (error) {
    next(error);
  }
};

exports.getAppointmentReport = async (req, res, next) => {
  try {
    const result = await db.query('SELECT status, COUNT(*) AS total FROM appointment GROUP BY status ORDER BY status');
    const totalResult = await db.query('SELECT COUNT(*) AS total FROM appointment');
    const total = Number(totalResult.rows[0]?.total || 0);

    return sendSuccess(res, 200, {
      report: result.rows,
      summary: { total },
    });
  } catch (error) {
    next(error);
  }
};

exports.getPharmacyReport = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM v_pharmacy_alerts ORDER BY stock_quantity ASC');
    return sendSuccess(res, 200, { report: result.rows });
  } catch (error) {
    next(error);
  }
};

exports.getStaffReport = async (req, res, next) => {
  try {
    const result = await db.query('SELECT role, COUNT(*) AS total FROM staff GROUP BY role ORDER BY role');
    return sendSuccess(res, 200, { report: result.rows });
  } catch (error) {
    next(error);
  }
};

exports.getFinancialReport = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT
         SUM(CASE WHEN payment_status = 'paid' THEN amount ELSE 0 END) AS revenue,
         SUM(CASE WHEN payment_status = 'unpaid' THEN amount ELSE 0 END) AS pending,
         SUM(CASE WHEN payment_status = 'partial' THEN amount ELSE 0 END) AS partial
       FROM bill`
    );
    return sendSuccess(res, 200, { report: result.rows[0] });
  } catch (error) {
    next(error);
  }
};
