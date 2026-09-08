// scripts/sync-exact-firestore-to-supabase.mjs
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth as getFbAuth } from 'firebase-admin/auth';
import { getFirestore as getFbDb } from 'firebase-admin/firestore';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));

const fbApp = initializeApp({
  credential: cert(serviceAccount),
});

const fbAuth = getFbAuth(fbApp);
const fbDb = getFbDb(fbApp);

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ACCOUNT_CODE_MAP = {
  'Pichincha': 'pichincha',
  'DeUna': 'deuna',
  'Deuna': 'deuna',
  'Guayaquil': 'guayaquil',
  'PeiGo': 'peigo',
  'Peigo': 'peigo',
  'Produbanco': 'produbanco',
  'Binance': 'binance',
  'UglyCash': 'ugly',
  'Ugly Cash': 'ugly',
  'Airtm': 'airtm',
  'Efectivo': 'efectivo',
  'Morse': 'morse',
  'Hapi': 'hapi',
  'SP500': 'hapi',
  'Nasdaq': 'hapi',
  'PorCobrar': 'por_cobrar',
  'Por Cobrar': 'por_cobrar',
};

function calculateBalances(transactions) {
  let bal = {
    pichincha: 0,
    deuna: 0,
    guayaquil: 0,
    peigo: 0,
    produbanco: 0,
    binance: 0,
    ugly: 0,
    efectivo: 0,
    airtm: 0,
    morse: 0,
    hapi: 0,
    sp500: 0,
    nasdaq: 0,
    por_cobrar: 0,
    total: 0,
  };
  let debts = {};

  transactions.forEach((t) => {
    let val = Number(t.amount) || 0;
    const acc = ACCOUNT_CODE_MAP[t.account] || t.account?.toLowerCase();

    // Sumas
    if (["ingreso", "trade_profit", "loan_payment", "transfer_in"].includes(t.type)) {
      if (t.account === 'SP500') bal.sp500 += val;
      else if (t.account === 'Nasdaq') bal.nasdaq += val;
      else if (bal[acc] !== undefined) bal[acc] += val;
    }
    // Restas
    else if (["gasto", "trade_loss", "loan_out", "transfer_out", "debt_payment"].includes(t.type)) {
      if (bal[acc] !== undefined) bal[acc] -= val;
    }

    // Deudas (Todas interactúan con PorCobrar)
    if (t.person || ["loan_out", "loan_payment", "debt_in", "debt_payment"].includes(t.type)) {
      const person = t.person?.trim() || 'Sin persona';
      if (t.type === "loan_out") {
        bal.por_cobrar += val;
        debts[person] = (debts[person] || 0) + val;
      } else if (t.type === "loan_payment") {
        bal.por_cobrar -= val;
        debts[person] = (debts[person] || 0) - val;
      } else if (t.type === "debt_in") {
        bal.por_cobrar -= val;
        debts[person] = (debts[person] || 0) - val;
      } else if (t.type === "debt_payment") {
        bal.por_cobrar += val;
        debts[person] = (debts[person] || 0) + val;
      }
    }
  });

  // Limpiar floats
  for (const k of Object.keys(bal)) {
    bal[k] = Math.round(bal[k] * 100) / 100;
  }
  for (const k of Object.keys(debts)) {
    debts[k] = Math.round(debts[k] * 100) / 100;
  }

  bal.total =
    bal.pichincha +
    bal.deuna +
    bal.guayaquil +
    bal.peigo +
    bal.produbanco +
    bal.binance +
    bal.ugly +
    bal.efectivo +
    bal.airtm +
    bal.morse +
    bal.hapi +
    bal.sp500 +
    bal.nasdaq +
    bal.por_cobrar;
  bal.total = Math.round(bal.total * 100) / 100;

  return { bal, debts };
}

