const pool = require('../models/db');
(async function(){
  try {
    const r = await pool.query('SELECT count(*) AS c FROM public.recipes');
    console.log('recipes count ->', r.rows[0].c);
    const cols = await pool.query("SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='recipes' ORDER BY ordinal_position");
    console.log('columns:', cols.rows);
    const sample = await pool.query('SELECT id, title, category, created_by FROM public.recipes ORDER BY id LIMIT 5');
    console.log('sample rows:', sample.rows.length);
    console.dir(sample.rows, { depth: 2 });
  } catch (err) {
    console.error('inspect error', err.message);
  } finally {
    try { await pool.end(); } catch(e){}
  }
})();
