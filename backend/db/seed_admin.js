const pool = require('../models/db');
const bcrypt = require('bcryptjs');

// Usage: node db/seed_admin.js <email> <password>
const email = process.argv[2] || 'admin@example.com';
const password = process.argv[3] || 'admin';

(async () => {
  try {
    const existing = await pool.query('SELECT id, email, is_admin FROM users WHERE email=$1', [email]);
    if (existing.rows.length) {
      console.log('User already exists:', existing.rows[0]);
      return process.exit(0);
    }

    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password, is_admin) VALUES ($1, $2, $3) RETURNING id, email, is_admin',
      [email, hashed, true]
    );

    console.log('Admin user created:', result.rows[0]);
  } catch (err) {
    console.error('Error creating admin user:', err.message || err);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch (e) {}
  }
})();
