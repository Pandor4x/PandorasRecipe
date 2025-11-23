const pool = require('../models/db');

async function dropAll() {
  const stmts = [
    "DROP TABLE IF EXISTS public.contact_messages CASCADE;",
    "DROP SEQUENCE IF EXISTS public.contact_messages_id_seq CASCADE;",
    "DROP TABLE IF EXISTS public.favorites CASCADE;",
    "DROP SEQUENCE IF EXISTS public.favorites_id_seq CASCADE;",
    "DROP TABLE IF EXISTS public.recipes CASCADE;",
    "DROP SEQUENCE IF EXISTS public.recipes_id_seq CASCADE;",
    "DROP TABLE IF EXISTS public.reviews CASCADE;",
    "DROP SEQUENCE IF EXISTS public.reviews_id_seq CASCADE;",
    "DROP TABLE IF EXISTS public.users CASCADE;",
    "DROP SEQUENCE IF EXISTS public.users_id_seq CASCADE;",
    "DROP TABLE IF EXISTS public.migration_history CASCADE;"
  ];

  try {
    for (const s of stmts) {
      try {
        await pool.query(s);
        console.log('OK:', s.replace(/\s+/g,' ').trim().slice(0,60));
      } catch (e) {
        console.log('WARN:', e.message.split('\n')[0]);
      }
    }
    console.log('Drops complete');
  } catch (err) {
    console.error('dropTables error', err.message);
    process.exitCode = 2;
  } finally {
    try { await pool.end(); } catch(e){}
  }
}

if (require.main === module) dropAll();
