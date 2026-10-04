const { query } = require('../config/db');

/**
 * GET /api/hospitals
 * Returns list of all network hospitals
 */
const getAllHospitals = async (req, res) => {
  try {
    const sql = `
      SELECT 
        h.id, h.name, h.code, h.address, h.city, h.phone, h.emergency_contact, h.created_at,
        COUNT(DISTINCT u.id) as staff_count
      FROM hospitals h
      LEFT JOIN users u ON u.hospital_id = h.id
      GROUP BY h.id
      ORDER BY h.id ASC
    `;
    const result = await query(sql);
    return res.status(200).json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    console.error('Error fetching hospitals:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve hospitals list.'
    });
  }
};

/**
 * GET /api/hospitals/:id
 * Get single hospital details
 */
const getHospitalById = async (req, res) => {
  const { id } = req.params;
  try {
    const sql = `SELECT * FROM hospitals WHERE id = $1`;
    const result = await query(sql, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Hospital not found.' });
    }
    return res.status(200).json({ success: true, data: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve hospital.' });
  }
};

module.exports = {
  getAllHospitals,
  getHospitalById
};
