import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
const app = initializeApp({ credential: cert(serviceAccount) });
const fbAuth = getAuth(app);
const fbDb = getFirestore(app);

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const users = await fbAuth.listUsers();
  const { data: sbUsers } = await supabase.auth.admin.listUsers();

  for (const fbUser of users.users) {
    const sbUser = sbUsers.users.find(u => u.email === fbUser.email);
    if (!sbUser) continue;

    console.log(`\n==============================================`);
    console.log(`PROCESANDO: ${fbUser.email} (${sbUser.id})`);
    console.log(`==============================================`);

    const doc = await fbDb.collection('usuarios').doc(fbUser.uid).get();
    const fbTxs = doc.data()?.transactions || [];
    const fbMap = new Map();
    fbTxs.forEach(t => fbMap.set(String(t.id), t));

    const { data: sbTxs, error: fetchErr } = await supabase
      .from('transactions')
      .select('id, type, amount, account_id, metadata, note, created_at')
      .eq('user_id', sbUser.id);

    if (fetchErr) {
      console.error('Error fetching Supabase txs:', fetchErr);
      continue;
    }

    console.log(`Firestore txs: ${fbTxs.length} | Supabase txs: ${sbTxs.length}`);

    const updates = [];

    for (const st of sbTxs) {
      let fsId = String(st.metadata?.firestore_id);
      let fixMetadata = false;

      // Handle the two 2026-03-05 $1 transactions where firestore_id was swapped
      if (st.id === '07333fee-c027-4f9a-b43c-f0add201e88f' && fsId === '1772730938918') {
        fsId = '1772727029005';
        fixMetadata = true;
      } else if (st.id === '63337e53-94e3-4018-b0e7-3e4fdc9ae9c4' && fsId === '1772727029005') {
        fsId = '1772730938918';
        fixMetadata = true;
      }

      const ft = fbMap.get(fsId);
      if (!ft) {
        console.warn(`No Firestore match for Supabase TX: ${st.id} (fsId: ${fsId})`);
        continue;
      }

      let newType = ft.type;
      // Inversion in Hapi/Broker
      if (st.type === 'inversion') {
        newType = 'invest';
      }
      // Sin banco debt_in
      if (st.type === 'debt_in' && ft.type === 'debt_in') {
        newType = 'debt_in';
      }

      const patch = {};
      if (st.type !== newType) {
        patch.type = newType;
      }
      if (fixMetadata) {
        patch.metadata = { ...st.metadata, firestore_id: Number(fsId) };
      }

      if (Object.keys(patch).length > 0) {
        updates.push({ id: st.id, oldType: st.type, patch });
      }
    }

    console.log(`Transacciones a actualizar tipo: ${updates.length} de ${sbTxs.length}`);

    // Count transitions
    const transitionCounts = {};
    updates.forEach(u => {
      const key = `${u.oldType} -> ${u.patch.type || u.oldType}`;
      transitionCounts[key] = (transitionCounts[key] || 0) + 1;
    });
    console.log('Transiciones a aplicar:');
    console.table(transitionCounts);

    // Apply updates in batches
    console.log('Aplicando actualizaciones en Supabase...');
    let successCount = 0;
    for (const u of updates) {
      const { error: upErr } = await supabase
        .from('transactions')
        .update(u.patch)
        .eq('id', u.id);

      if (upErr) {
        console.error(`Error updating TX ${u.id}:`, upErr);
      } else {
        successCount++;
      }
    }
    console.log(`✓ ${successCount} transacciones actualizadas exitosamente en Supabase.`);
  }

  console.log('\n¡PROCESO COMPLETADO!');
}

main();
