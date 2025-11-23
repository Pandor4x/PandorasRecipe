const fs = require('fs');
const path = require('path');
require('dotenv').config();
const pool = require('../models/db');

function splitSql(sql) {
  const stmts = [];
  let cur = '';
  let i = 0;
  let inS = false; // single quote '
  let inD = false; // double quote "
  let inLineComment = false; // --
  let inBlockComment = false; // /* */
  let inDollar = false; // $$ or $tag$
  let dollarTag = null;

  while (i < sql.length) {
    const c = sql[i];
    const next2 = sql.substr(i, 2);

    // handle line comments
    if (!inS && !inD && !inBlockComment && !inDollar && next2 === '--') {
      inLineComment = true;
      cur += next2;
      i += 2;
      continue;
    }
    if (inLineComment) {
      if (c === '\n') {
        inLineComment = false;
      }
      cur += c;
      i++;
      continue;
    }

    // block comments
    if (!inS && !inD && !inBlockComment && !inDollar && next2 === '/*') {
      inBlockComment = true;
      cur += next2;
      i += 2;
      continue;
    }
    if (inBlockComment) {
      cur += c;
      if (sql.substr(i, 2) === '*/') {
        cur += sql.substr(i+1,1); // add */ (we'll add the next char in loop too)
        i += 2;
        inBlockComment = false;
        continue;
      }
      i++;
      continue;
    }

    // dollar-quote start/stop
    if (!inS && !inD && !inDollar && c === '$') {
      // read tag
      const m = sql.substr(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (m) {
        inDollar = true;
        dollarTag = m[0];
        cur += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }
    if (inDollar) {
      // look for closing tag
      if (sql.substr(i, dollarTag.length) === dollarTag) {
        cur += dollarTag;
        i += dollarTag.length;
        inDollar = false;
        dollarTag = null;
        continue;
      }
      cur += c;
      i++;
      continue;
    }

    // quotes
    if (!inD && c === "'") {
      inS = !inS;
      cur += c;
      i++;
      continue;
    }
    if (!inS && c === '"') {
      inD = !inD;
      cur += c;
      i++;
      continue;
    }

    // Skip psql meta-commands (lines starting with backslash)
    if (!inS && !inD && !inDollar && c === '\\') {
      // read until end of line and skip
      const eol = sql.indexOf('\n', i);
      if (eol === -1) break;
      // append as comment so it's not lost
      // cur += ('-- ' + sql.substring(i, eol));
      i = eol + 1;
      continue;
    }

    // statement separator
    if (!inS && !inD && !inDollar && c === ';') {
      cur += c;
      const t = cur.trim();
      if (t) stmts.push(t);
      cur = '';
      i++;
      continue;
    }

    cur += c;
    i++;
  }

  const last = cur.trim();
  if (last) stmts.push(last);
  return stmts;
}

async function applyBackup(filePath) {
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log('Read backup file, size:', sql.length);

    // Remove lines that are psql meta-commands starting with backslash
    // (we handle additional skipping in parser)

    // First, handle COPY ... FROM stdin blocks (pg_dump produces these with following data lines)
    const lines = sql.split(/\r?\n/);
    const nonCopyLines = [];
    let i = 0;
    const copyJobs = [];

    while (i < lines.length) {
      const line = lines[i];
      const copyMatch = line.match(/^COPY\s+([\w\.\"]+)\s*\(([^)]+)\)\s+FROM\s+stdin;$/i);
      if (copyMatch) {
        const table = copyMatch[1].replace(/"/g, '');
        const cols = copyMatch[2].split(',').map(c => c.trim().replace(/"/g, ''));
        i++;
        const rows = [];
        while (i < lines.length && lines[i] !== '\\.') {
          rows.push(lines[i]);
          i++;
        }
        // skip the terminating \.
        i++;
        copyJobs.push({ table, cols, rows });
        // add a placeholder comment so position counts remain similar
        nonCopyLines.push('-- copied data for ' + table);
        continue;
      }
      nonCopyLines.push(line);
      i++;
    }

    const remainingSql = nonCopyLines.join('\n');
    const stmts = splitSql(remainingSql);
    console.log('Parsed', stmts.length, 'statements +', copyJobs.length, 'COPY blocks. Executing...');

    // Execute non-COPY statements first
    for (let j = 0; j < stmts.length; j++) {
      const s = stmts[j].trim();
      if (!s) continue;
      if (/^CREATE\s+DATABASE/i.test(s)) {
        console.log('Skipping CREATE DATABASE statement');
        continue;
      }
      if (/OWNER\s+TO/i.test(s) || /^SET\s+ROLE/i.test(s) || /^ALTER\s+DATABASE\s+/i.test(s)) {
        console.log('Skipping statement that changes ownership/role (requires superuser):', s.split('\n')[0].substring(0,200));
        continue;
      }
      try {
        await pool.query(s);
      } catch (err) {
        const msg = String(err && err.message ? err.message : err);
        if (msg.includes('already exists') || err.code === '42P07' || err.code === '42710') {
          console.log('Skipping statement', j+1, '- object already exists:', msg.split('\n')[0]);
          continue;
        }
        console.error('Error executing statement', j+1, 'of', stmts.length, '\n', msg);
        console.error('Statement snippet:', s.substring(0,200));
        throw err;
      }
      if ((j+1) % 50 === 0) console.log('Executed', j+1, 'statements');
    }

    // Now process COPY jobs by converting each data row to INSERTs
    // Prepare DB for inserts: drop a few known foreign-key constraints that
    // would block inserting rows from the dump when referenced rows are missing.
    try {
      // Drop common foreign-key constraints that would block inserting data
      await pool.query("ALTER TABLE IF EXISTS public.recipes DROP CONSTRAINT IF EXISTS recipes_created_by_fkey");
      await pool.query("ALTER TABLE IF EXISTS public.favorites DROP CONSTRAINT IF EXISTS favorites_recipe_id_fkey");
      await pool.query("ALTER TABLE IF EXISTS public.favorites DROP CONSTRAINT IF EXISTS favorites_user_id_fkey");
      await pool.query("ALTER TABLE IF EXISTS public.reviews DROP CONSTRAINT IF EXISTS reviews_recipe_id_fkey");
      console.log('Dropped known FK constraints (if they existed)');
    } catch (e) {
      console.log('Could not drop some FK constraints:', e.message.split('\n')[0]);
    }

    // Process in dependency order to avoid foreign-key insertion errors
    const preferredOrder = ['recipes','users','reviews','favorites','contact_messages'];
    const jobMap = new Map(copyJobs.map(j => [j.table.replace(/^public\./,''), j]));
    const processed = new Set();

    // helper to perform job
    async function runJob(job) {
      const { table, cols, rows } = job;
      console.log('Applying COPY data for', table, '-', rows.length, 'rows');
      if (!rows.length) return;
      let inserted = 0;
      for (let r = 0; r < rows.length; r++) {
        const line = rows[r];
        const parts = line.split('\t');
        if (table.includes('recipes') && r === 0) {
          console.log('DEBUG recipes first row parts:', parts.length, 'cols:', cols.length);
        }
        const vals = parts.map(p => (p === '\\N' ? null : p));
        const placeholders = vals.map((_, idx) => '$' + (idx + 1)).join(',');
        const insertSql = `INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`;
        try {
          await pool.query(insertSql, vals);
          inserted++;
        } catch (err) {
          const msg = String(err && err.message ? err.message : err);
          if (msg.includes('already exists') || err.code === '23505' || msg.includes('duplicate key')) {
            console.log('Skipping duplicate row for', table, 'row', r+1);
            continue;
          }
          console.error('Error inserting row', r+1, 'into', table, '-', msg.split('\n')[0]);
          console.error('Row snippet:', line.substring(0,200));
          throw err;
        }
      }
      console.log('Finished COPY block for', table, '- inserted', inserted);
    }

    // run preferred ordered jobs first if present
    for (const t of preferredOrder) {
      const j = jobMap.get(t) || jobMap.get('public.' + t) || jobMap.get('"' + t + '"');
      if (j) {
        await runJob(j);
        processed.add(j.table);
      }
    }

    // run remaining jobs
    for (const job of copyJobs) {
      if (processed.has(job.table)) continue;
      await runJob(job);
    }

    console.log('Backup applied successfully');
  } catch (err) {
    console.error('Backup apply error:', err.stack || err.message);
    process.exitCode = 2;
  } finally {
    try { await pool.end(); } catch(e){}
  }
}

if (require.main === module) {
  const p = path.join(__dirname, '..', 'db', 'pandorax_backup.sql');
  if (!fs.existsSync(p)) { console.error('Backup file not found:', p); process.exit(2); }
  applyBackup(p);
}
