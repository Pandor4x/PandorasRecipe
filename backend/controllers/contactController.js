const pool = require('../models/db');

const addMessage = async (req, res) => {
  const { name, email, message, timestamp } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO contact_messages (name, email, message, timestamp) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, email, message, timestamp || Date.now()]
    );
    res.json({ message: "Message sent!", data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { addMessage };