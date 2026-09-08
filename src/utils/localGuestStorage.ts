import { Account, Transaction, Debt, DebtPayment, InvestmentSettings } from '../types/database';
import { supabase } from '../config/supabase';

const GUEST_ACCOUNTS_KEY = 'finanzas_guest_accounts_v2';
const GUEST_TX_KEY = 'finanzas_guest_transactions_v2';
const GUEST_DEBTS_KEY = 'finanzas_guest_debts_v2';
const GUEST_PAYMENTS_KEY = 'finanzas_guest_payments_v2';
const GUEST_SETTINGS_KEY = 'finanzas_guest_settings_v2';

export const DEFAULT_BLANK_ACCOUNTS: Omit<Account, 'id' | 'user_id' | 'created_at' | 'updated_at'>[] = [
  { name: 'Banco Pichincha', code: 'pichincha', type: 'banco', color: '#f59e0b', icon_url: '/assets/pichincha.svg', initial_balance: 0, current_balance: 0, display_order: 1, is_archived: false },
  { name: 'Deuna!', code: 'deuna', type: 'billetera', color: '#10b981', icon_url: '/assets/deuna.svg', initial_balance: 0, current_balance: 0, display_order: 2, is_archived: false },
  { name: 'Banco Guayaquil', code: 'guayaquil', type: 'banco', color: '#e11d48', icon_url: '/assets/guayaquil.png', initial_balance: 0, current_balance: 0, display_order: 3, is_archived: false },
  { name: 'Peigo', code: 'peigo', type: 'billetera', color: '#06b6d4', icon_url: '/assets/peigo.svg', initial_balance: 0, current_balance: 0, display_order: 4, is_archived: false },
  { name: 'Produbanco', code: 'produbanco', type: 'banco', color: '#0284c7', icon_url: '/assets/produbanco.svg', initial_balance: 0, current_balance: 0, display_order: 5, is_archived: false },
  { name: 'Binance', code: 'binance', type: 'cripto', color: '#eab308', icon_url: '/assets/binance.svg', initial_balance: 0, current_balance: 0, display_order: 6, is_archived: false },
  { name: 'Ugly Cash', code: 'ugly', type: 'billetera', color: '#38bdf8', icon_url: '/assets/ugly.svg', initial_balance: 0, current_balance: 0, display_order: 7, is_archived: false },
  { name: 'Airtm', code: 'airtm', type: 'billetera', color: '#2563eb', icon_url: '/assets/airtm.png', initial_balance: 0, current_balance: 0, display_order: 8, is_archived: false },
  { name: 'Efectivo', code: 'efectivo', type: 'efectivo', color: '#16a34a', icon_url: '/assets/efectivo.png', initial_balance: 0, current_balance: 0, display_order: 9, is_archived: false },
  { name: 'Morse', code: 'morse', type: 'billetera', color: '#f97316', icon_url: '/assets/morse.webp', initial_balance: 0, current_balance: 0, display_order: 10, is_archived: false },
  { 
    name: 'Hapi (Broker)', 
    code: 'hapi', 
    type: 'broker', 
    color: '#8b5cf6', 
    icon_url: '/assets/hapi.svg', 
    initial_balance: 0, 
    current_balance: 0, 
    display_order: 11, 
    is_archived: false,
    metadata: { sp500_balance: 0, nasdaq_balance: 0, sp500_return: 0, nasdaq_return: 0 }
  },
  { name: 'Por Cobrar', code: 'por_cobrar', type: 'deuda', color: '#a855f7', icon_url: null, initial_balance: 0, current_balance: 0, display_order: 12, is_archived: false },
];

