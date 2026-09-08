// scripts/inspect-debts-history.mjs
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

async function check() {
  const users = await fbAuth.listUsers();
  for (const u of users.users) {
    if (u.email === 'cesarinduq@hotmail.com') {
      const doc = await fbDb.collection('usuarios').doc(u.uid).get();
      const data = doc.data();
      const txs = data?.transactions || [];

      const persons = {};

      txs.forEach((t) => {
        if (t.person || ["loan_out", "loan_payment", "debt_in", "debt_payment"].includes(t.type)) {
          const person = t.person || 'Sin persona';
          if (!persons[person]) {
            persons[person] = [];
          }
          persons[person].push(t);
        }
      });

      console.log('--- Debt Summary by Person for cesarinduq@hotmail.com ---');
      for (const [person, list] of Object.entries(persons)) {
        let balance = 0;
        list.forEach(t => {
          const val = Number(t.amount) || 0;
          if (t.type === 'loan_out' || t.type === 'debt_payment') balance += val;
          if (t.type === 'loan_payment' || t.type === 'debt_in') balance -= val;
        });
        console.log(`Person: "${person}" -> ${list.length} movements, final balance: $${balance.toFixed(2)}`);
      }
    }
  }
}

check();
