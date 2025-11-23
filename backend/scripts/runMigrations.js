const fs = require('fs');
const path = require('path');
const pool = require('../models/db');

async function ensureMigrationsTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS migration_history (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await pool.query(sql);
}

async function getAppliedMigrations() {
  const res = await pool.query('SELECT filename FROM migration_history');
  return new Set(res.rows.map(r => r.filename));
}

async function applyMigration(filePath, filename) {
  const sql = fs.readFileSync(filePath, 'utf8');
  console.log('Applying', filename);
  await pool.query(sql);
  await pool.query('INSERT INTO migration_history(filename) VALUES($1)', [filename]);
  console.log('Applied', filename);
}

async function run() {
  try {
    const migrationsDir = path.join(__dirname, '..', 'db', 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.error('Migrations directory not found:', migrationsDir);
      process.exit(1);
    }

    await ensureMigrationsTable();
    const applied = await getAppliedMigrations();

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log('Skipping already applied:', file);
        continue;
      }
      const fullPath = path.join(migrationsDir, file);
      await applyMigration(fullPath, file);
    }

    console.log('Migrations complete.');
    process.exit(0);
  } catch (err) {
    console.error('Migration runner error:', err);
    process.exit(2);
  }
}

run();
