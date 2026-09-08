// scripts/breakdown-firestore-accounts.mjs
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

      const accountStats = {};

      txs.forEach((t) => {
        const acc = t.account || 'Unknown';
        if (!accountStats[acc]) {
          accountStats[acc] = {
            totalPlus: 0,
            totalMinus: 0,
            net: 0,
            types: {}
          };
        }
        const val = Number(t.amount) || 0;
        const type = t.type;
        accountStats[acc].types[type] = (accountStats[acc].types[type] || 0) + val;

        if (["ingreso", "trade_profit", "loan_payment", "transfer_in"].includes(type)) {
          accountStats[acc].totalPlus += val;
          accountStats[acc].net += val;
        } else if (["gasto", "trade_loss", "loan_out", "transfer_out", "debt_payment"].includes(type)) {
          accountStats[acc].totalMinus += val;
          accountStats[acc].net -= val;
        }
      });

      console.log('--- Account Breakdown for cesarinduq@hotmail.com ---');
      for (const [acc, stat] of Object.entries(accountStats)) {
        console.log(`\nAccount: ${acc}`);
        console.log(`  Plus: +$${stat.totalPlus.toFixed(2)}`);
        console.log(`  Minus: -$${stat.totalMinus.toFixed(2)}`);
        console.log(`  NET: $${stat.net.toFixed(2)}`);
        console.log(`  By type:`, stat.types);
      }
    }
  }
}

check();
