// scripts/analyze-firestore-txs.mjs
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));

const app = initializeApp({
  credential: cert(serviceAccount),
});

const fbAuth = getAuth(app);
const fbDb = getFirestore(app);

async function analyze() {
  const users = await fbAuth.listUsers();
  for (const u of users.users) {
    if (u.email === 'cesarinduq@hotmail.com') {
      const doc = await fbDb.collection('usuarios').doc(u.uid).get();
      const data = doc.data();
      const txs = data?.transactions || [];
      console.log(`\n=== USER: ${u.email} (${txs.length} txs) ===`);

      // Group txs by type and show 2 examples of each type
      const byType = {};
      txs.forEach(t => {
        if (!byType[t.type]) byType[t.type] = [];
        byType[t.type].push(t);
      });

      for (const [type, list] of Object.entries(byType)) {
        console.log(`\n--- Type: "${type}" (count: ${list.length}) ---`);
        console.log('Sample 2:', JSON.stringify(list.slice(0, 2), null, 2));
      }
    }
  }
}

analyze();
