const pool = require('../models/db');

async function show() {
  try {
    const rTables = await pool.query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
    console.log('public schema tables:', rTables.rows.map(x=>x.table_name).join(', '));

    const r = await pool.query('SELECT id, title FROM public.recipes ORDER BY id LIMIT 20');
    console.log('recipes rows:', r.rows.length);
    for (const row of r.rows) console.log(row);

    // attempt a test insert to verify write permissions
    try {
      await pool.query("INSERT INTO public.contact_messages (id,name,email,message,\"timestamp\") VALUES (999999,'diag','diag','diag',1234567890)");
      console.log('Inserted test row into contact_messages');
      const cr = await pool.query('SELECT count(*) AS c FROM public.contact_messages');
      console.log('contact_messages count after test insert:', cr.rows[0].c);
      // clean up
      await pool.query('DELETE FROM public.contact_messages WHERE id = 999999');
      console.log('Removed test row');
    } catch (e) {
      console.log('test insert failed:', e.message);
    }

    const r2 = await pool.query('SELECT id, name, email FROM public.contact_messages ORDER BY id LIMIT 10');
    console.log('contact_messages rows:', r2.rows.length);
    for (const row of r2.rows) console.log(row);
  } catch (err) {
    console.error('showRows error', err.message);
  } finally {
    try { await pool.end(); } catch(e){}
  }
}

if (require.main === module) show();