async function migrateUser(email) {
  console.log(`\n==============================================`);
  console.log(`PROCESANDO USUARIO: ${email}`);
  console.log(`==============================================`);

  // 1. Obtener datos de Firestore
  const fbUsers = await fbAuth.listUsers();
  const fbUser = fbUsers.users.find((u) => u.email === email);
  if (!fbUser) {
    console.error(`Usuario ${email} no encontrado en Firebase!`);
    return;
  }

  const doc = await fbDb.collection('usuarios').doc(fbUser.uid).get();
  const fbData = doc.data() || {};
  const rawTxs = fbData.transactions || [];
  console.log(`Total transacciones en Firestore: ${rawTxs.length}`);

  // 2. Calcular saldos exactos
  const { bal, debts } = calculateBalances(rawTxs);
  console.log('Saldos calculados:', bal);
  console.log('Deudas calculadas:', debts);

  // 3. Obtener usuario de Supabase
  const { data: supaUsers, error: sUserErr } = await supabase.auth.admin.listUsers();
  if (sUserErr) throw sUserErr;
  const supaUser = supaUsers.users.find((u) => u.email === email);
  if (!supaUser) {
    console.error(`Usuario ${email} no encontrado en Supabase!`);
    return;
  }
  const userId = supaUser.id;

  // 4. Obtener o inicializar cuentas de Supabase
  let { data: supaAccounts } = await supabase.from('accounts').select('*').eq('user_id', userId);
  if (!supaAccounts || supaAccounts.length === 0) {
    console.log('Inicializando cuentas en Supabase...');
    await supabase.rpc('initialize_user_accounts', { p_user_id: userId });
    const res = await supabase.from('accounts').select('*').eq('user_id', userId);
    supaAccounts = res.data || [];
  }

  // Mapa de code -> account record
  const accMap = {};
  supaAccounts.forEach((a) => {
    accMap[a.code] = a;
  });

  // 5. Actualizar saldos de las cuentas
  for (const [code, calculatedBal] of Object.entries(bal)) {
    if (code === 'sp500' || code === 'nasdaq' || code === 'total') continue;

    const acc = accMap[code];
    if (acc) {
      const metadata = acc.metadata || {};
      if (code === 'hapi') {
        metadata.sp500_balance = bal.sp500;
        metadata.nasdaq_balance = bal.nasdaq;
        metadata.sp500_return = 0.7;
        metadata.nasdaq_return = 146.0;
      }
      await supabase
        .from('accounts')
        .update({
          current_balance: calculatedBal,
          initial_balance: 0,
          metadata,
        })
        .eq('id', acc.id);
      console.log(`✓ Cuenta "${acc.name}" actualizada a $${calculatedBal}`);
    }
  }

  // 6. Limpiar transacciones, deudas y pagos previos para re-sincronizar limpiamente
  console.log('Limpiando registros antiguos...');
  await supabase.from('debt_payments').delete().eq('user_id', userId);
  await supabase.from('debts').delete().eq('user_id', userId);
  await supabase.from('transactions').delete().eq('user_id', userId);

  // 7. Migrar Deudas y sus movimientos
  console.log('Migrando deudas y pagos...');
  const debtIdMap = {}; // person_name -> debt_id

  // Agrupar movimientos de cada persona
  const personMovements = {};
  rawTxs.forEach((t) => {
    if (["loan_out", "loan_payment", "debt_in", "debt_payment"].includes(t.type)) {
      const p = t.person?.trim() || 'Sin persona';
      if (!personMovements[p]) personMovements[p] = [];
      personMovements[p].push(t);
    }
  });

  for (const [personName, finalBal] of Object.entries(debts)) {
    const isSettled = finalBal <= 0;
    const movements = personMovements[personName] || [];

    // Calcular el total prestado inicial (suma de todos los cargos)
    let totalLoaned = 0;
    movements.forEach((m) => {
      if (m.type === 'loan_out' || m.type === 'debt_payment') {
        totalLoaned += Number(m.amount) || 0;
      }
    });
    totalLoaned = Math.round(totalLoaned * 100) / 100;
    if (totalLoaned === 0) totalLoaned = Math.max(finalBal, 0);

    const { data: insertedDebt, error: dErr } = await supabase
      .from('debts')
      .insert({
        user_id: userId,
        person_name: personName,
        type: 'me_deben',
        initial_amount: totalLoaned,
        current_balance: Math.max(0, finalBal),
        status: isSettled ? 'settled' : 'active',
      })
      .select()
      .single();

    if (dErr) {
      console.error(`Error creando deuda para ${personName}:`, dErr);
      continue;
    }

    debtIdMap[personName] = insertedDebt.id;

    // Insertar historial de pagos/cargos ordenados por fecha
    const sortedMovs = [...movements].sort((a, b) => new Date(a.date) - new Date(b.date) || (a.id || 0) - (b.id || 0));
    let runningBal = 0;
    const paymentRows = [];

    sortedMovs.forEach((m) => {
      const amt = Number(m.amount) || 0;
      const isCargo = m.type === 'loan_out' || m.type === 'debt_payment';
      if (isCargo) runningBal += amt;
      else runningBal -= amt;
      runningBal = Math.round(runningBal * 100) / 100;

      paymentRows.push({
        user_id: userId,
        debt_id: insertedDebt.id,
        amount: amt,
        type: isCargo ? 'cargo' : 'abono',
        note: m.desc || (isCargo ? 'Préstamo' : 'Abono'),
        date: m.date ? new Date(m.date).toISOString() : new Date().toISOString(),
        is_settlement: runningBal <= 0,
      });
    });

    if (paymentRows.length > 0) {
      await supabase.from('debt_payments').insert(paymentRows);
    }
    console.log(`✓ Deuda "${personName}": $${finalBal} (${isSettled ? 'saldado' : 'activo'}, ${paymentRows.length} movimientos)`);
  }

  // 8. Migrar Transacciones
  console.log('Migrando historial completo de transacciones...');
  const txRows = [];

  rawTxs.forEach((t) => {
    const accCode = ACCOUNT_CODE_MAP[t.account] || t.account?.toLowerCase();
    const acc = accMap[accCode] || accMap['efectivo'];
    const accId = acc ? acc.id : null;

    let txType = 'gasto';
    if (['ingreso', 'trade_profit', 'loan_payment'].includes(t.type)) {
      txType = 'ingreso';
    } else if (['transfer_in', 'transfer_out'].includes(t.type)) {
      if (t.account === 'SP500' || t.account === 'Nasdaq' || t.desc?.toLowerCase().includes('inversión') || t.desc?.toLowerCase().includes('compra s&p') || t.desc?.toLowerCase().includes('compra nasdaq')) {
        txType = 'inversion';
      } else {
        txType = 'transferencia';
      }
    } else if (['gasto', 'trade_loss', 'loan_out', 'debt_payment'].includes(t.type)) {
      txType = 'gasto';
    }

    const metadata = {};
    if (t.shares) metadata.shares = t.shares;
    if (t.sharePrice) metadata.share_price = t.sharePrice;
    if (t.commission) metadata.commission = t.commission;
    if (t.person) metadata.person = t.person;
    if (t.account === 'SP500' || t.desc?.toLowerCase().includes('s&p 500')) metadata.investment_asset = 'sp500';
    if (t.account === 'Nasdaq' || t.desc?.toLowerCase().includes('nasdaq')) metadata.investment_asset = 'nasdaq';

    let category = 'General';
    if (t.type === 'loan_out') category = 'Préstamo realizado';
    else if (t.type === 'loan_payment') category = 'Cobro de préstamo';
    else if (t.type === 'trade_profit' || t.type === 'trade_loss') category = 'Trading Cripto';
    else if (txType === 'inversion') category = 'Inversión Broker';
    else if (txType === 'transferencia') category = 'Transferencia';
    else if (t.desc) category = t.desc.slice(0, 30);

    let dateIso = new Date().toISOString();
    if (t.date) {
      const d = new Date(t.date);
      if (!isNaN(d.getTime())) dateIso = d.toISOString();
    }

    txRows.push({
      user_id: userId,
      account_id: accId,
      destination_account_id: null,
      type: txType,
      amount: Number(t.amount) || 0,
      category,
      note: t.desc || '',
      date: dateIso,
      metadata,
    });
  });

  // Insertar transacciones en lotes de 100
  for (let i = 0; i < txRows.length; i += 100) {
    const chunk = txRows.slice(i, i + 100);
    const { error: tErr } = await supabase.from('transactions').insert(chunk);
    if (tErr) console.error('Error insertando lote de transacciones:', tErr);
  }

  console.log(`✓ ${txRows.length} transacciones migradas con éxito.`);
  console.log(`PATRIMONIO NETO CALCULADO FINAL: $${bal.total}`);
}

async function main() {
  await migrateUser('cesarinduq@hotmail.com');
  await migrateUser('charlz13db@hotmail.com');
  console.log('\n==============================================');
  console.log('¡SINCRONIZACIÓN Y REPARACIÓN COMPLETADA AL 100%!');
  console.log('==============================================\n');
}

main();