export function getGuestAccounts(): Account[] {
  const saved = localStorage.getItem(GUEST_ACCOUNTS_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch {}
  }
  const initial = DEFAULT_BLANK_ACCOUNTS.map((acc, index) => ({
    ...acc,
    id: `guest-acc-${index + 1}`,
    user_id: 'guest',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
  localStorage.setItem(GUEST_ACCOUNTS_KEY, JSON.stringify(initial));
  return initial;
}

export function saveGuestAccounts(accounts: Account[]) {
  localStorage.setItem(GUEST_ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function getGuestTransactions(): Transaction[] {
  const saved = localStorage.getItem(GUEST_TX_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch {}
  }
  return [];
}

export function saveGuestTransactions(txs: Transaction[]) {
  localStorage.setItem(GUEST_TX_KEY, JSON.stringify(txs));
}

export function getGuestDebts(): Debt[] {
  const saved = localStorage.getItem(GUEST_DEBTS_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch {}
  }
  return [];
}

export function saveGuestDebts(debts: Debt[]) {
  localStorage.setItem(GUEST_DEBTS_KEY, JSON.stringify(debts));
}

export function getGuestDebtPayments(): DebtPayment[] {
  const saved = localStorage.getItem(GUEST_PAYMENTS_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch {}
  }
  return [];
}

export function saveGuestDebtPayments(payments: DebtPayment[]) {
  localStorage.setItem(GUEST_PAYMENTS_KEY, JSON.stringify(payments));
}

export function getGuestSettings(): InvestmentSettings {
  const saved = localStorage.getItem(GUEST_SETTINGS_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch {}
  }
  return {
    id: 'guest-settings',
    user_id: 'guest',
    sp500_annual_rate: 10.0,
    nasdaq_annual_rate: 14.0,
    monthly_contribution: 300.0,
    years: 20,
    safe_withdrawal_rate: 4.0,
    updated_at: new Date().toISOString(),
  };
}

export function saveGuestSettings(settings: InvestmentSettings) {
  localStorage.setItem(GUEST_SETTINGS_KEY, JSON.stringify(settings));
}

export function hasLocalGuestData(): boolean {
  const txs = getGuestTransactions();
  const debts = getGuestDebts();
  return txs.length > 0 || debts.length > 0;
}

export function clearGuestData() {
  localStorage.removeItem(GUEST_ACCOUNTS_KEY);
  localStorage.removeItem(GUEST_TX_KEY);
  localStorage.removeItem(GUEST_DEBTS_KEY);
  localStorage.removeItem(GUEST_PAYMENTS_KEY);
  localStorage.removeItem(GUEST_SETTINGS_KEY);
  // Limpiar también posibles claves viejas
  localStorage.removeItem('finanzas_accounts');
  localStorage.removeItem('finanzas_transactions');
  localStorage.removeItem('finanzas_debts');
  localStorage.removeItem('finanzas_debt_payments');
}

/**
 * Migra los datos locales a la cuenta recién creada en Supabase
 */
export async function migrateLocalGuestDataToSupabase(userId: string): Promise<{ success: boolean; txCount: number; debtCount: number }> {
  if (!supabase) return { success: false, txCount: 0, debtCount: 0 };

  const guestAccounts = getGuestAccounts();
  const guestTxs = getGuestTransactions();
  const guestDebts = getGuestDebts();
  const guestPayments = getGuestDebtPayments();

  if (guestTxs.length === 0 && guestDebts.length === 0) {
    clearGuestData();
    return { success: true, txCount: 0, debtCount: 0 };
  }

  // 1. Obtener cuentas de Supabase
  const { data: cloudAccounts } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId);

  const accounts = cloudAccounts || [];

  // 2. Migrar deudas
  let debtCount = 0;
  const debtIdMap = new Map<string, string>(); // guestId -> cloudId

  for (const d of guestDebts) {
    const { data: newDebt } = await supabase
      .from('debts')
      .insert({
        user_id: userId,
        person_name: d.person_name,
        type: d.type,
        initial_amount: d.initial_amount,
        current_balance: d.current_balance,
        status: d.status,
      })
      .select()
      .single();

    if (newDebt) {
      debtIdMap.set(d.id, newDebt.id);
      debtCount++;
    }
  }

  // 3. Migrar pagos de deudas
  for (const p of guestPayments) {
    const targetDebtId = debtIdMap.get(p.debt_id);
    if (targetDebtId) {
      await supabase.from('debt_payments').insert({
        user_id: userId,
        debt_id: targetDebtId,
        amount: p.amount,
        type: p.type,
        note: p.note,
        date: p.date,
        is_settlement: p.is_settlement,
      });
    }
  }

  // 4. Migrar transacciones
  let txCount = 0;
  for (const t of guestTxs) {
    const guestAcc = guestAccounts.find((a) => a.id === t.account_id);
    const matchedCloudAcc = accounts.find((a) => a.code === guestAcc?.code) || accounts[0];
    
    let destCloudAccId = null;
    if (t.destination_account_id) {
      const guestDest = guestAccounts.find((a) => a.id === t.destination_account_id);
      const matchedDest = accounts.find((a) => a.code === guestDest?.code);
      destCloudAccId = matchedDest?.id || null;
    }

    await supabase.from('transactions').insert({
      user_id: userId,
      account_id: matchedCloudAcc?.id || null,
      destination_account_id: destCloudAccId,
      type: t.type,
      amount: t.amount,
      category: t.category,
      note: t.note,
      date: t.date,
      metadata: t.metadata || {},
    });
    txCount++;
  }

  // Limpiar almacenamiento local una vez migrado
  clearGuestData();

  return { success: true, txCount, debtCount };
}
