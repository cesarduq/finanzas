// scripts/inspect-supabase.mjs
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data: users, error: uErr } = await supabase.auth.admin.listUsers();
  if (uErr) {
    console.error('Error listing users:', uErr);
    return;
  }

  for (const u of users.users) {
    console.log(`\n=== Supabase User: ${u.email} (${u.id}) ===`);
    const { data: accs } = await supabase.from('accounts').select('*').eq('user_id', u.id).order('display_order');
    console.log('Accounts:');
    accs?.forEach(a => console.log(`  - ${a.name} (${a.code}): $${a.current_balance} | meta: ${JSON.stringify(a.metadata)}`));

    const { data: debts } = await supabase.from('debts').select('*').eq('user_id', u.id);
    console.log(`Debts (${debts?.length}):`);
    debts?.forEach(d => console.log(`  - ${d.person_name} (${d.type}): $${d.current_balance} (status: ${d.status})`));

    const { count } = await supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('user_id', u.id);
    console.log(`Total transactions in Supabase: ${count}`);

    const { data: sampleTxs } = await supabase.from('transactions').select('*').eq('user_id', u.id).order('created_at', { ascending: false }).limit(5);
    console.log('Sample Txs:', sampleTxs);
  }
}

check();
