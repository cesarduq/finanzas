// scripts/inspect-firestore.mjs
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

async function inspect() {
  const users = await fbAuth.listUsers();
  for (const u of users.users) {
    if (u.email === 'cesarinduq@hotmail.com') {
      const doc = await fbDb.collection('usuarios').doc(u.uid).get();
      const data = doc.data();
      const txs = data.transactions || [];
      console.log(`\nUser: ${u.email}`);
      console.log(`Total txs: ${txs.length}`);
      console.log("Tipos de transacciones encontrados en Firestore:");
      const types = {};
      const accounts = {};
      txs.forEach(t => {
        types[t.type] = (types[t.type] || 0) + 1;
        accounts[t.account] = (accounts[t.account] || 0) + 1;
      });
      console.log("Types:", types);
      console.log("Accounts:", accounts);
      console.log("\nPrimeras 10 transacciones:");
      console.log(JSON.stringify(txs.slice(0, 10), null, 2));
    }
  }
}

inspect();
