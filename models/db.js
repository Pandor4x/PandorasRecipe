const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT) || 5432,
  // Enable SSL only for non-local hosts. Many local Postgres instances
  // do not support SSL, which causes "server does not support SSL" errors.
  // For production/remote DBs, set DB_HOST to the remote host and SSL will
  // be enabled with relaxed verification (use stricter settings in prod).
  ssl: process.env.DB_HOST && process.env.DB_HOST !== 'localhost'
    ? { rejectUnauthorized: false }
    : false
});

module.exports = pool;
