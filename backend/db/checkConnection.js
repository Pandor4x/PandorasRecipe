const pool = require('../models/db');

// Usage: node db/checkConnection.js <tableName>
const table = process.argv[2] || 'users';

if (!/^[A-Za-z0-9_]+$/.test(table)) {
  console.error('Invalid table name. Use only letters, numbers, and underscores.');
  process.exit(1);
}

(async () => {
  try {
    const result = await pool.query(`SELECT * FROM ${table} LIMIT 5`);
    console.log(`Fetched ${result.rows.length} rows from table '${table}':`);
    console.table(result.rows);
  } catch (err) {
    console.error('Error querying DB:', err.message || err);
  } finally {
    try { await pool.end(); } catch (e) {}
  }
})();
