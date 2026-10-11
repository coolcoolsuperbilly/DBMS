const db = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

const mapDoctor = (row) => ({
  id: row.doctor_id,
  doctorId: row.doctor_id,
  name: row.name,
  doctorName: row.name,
  specialization: row.specialization,
  phone: row.phone,
  departmentId: row.department_id,
  departmentName: row.department_name,
  branchId: row.branch_id,
  branchLocation: row.branch_location,
});

exports.getDoctors = async (req, res, next) => {
  try {
    const { department, search } = req.query;
    let where = '';
    const params = [];

    if (department && department !== 'all') {
      where = `${where ? ' AND ' : ' WHERE '} d.department_id = $${params.length + 1}`;
      params.push(department);
    }

    if (search) {
      where = `${where ? ' AND ' : ' WHERE '} lower(d.name) ILIKE $${params.length + 1}`;
      params.push(`%${search}%`);
    }

    const result = await db.query(
      `SELECT d.*, dep.department_name, dep.branch_id, b.location AS branch_location
       FROM doctor d
       JOIN department dep ON dep.department_id = d.department_id
       JOIN branch b ON b.branch_id = dep.branch_id
       ${where}
       ORDER BY d.doctor_id DESC`,
      params
    );

    return sendSuccess(res, 200, { doctors: result.rows.map(mapDoctor) });
  } catch (error) {
    next(error);
  }
};

exports.getDoctorById = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT d.*, dep.department_name, dep.branch_id, b.location AS branch_location
       FROM doctor d
       JOIN department dep ON dep.department_id = d.department_id
       JOIN branch b ON b.branch_id = dep.branch_id
       WHERE d.doctor_id = $1`,
      [req.params.id]
    );

    if (!result.rows.length) {
      return sendError(res, 404, 'Doctor not found.');
    }

    return sendSuccess(res, 200, { doctor: mapDoctor(result.rows[0]) });
  } catch (error) {
    next(error);
  }
};

exports.createDoctor = async (req, res, next) => {
  try {
    const doctorName = req.body.name || req.body.doctor_name;
    const deptId = req.body.departmentId || req.body.department_id;
    const { specialization, phone } = req.body;

    if (!doctorName || !deptId) {
      return sendError(res, 400, 'Doctor name and department are required.');
    }

    const result = await db.query(
      `INSERT INTO doctor (name, specialization, phone, department_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [doctorName, specialization || null, phone || null, deptId]
    );

    // Fetch full record with department and branch
    const full = await db.query(
      `SELECT d.*, dep.department_name, dep.branch_id, b.location AS branch_location
       FROM doctor d
       JOIN department dep ON dep.department_id = d.department_id
       JOIN branch b ON b.branch_id = dep.branch_id
       WHERE d.doctor_id = $1`,
      [result.rows[0].doctor_id]
    );

    return sendSuccess(res, 201, { doctor: mapDoctor(full.rows[0] || result.rows[0]) });
  } catch (error) {
    next(error);
  }
};

exports.updateDoctor = async (req, res, next) => {
  try {
    const doctorName = req.body.name || req.body.doctor_name;
    const deptId = req.body.departmentId || req.body.department_id;

    const result = await db.query(
      `UPDATE doctor
       SET name = COALESCE($1, name),
           specialization = COALESCE($2, specialization),
           phone = COALESCE($3, phone),
           department_id = COALESCE($4, department_id)
       WHERE doctor_id = $5
       RETURNING *`,
      [
        doctorName,
        req.body.specialization,
        req.body.phone,
        deptId,
        req.params.id,
      ]
    );

    if (!result.rows.length) {
      return sendError(res, 404, 'Doctor not found.');
    }

    const full = await db.query(
      `SELECT d.*, dep.department_name, dep.branch_id, b.location AS branch_location
       FROM doctor d
       JOIN department dep ON dep.department_id = d.department_id
       JOIN branch b ON b.branch_id = dep.branch_id
       WHERE d.doctor_id = $1`,
      [result.rows[0].doctor_id]
    );

    return sendSuccess(res, 200, { doctor: mapDoctor(full.rows[0] || result.rows[0]) });
  } catch (error) {
    next(error);
  }
};

exports.deleteDoctor = async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM doctor WHERE doctor_id = $1 RETURNING doctor_id', [req.params.id]);
    if (!result.rows.length) {
      return sendError(res, 404, 'Doctor not found.');
    }
    return sendSuccess(res, 200, { message: 'Doctor deleted successfully.' });
  } catch (error) {
    next(error);
  }
};
