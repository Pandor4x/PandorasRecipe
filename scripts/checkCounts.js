const pool = require('../models/db');

async function check() {
  try {
    const tables = ['recipes','users','favorites','reviews','contact_messages'];
    for (const t of tables) {
      try {
        const r = await pool.query(`SELECT count(*) AS c FROM public.${t}`);
        console.log(t, r.rows[0].c);
      } catch (e) {
        console.log(t, 'ERROR:', e.message.split('\n')[0]);
      }
    }
  } catch (err) {
    console.error('checkCounts error', err);
    process.exitCode = 2;
  } finally {
    try { await pool.end(); } catch(e){}
  }
}

if (require.main === module) check();
