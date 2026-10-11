const db = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

const mapPatient = (row) => {
  const parts = (row.name || '').trim().split(/\s+/);
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ') || '';
  const addressParts = [row.street, row.city, row.state, row.pin_code].filter(Boolean);

  return {
    id: row.patient_id,
    patient_id: row.patient_id,
    name: row.name,
    firstName,
    lastName,
    dob: row.dob,
    dateOfBirth: row.dob,
    gender: row.gender,
    street: row.street,
    city: row.city,
    state: row.state,
    pinCode: row.pin_code,
    pin_code: row.pin_code,
    phone: row.phone,
    contact: row.phone,
    address: addressParts.join(', ') || null,
  };
};

exports.getPatients = async (req, res, next) => {
  try {
    const { search } = req.query;
    let where = '';
    const params = [];

    if (search) {
      where = 'WHERE lower(name) ILIKE $1';
      params.push(`%${search}%`);
    }

    const result = await db.query(
      `SELECT * FROM patient ${where} ORDER BY patient_id DESC`,
      params
    );

    return sendSuccess(res, 200, { patients: result.rows.map(mapPatient) });
  } catch (error) {
    next(error);
  }
};

exports.getPatientById = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM patient WHERE patient_id = $1', [req.params.id]);

    if (!result.rows.length) {
      return sendError(res, 404, 'Patient not found.');
    }

    return sendSuccess(res, 200, { patient: mapPatient(result.rows[0]) });
  } catch (error) {
    next(error);
  }
};

exports.createPatient = async (req, res, next) => {
  try {
    const { name, dob, gender, street, city, state, pinCode, phone } = req.body;
    const resolvedName = name || [req.body.firstName, req.body.lastName].filter(Boolean).join(' ');
    const resolvedDob = dob || req.body.dateOfBirth || null;
    const resolvedGender = gender || null;
    const resolvedStreet = street || req.body.address || null;
    const resolvedCity = city || null;
    const resolvedState = state || null;
    const resolvedPin = pinCode || req.body.pin_code || null;
    const resolvedPhone = phone || req.body.contact || null;

    if (!resolvedName) {
      return sendError(res, 400, 'Patient name is required.');
    }

    const result = await db.query(
      `INSERT INTO patient (name, dob, gender, street, city, state, pin_code, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [resolvedName, resolvedDob, resolvedGender, resolvedStreet, resolvedCity, resolvedState, resolvedPin, resolvedPhone]
    );

    return sendSuccess(res, 201, { patient: mapPatient(result.rows[0]) });
  } catch (error) {
    next(error);
  }
};

exports.updatePatient = async (req, res, next) => {
  try {
    const current = await db.query('SELECT * FROM patient WHERE patient_id = $1', [req.params.id]);
    if (!current.rows.length) {
      return sendError(res, 404, 'Patient not found.');
    }

    let resolvedName = req.body.name;
    if (!resolvedName && (req.body.firstName || req.body.lastName)) {
      resolvedName = [req.body.firstName, req.body.lastName].filter(Boolean).join(' ');
    }

    const resolvedDob = req.body.dob || req.body.dateOfBirth;
    const resolvedStreet = req.body.street || req.body.address;
    const resolvedPin = req.body.pinCode || req.body.pin_code;
    const resolvedPhone = req.body.phone || req.body.contact;

    const result = await db.query(
      `UPDATE patient
       SET name = COALESCE($1, name),
           dob = COALESCE($2, dob),
           gender = COALESCE($3, gender),
           street = COALESCE($4, street),
           city = COALESCE($5, city),
           state = COALESCE($6, state),
           pin_code = COALESCE($7, pin_code),
           phone = COALESCE($8, phone)
       WHERE patient_id = $9
       RETURNING *`,
      [
        resolvedName,
        resolvedDob || null,
        req.body.gender,
        resolvedStreet,
        req.body.city,
        req.body.state,
        resolvedPin,
        resolvedPhone,
        req.params.id,
      ]
    );

    return sendSuccess(res, 200, { patient: mapPatient(result.rows[0]) });
  } catch (error) {
    next(error);
  }
};

exports.deletePatient = async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM patient WHERE patient_id = $1 RETURNING patient_id', [req.params.id]);

    if (!result.rows.length) {
      return sendError(res, 404, 'Patient not found.');
    }

    return sendSuccess(res, 200, { message: 'Patient deleted successfully.' });
  } catch (error) {
    next(error);
  }
};
