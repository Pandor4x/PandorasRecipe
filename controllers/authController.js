const pool = require('../models/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || "yourSecretKey";

// Register user
const registerUser = async (req, res) => {
  const { email, password, is_admin } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (email, password, is_admin) VALUES ($1, $2, $3) RETURNING id, email, is_admin",
      [email, hashedPassword, is_admin || false]
    );
    res.json({ message: "User created!", user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Login user (returns JWT)
const loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    const user = result.rows[0];
    if (!user) return res.status(400).json({ error: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: "Invalid password" });

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, is_admin: user.is_admin },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ message: "Logged in!", token, user: { id: user.id, email: user.email, is_admin: user.is_admin } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { registerUser, loginUser };
