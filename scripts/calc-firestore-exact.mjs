// scripts/calc-firestore-exact.mjs
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

function calculateBalances(transactions) {
  let bal = {
    Pichincha: 0,
    DeUna: 0,
    Guayaquil: 0,
    PeiGo: 0,
    Produbanco: 0,
    Binance: 0,
    UglyCash: 0,
    Efectivo: 0,
    Airtm: 0,
    Hapi: 0,
    Morse: 0,
    SP500: 0,
    Nasdaq: 0,
    PorCobrar: 0,
    Total: 0,
  };
  let debts = {};

  transactions.forEach((t) => {
    let val = Number(t.amount) || 0;

    // Sumas
    if (
      ["ingreso", "trade_profit", "loan_payment", "transfer_in"].includes(
        t.type,
      )
    ) {
      if (bal[t.account] !== undefined) bal[t.account] += val;
    }
    // Restas
    else if (
      ["gasto", "trade_loss", "loan_out", "transfer_out", "debt_payment"].includes(t.type)
    ) {
      if (bal[t.account] !== undefined) bal[t.account] -= val;
    }

    // Deudas (Todas interactúan con PorCobrar)
    if (t.type === "loan_out") {
      bal["PorCobrar"] += val;
      debts[t.person] = (debts[t.person] || 0) + val;
    } else if (t.type === "loan_payment") {
      bal["PorCobrar"] -= val;
      debts[t.person] = (debts[t.person] || 0) - val;
    } else if (t.type === "debt_in") {
      bal["PorCobrar"] -= val;
      debts[t.person] = (debts[t.person] || 0) - val;
    } else if (t.type === "debt_payment") {
      bal["PorCobrar"] += val;
      debts[t.person] = (debts[t.person] || 0) + val;
    }
  });

  bal["Total"] =
    bal["Pichincha"] +
    bal["Guayaquil"] +
    bal["Produbanco"] +
    bal["Binance"] +
    bal["PeiGo"] +
    bal["UglyCash"] +
    bal["Efectivo"] +
    bal["Hapi"] +
    bal["Airtm"] +
    bal["Morse"] +
    bal["SP500"] +
    bal["Nasdaq"] +
    bal["PorCobrar"];

  return { bal, debts };
}

async function run() {
  const users = await fbAuth.listUsers();
  for (const u of users.users) {
    if (u.email === 'cesarinduq@hotmail.com' || u.email === 'charlz13db@hotmail.com') {
      const doc = await fbDb.collection('usuarios').doc(u.uid).get();
      const data = doc.data();
      const txs = data?.transactions || [];
      console.log(`\n=== USER: ${u.email} (Total Firestore txs: ${txs.length}) ===`);
      const { bal, debts } = calculateBalances(txs);
      console.log('Calculated Balances:', JSON.stringify(bal, null, 2));
      console.log('Calculated Debts:', JSON.stringify(debts, null, 2));
    }
  }
}

run();
