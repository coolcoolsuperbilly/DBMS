const db = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

exports.getMedicines = async (req, res, next) => {
  try {
    const { search } = req.query;
    let where = '';
    const params = [];

    if (search) {
      where = 'WHERE lower(m.name) ILIKE $1';
      params.push(`%${search}%`);
    }

    const result = await db.query(
      `SELECT m.medicine_id,
              m.medicine_id AS id,
              m.name,
              m.name AS medicine_name,
              COALESCE(inv.stock_quantity, 0) AS stock_quantity,
              COALESCE(inv.stock_quantity, 0) AS "stockQuantity",
              COALESCE(inv.price, 0) AS unit_price,
              COALESCE(inv.price, 0) AS "unitPrice",
              COALESCE(inv.price, 0) AS price,
              'General' AS category,
              'active' AS status
       FROM medicine m
       LEFT JOIN (
         SELECT medicine_id, SUM(stock_quantity) AS stock_quantity, AVG(price) AS price
         FROM pharmacy_inventory
         GROUP BY medicine_id
       ) inv ON inv.medicine_id = m.medicine_id
       ${where}
       ORDER BY m.medicine_id DESC`,
      params
    );

    return sendSuccess(res, 200, { medicines: result.rows });
  } catch (error) {
    next(error);
  }
};

exports.getMedicineById = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT m.medicine_id,
              m.medicine_id AS id,
              m.name,
              m.name AS medicine_name,
              COALESCE(inv.stock_quantity, 0) AS stock_quantity,
              COALESCE(inv.stock_quantity, 0) AS "stockQuantity",
              COALESCE(inv.price, 0) AS unit_price,
              COALESCE(inv.price, 0) AS "unitPrice",
              COALESCE(inv.price, 0) AS price,
              'General' AS category,
              'active' AS status
       FROM medicine m
       LEFT JOIN (
         SELECT medicine_id, SUM(stock_quantity) AS stock_quantity, AVG(price) AS price
         FROM pharmacy_inventory
         GROUP BY medicine_id
       ) inv ON inv.medicine_id = m.medicine_id
       WHERE m.medicine_id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) return sendError(res, 404, 'Medicine not found.');
    return sendSuccess(res, 200, { medicine: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.createMedicine = async (req, res, next) => {
  try {
    const name = req.body.name || req.body.medicineName;
    const stockQuantity = req.body.stockQuantity !== undefined ? Number(req.body.stockQuantity) : (req.body.stock_quantity !== undefined ? Number(req.body.stock_quantity) : 0);
    const unitPrice = req.body.unitPrice !== undefined ? Number(req.body.unitPrice) : (req.body.unit_price !== undefined ? Number(req.body.unit_price) : (req.body.price !== undefined ? Number(req.body.price) : 0));

    if (!name) return sendError(res, 400, 'Medicine name is required.');

    const medResult = await db.query(
      `INSERT INTO medicine (name) VALUES ($1) RETURNING *`,
      [name]
    );
    const medicine = medResult.rows[0];

    // Ensure a pharmacy exists and insert inventory
    let pharm = await db.query('SELECT pharmacy_id FROM pharmacy LIMIT 1');
    if (!pharm.rows.length) {
      pharm = await db.query('INSERT INTO pharmacy (branch_id) VALUES (1) RETURNING pharmacy_id');
    }
    const pharmacyId = pharm.rows[0].pharmacy_id;

    await db.query(
      `INSERT INTO pharmacy_inventory (pharmacy_id, medicine_id, stock_quantity, price, reorder_level)
       VALUES ($1, $2, $3, $4, 10)
       ON CONFLICT (pharmacy_id, medicine_id)
       DO UPDATE SET stock_quantity = EXCLUDED.stock_quantity, price = EXCLUDED.price`,
      [pharmacyId, medicine.medicine_id, stockQuantity, unitPrice]
    );

    return sendSuccess(res, 201, {
      medicine: {
        ...medicine,
        stock_quantity: stockQuantity,
        stockQuantity,
        unit_price: unitPrice,
        unitPrice,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.updateMedicine = async (req, res, next) => {
  try {
    const name = req.body.name || req.body.medicineName;
    const stockQuantity = req.body.stockQuantity !== undefined ? Number(req.body.stockQuantity) : (req.body.stock_quantity !== undefined ? Number(req.body.stock_quantity) : undefined);
    const unitPrice = req.body.unitPrice !== undefined ? Number(req.body.unitPrice) : (req.body.unit_price !== undefined ? Number(req.body.unit_price) : (req.body.price !== undefined ? Number(req.body.price) : undefined));

    if (name) {
      await db.query(
        `UPDATE medicine SET name = $1 WHERE medicine_id = $2`,
        [name, req.params.id]
      );
    }

    if (stockQuantity !== undefined || unitPrice !== undefined) {
      let pharm = await db.query('SELECT pharmacy_id FROM pharmacy LIMIT 1');
      if (!pharm.rows.length) {
        pharm = await db.query('INSERT INTO pharmacy (branch_id) VALUES (1) RETURNING pharmacy_id');
      }
      const pharmacyId = pharm.rows[0].pharmacy_id;

      await db.query(
        `INSERT INTO pharmacy_inventory (pharmacy_id, medicine_id, stock_quantity, price, reorder_level)
         VALUES ($1, $2, COALESCE($3, 0), COALESCE($4, 0), 10)
         ON CONFLICT (pharmacy_id, medicine_id)
         DO UPDATE SET
           stock_quantity = COALESCE($3, pharmacy_inventory.stock_quantity),
           price = COALESCE($4, pharmacy_inventory.price)`,
        [pharmacyId, req.params.id, stockQuantity, unitPrice]
      );
    }

    const updated = await db.query(
      `SELECT m.*,
              COALESCE(inv.stock_quantity, 0) AS stock_quantity,
              COALESCE(inv.stock_quantity, 0) AS "stockQuantity",
              COALESCE(inv.price, 0) AS unit_price,
              COALESCE(inv.price, 0) AS "unitPrice"
       FROM medicine m
       LEFT JOIN (
         SELECT medicine_id, SUM(stock_quantity) AS stock_quantity, AVG(price) AS price
         FROM pharmacy_inventory
         GROUP BY medicine_id
       ) inv ON inv.medicine_id = m.medicine_id
       WHERE m.medicine_id = $1`,
      [req.params.id]
    );

    if (!updated.rows.length) return sendError(res, 404, 'Medicine not found.');
    return sendSuccess(res, 200, { medicine: updated.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.deleteMedicine = async (req, res, next) => {
  try {
    await db.query('DELETE FROM pharmacy_inventory WHERE medicine_id = $1', [req.params.id]);
    const result = await db.query('DELETE FROM medicine WHERE medicine_id = $1 RETURNING medicine_id', [req.params.id]);
    if (!result.rows.length) return sendError(res, 404, 'Medicine not found.');
    return sendSuccess(res, 200, { message: 'Medicine deleted successfully.' });
  } catch (error) {
    next(error);
  }
};
