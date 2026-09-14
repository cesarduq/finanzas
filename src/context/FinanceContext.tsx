import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../config/supabase';
import { useAuth } from './AuthContext';
import { Account, Transaction, TransactionType, Debt, DebtPayment, InvestmentSettings } from '../types/database';
import {
  getGuestAccounts,
  saveGuestAccounts,
  getGuestTransactions,
  saveGuestTransactions,
  getGuestDebts,
  saveGuestDebts,
  getGuestDebtPayments,
  saveGuestDebtPayments,
  getGuestSettings,
  saveGuestSettings,
} from '../utils/localGuestStorage';

interface FinanceContextType {
  accounts: Account[];
  transactions: Transaction[];
  debts: Debt[];
  debtPayments: DebtPayment[];
  investmentSettings: InvestmentSettings;
  netWorth: number;
  totalInvestedCapital: number;
  loading: boolean;
  addTransaction: (tx: {
    account_id?: string | null;
    destination_account_id?: string | null;
    type: TransactionType;
    amount: number;
    category?: string;
    note?: string;
    date?: string;
    person?: string;
    commission?: number;
    share_price?: number;
    shares?: number;
    investment_asset?: 'sp500' | 'nasdaq' | string;
  }) => Promise<{ error: string | null }>;
  addDebtPayment: (payment: {
    debt_id: string;
    amount: number;
    type: 'cargo' | 'abono';
    note?: string;
    date?: string;
    is_settlement?: boolean;
  }) => Promise<{ error: string | null }>;
  createDebt: (person_name: string, type: 'me_deben' | 'debo', initial_amount: number, note?: string) => Promise<{ error: string | null }>;
  deleteTransaction: (id: string) => Promise<{ error: string | null }>;
  updateTransaction: (
    id: string,
    updatedData: {
      account_id?: string | null;
      destination_account_id?: string | null;
      type: TransactionType;
      amount: number;
      category?: string;
      note?: string;
      date?: string;
      person?: string;
      commission?: number;
      share_price?: number;
      shares?: number;
      investment_asset?: 'sp500' | 'nasdaq' | string;
    }
  ) => Promise<{ error: string | null }>;
  updateInvestmentSettings: (settings: Partial<InvestmentSettings>) => Promise<void>;
  updateAccountBalance: (accountId: string, newBalance: number) => Promise<void>;
  updateAccountVisibility: (accountId: string, isArchived: boolean) => Promise<void>;
  updateMultipleAccountsVisibility: (visibilityMap: Record<string, boolean>) => Promise<void>;
  refreshData: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [debtPayments, setDebtPayments] = useState<DebtPayment[]>([]);
  const [investmentSettings, setInvestmentSettings] = useState<InvestmentSettings>({
    id: 'default',
    user_id: user?.id || 'guest',
    sp500_annual_rate: 10.0,
    nasdaq_annual_rate: 14.0,
    monthly_contribution: 300.0,
    years: 20,
    safe_withdrawal_rate: 4.0,
    updated_at: new Date().toISOString(),
  });
  const [loading, setLoading] = useState(true);

  // Cargar datos
  const loadData = useCallback(async () => {
    setLoading(true);

    // MODO LOCAL / INVITADO (SIN SESIÓN)
    if (!isSupabaseConfigured || !supabase || !user) {
      const gAccounts = getGuestAccounts();
      const gTxs = getGuestTransactions();
      const gDebts = getGuestDebts();
      const gPayments = getGuestDebtPayments();
      const gSettings = getGuestSettings();

      setAccounts(gAccounts);
      setTransactions(gTxs);
      setDebts(gDebts);
      setDebtPayments(gPayments);
      setInvestmentSettings(gSettings);
      setLoading(false);
      return;
    }

    // MODO NUBE (CON SESIÓN DE SUPABASE)
    try {
      const [accRes, txRes, debtsRes, payRes, setRes] = await Promise.all([
        supabase.from('accounts').select('*').eq('user_id', user.id).order('display_order'),
        supabase.from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('debts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('debt_payments').select('*').eq('user_id', user.id).order('date', { ascending: false }),
        supabase.from('investment_settings').select('*').eq('user_id', user.id).maybeSingle(),
      ]);

      if (accRes.data) setAccounts(accRes.data);
      if (txRes.data) setTransactions(txRes.data);
      if (debtsRes.data) setDebts(debtsRes.data);
      if (payRes.data) setDebtPayments(payRes.data);
      if (setRes.data) setInvestmentSettings(setRes.data);
    } catch (error) {
      console.error('Error cargando datos de Supabase:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Suscripción Realtime (WebSockets optimizados) por canal privado de usuario
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !user) return;

    // Escuchar cambios en cuentas, transacciones, deudas y pagos en tiempo real
    const channel = supabase
      .channel(`realtime-user-finances-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'accounts', filter: `user_id=eq.${user.id}` },
        () => loadData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` },
        () => loadData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'debts', filter: `user_id=eq.${user.id}` },
        () => loadData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'debt_payments', filter: `user_id=eq.${user.id}` },
        () => loadData()
      )
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [user, loadData]);

  // Cálculo reactivo de Patrimonio Neto Total
  const netWorth = useMemo(() => {
    const netDebtBalance = debts
      .filter((d) => d.status === 'active')
      .reduce((sum, d) => {
        const bal = Number(d.current_balance) || 0;
        return d.type === 'me_deben' ? sum + bal : sum - bal;
      }, 0);

    return accounts.reduce((acc, account) => {
      if (account.code === 'por_cobrar') {
        return acc + netDebtBalance;
      }
      let val = Number(account.current_balance) || 0;
      if (account.code === 'hapi' && account.metadata) {
        const sp = Number(account.metadata.sp500_balance) || 0;
        const nas = Number(account.metadata.nasdaq_balance) || 0;
        val += sp + nas;
      }
      return acc + val;
    }, 0);
  }, [accounts, debts]);

  // Capital total depositado en inversiones detectado de la base
  const totalInvestedCapital = useMemo(() => {
    const hapiAccount = accounts.find((a) => a.code === 'hapi');
    if (hapiAccount?.metadata) {
      const sp = Number(hapiAccount.metadata.sp500_balance) || 0;
      const nas = Number(hapiAccount.metadata.nasdaq_balance) || 0;
      if (sp > 0 || nas > 0) return sp + nas;
    }
    return 1219.19;
  }, [accounts]);

  // Transacción multi-acción
  const addTransaction = async (txData: {
    account_id?: string | null;
    destination_account_id?: string | null;
    type: TransactionType;
    amount: number;
    category?: string;
    note?: string;
    date?: string;
    person?: string;
    commission?: number;
    share_price?: number;
    shares?: number;
    investment_asset?: 'sp500' | 'nasdaq' | string;
  }) => {
    const amount = Number(txData.amount);
    if (isNaN(amount) || amount <= 0) {
      return { error: 'El monto debe ser mayor a 0' };
    }

    const commission = Number(txData.commission) || 0;
    const netInvested = Math.max(0, amount - commission);
    const dateIso = txData.date ? (txData.date.includes('T') ? txData.date : new Date(`${txData.date}T12:00:00`).toISOString()) : new Date().toISOString();

    const metadata: Record<string, any> = {};
    if (txData.investment_asset) metadata.investment_asset = txData.investment_asset;
    if (txData.commission) metadata.commission = commission;
    if (txData.share_price) metadata.share_price = txData.share_price;
    if (txData.shares) metadata.shares = txData.shares;
    if (txData.person) metadata.person = txData.person.trim();

    // Determinar categoría por defecto amigable
    let category = txData.category || 'General';
    if (txData.type === 'loan_out') category = 'Préstamo realizado';
    else if (txData.type === 'loan_payment') category = 'Cobro de préstamo';
    else if (txData.type === 'debt_in') category = 'Deuda asumida';
    else if (txData.type === 'debt_service_in') category = 'Servicio / Daño por cobrar';
    else if (txData.type === 'trade_profit') category = 'Trading: Ganancia';
    else if (txData.type === 'trade_loss') category = 'Trading: Pérdida';
    else if (txData.type === 'transfer' || txData.type === 'transferencia') category = 'Transferencia';
    else if (txData.type === 'invest' || txData.type === 'inversion') category = 'Inversión Broker';

    // 1. Clonar cuentas para aplicar efectos
    let updatedAccounts = [...accounts];
    let updatedDebts = [...debts];
    let updatedPayments = [...debtPayments];

    // EFECTOS EN CUENTAS:
    // a. Ingreso / Trade Profit
    if (txData.type === 'ingreso' || txData.type === 'trade_profit') {
      updatedAccounts = updatedAccounts.map((acc) => {
        if (acc.id === txData.account_id) {
          const bal = (Number(acc.current_balance) || 0) + amount;
          return { ...acc, current_balance: Math.round(bal * 100) / 100 };
        }
        return acc;
      });
    }

    // b. Gasto / Trade Loss
    if (txData.type === 'gasto' || txData.type === 'trade_loss') {
      updatedAccounts = updatedAccounts.map((acc) => {
        if (acc.id === txData.account_id) {
          const bal = (Number(acc.current_balance) || 0) - amount;
          return { ...acc, current_balance: Math.round(bal * 100) / 100 };
        }
        return acc;
      });
    }

    // c. Transferencia entre cuentas
    if (txData.type === 'transfer' || txData.type === 'transferencia') {
      updatedAccounts = updatedAccounts.map((acc) => {
        if (acc.id === txData.account_id) {
          const bal = (Number(acc.current_balance) || 0) - amount;
          return { ...acc, current_balance: Math.round(bal * 100) / 100 };
        }
        if (acc.id === txData.destination_account_id) {
          const bal = (Number(acc.current_balance) || 0) + (amount - commission);
          return { ...acc, current_balance: Math.round(bal * 100) / 100 };
        }
        return acc;
      });
    }

    // d. Invertir en Broker
    if (txData.type === 'invest' || txData.type === 'inversion') {
      const asset = txData.investment_asset?.toLowerCase() === 'nasdaq' ? 'nasdaq' : 'sp500';
      updatedAccounts = updatedAccounts.map((acc) => {
        // Restar de cuenta origen (broker cash o banco)
        if (acc.id === txData.account_id) {
          const bal = (Number(acc.current_balance) || 0) - amount;
          return { ...acc, current_balance: Math.round(bal * 100) / 100 };
        }
        // Sumar al activo en Hapi
        if (acc.code === 'hapi') {
          const meta = { ...(acc.metadata || {}) };
          if (asset === 'nasdaq') {
            meta.nasdaq_balance = Math.round(((Number(meta.nasdaq_balance) || 0) + netInvested) * 100) / 100;
          } else {
            meta.sp500_balance = Math.round(((Number(meta.sp500_balance) || 0) + netInvested) * 100) / 100;
          }
          return { ...acc, metadata: meta };
        }
        return acc;
      });
    }

    // e. Prestar Dinero (Salida de Banco)
    if (txData.type === 'loan_out') {
      const personName = (txData.person || 'Sin persona').trim();
      updatedAccounts = updatedAccounts.map((acc) => {
        if (acc.id === txData.account_id) {
          const bal = (Number(acc.current_balance) || 0) - amount;
          return { ...acc, current_balance: Math.round(bal * 100) / 100 };
        }
        if (acc.code === 'por_cobrar') {
          const bal = (Number(acc.current_balance) || 0) + amount;
          return { ...acc, current_balance: Math.round(bal * 100) / 100 };
        }
        return acc;
      });

      // Crear o actualizar Deuda
      const existingDebt = updatedDebts.find((d) => d.person_name.toLowerCase() === personName.toLowerCase() && d.type === 'me_deben');
      let targetDebtId = existingDebt?.id;
      if (existingDebt) {
        const newDebtBal = Math.round(((Number(existingDebt.current_balance) || 0) + amount) * 100) / 100;
        updatedDebts = updatedDebts.map((d) => (d.id === existingDebt.id ? { ...d, current_balance: newDebtBal, status: 'active' as const } : d));
      } else {
        targetDebtId = `debt-${Date.now()}`;
        updatedDebts.push({
          id: targetDebtId,
          user_id: user?.id || 'guest',
          person_name: personName,
          type: 'me_deben',
          initial_amount: amount,
          current_balance: amount,
          status: 'active',
          created_at: dateIso,
          updated_at: dateIso,
        });
      }

      if (targetDebtId) {
        updatedPayments.unshift({
          id: `pay-${Date.now()}`,
          user_id: user?.id || 'guest',
          debt_id: targetDebtId,
          amount,
          type: 'cargo',
          note: txData.note || 'Préstamo realizado',
          date: dateIso,
          is_settlement: false,
          created_at: dateIso,
        });
      }
    }

    // f. Cobrar Préstamo / Deuda (Entrada a Banco)
    if (txData.type === 'loan_payment') {
      const personName = (txData.person || 'Sin persona').trim();
      updatedAccounts = updatedAccounts.map((acc) => {
        if (acc.id === txData.account_id) {
          const bal = (Number(acc.current_balance) || 0) + amount;
          return { ...acc, current_balance: Math.round(bal * 100) / 100 };
        }
        if (acc.code === 'por_cobrar') {
          const bal = (Number(acc.current_balance) || 0) - amount;
          return { ...acc, current_balance: Math.round(bal * 100) / 100 };
        }
        return acc;
      });

      const existingDebt = updatedDebts.find((d) => d.person_name.toLowerCase() === personName.toLowerCase() && d.type === 'me_deben');
      if (existingDebt) {
        const newDebtBal = Math.round(((Number(existingDebt.current_balance) || 0) - amount) * 100) / 100;
        const isSettled = Math.abs(newDebtBal) < 0.005;
        updatedDebts = updatedDebts.map((d) => (d.id === existingDebt.id ? { ...d, current_balance: newDebtBal, status: isSettled ? ('settled' as const) : ('active' as const) } : d));

        updatedPayments.unshift({
          id: `pay-${Date.now()}`,
          user_id: user?.id || 'guest',
          debt_id: existingDebt.id,
          amount,
          type: 'abono',
          note: txData.note || 'Cobro de préstamo',
          date: dateIso,
          is_settlement: isSettled,
          created_at: dateIso,
        });
      }
    }

    // g. Asumir Deuda (Yo debo - Sin movimiento bancario)
    if (txData.type === 'debt_in') {
      const personName = (txData.person || 'Sin persona').trim();
      const existingDebt = updatedDebts.find((d) => d.person_name.toLowerCase() === personName.toLowerCase() && d.type === 'debo');
      let targetDebtId = existingDebt?.id;
      if (existingDebt) {
        const newDebtBal = Math.round(((Number(existingDebt.current_balance) || 0) + amount) * 100) / 100;
        updatedDebts = updatedDebts.map((d) => (d.id === existingDebt.id ? { ...d, current_balance: newDebtBal, status: 'active' as const } : d));
      } else {
        targetDebtId = `debt-${Date.now()}`;
        updatedDebts.push({
          id: targetDebtId,
          user_id: user?.id || 'guest',
          person_name: personName,
          type: 'debo',
          initial_amount: amount,
          current_balance: amount,
          status: 'active',
          created_at: dateIso,
          updated_at: dateIso,
        });
      }

      if (targetDebtId) {
        updatedPayments.unshift({
          id: `pay-${Date.now()}`,
          user_id: user?.id || 'guest',
          debt_id: targetDebtId,
          amount,
          type: 'cargo',
          note: txData.note || 'Deuda asumida',
          date: dateIso,
          is_settlement: false,
          created_at: dateIso,
        });
      }
    }

    // h. Me deben dinero por servicio o daño (Sin banco)
    if (txData.type === 'debt_service_in') {
      const personName = (txData.person || 'Sin persona').trim();
      updatedAccounts = updatedAccounts.map((acc) => {
        if (acc.code === 'por_cobrar') {
          const bal = (Number(acc.current_balance) || 0) + amount;
          return { ...acc, current_balance: Math.round(bal * 100) / 100 };
        }
        return acc;
      });

      const existingDebt = updatedDebts.find((d) => d.person_name.toLowerCase() === personName.toLowerCase() && d.type === 'me_deben');
      let targetDebtId = existingDebt?.id;
      if (existingDebt) {
        const newDebtBal = Math.round(((Number(existingDebt.current_balance) || 0) + amount) * 100) / 100;
        updatedDebts = updatedDebts.map((d) => (d.id === existingDebt.id ? { ...d, current_balance: newDebtBal, status: 'active' as const } : d));
      } else {
        targetDebtId = `debt-${Date.now()}`;
        updatedDebts.push({
          id: targetDebtId,
          user_id: user?.id || 'guest',
          person_name: personName,
          type: 'me_deben',
          initial_amount: amount,
          current_balance: amount,
          status: 'active',
          created_at: dateIso,
          updated_at: dateIso,
        });
      }

      if (targetDebtId) {
        updatedPayments.unshift({
          id: `pay-${Date.now()}`,
          user_id: user?.id || 'guest',
          debt_id: targetDebtId,
          amount,
          type: 'cargo',
          note: txData.note || 'Servicio / Daño por cobrar',
          date: dateIso,
          is_settlement: false,
          created_at: dateIso,
        });
      }
    }

    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      user_id: user?.id || 'guest',
      account_id: txData.account_id || null,
      destination_account_id: txData.destination_account_id || null,
      type: txData.type,
      amount,
      category,
      note: txData.note || '',
      date: dateIso,
      metadata,
      created_at: new Date().toISOString(),
    };

    const updatedTxs = [newTx, ...transactions];

    setAccounts(updatedAccounts);
    setTransactions(updatedTxs);
    setDebts(updatedDebts);
    setDebtPayments(updatedPayments);

    // MODO INVITADO
    if (!isSupabaseConfigured || !supabase || !user) {
      saveGuestAccounts(updatedAccounts);
      saveGuestTransactions(updatedTxs);
      saveGuestDebts(updatedDebts);
      saveGuestDebtPayments(updatedPayments);
      return { error: null };
    }

    try {
      // 1. Guardar transacción con retorno del ID real de Supabase
      const { data: insertedTx, error: txErr } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          account_id: txData.account_id || null,
          destination_account_id: txData.destination_account_id || null,
          type: txData.type,
          amount,
          category,
          note: txData.note || '',
          date: dateIso,
          metadata,
        })
        .select()
        .single();

      if (txErr) throw txErr;

      // Actualizar el ID provisional de la transacción local con el ID real de Supabase
      if (insertedTx?.id) {
        setTransactions((prev) => prev.map((t) => (t.id === newTx.id ? { ...t, id: insertedTx.id } : t)));
      }

      // 2. Actualizar cuentas afectadas en Supabase
      if (txData.account_id) {
        const srcAcc = updatedAccounts.find((a) => a.id === txData.account_id);
        if (srcAcc) {
          await supabase.from('accounts').update({ current_balance: srcAcc.current_balance, metadata: srcAcc.metadata }).eq('id', srcAcc.id);
        }
      }
      if (txData.destination_account_id) {
        const destAcc = updatedAccounts.find((a) => a.id === txData.destination_account_id);
        if (destAcc) {
          await supabase.from('accounts').update({ current_balance: destAcc.current_balance }).eq('id', destAcc.id);
        }
      }
      const hapiAcc = updatedAccounts.find((a) => a.code === 'hapi');
      if (hapiAcc && (txData.type === 'invest' || txData.type === 'inversion')) {
        await supabase.from('accounts').update({ metadata: hapiAcc.metadata }).eq('id', hapiAcc.id);
      }
      const porCobrarAcc = updatedAccounts.find((a) => a.code === 'por_cobrar');
      if (porCobrarAcc && ['loan_out', 'loan_payment', 'debt_service_in'].includes(txData.type)) {
        await supabase.from('accounts').update({ current_balance: porCobrarAcc.current_balance }).eq('id', porCobrarAcc.id);
      }

      // 3. Si involucró deudas, sincronizar en Supabase
      if (['loan_out', 'loan_payment', 'debt_in', 'debt_service_in'].includes(txData.type) && txData.person) {
        const personName = txData.person.trim();
        const debtType = txData.type === 'debt_in' ? 'debo' : 'me_deben';
        const { data: existingCloudDebt } = await supabase
          .from('debts')
          .select('*')
          .eq('user_id', user.id)
          .eq('person_name', personName)
          .eq('type', debtType)
          .maybeSingle();

        let cloudDebtId = existingCloudDebt?.id;
        const isCargo = ['loan_out', 'debt_in', 'debt_service_in'].includes(txData.type);
        const newBalance = existingCloudDebt
          ? isCargo
            ? Number(existingCloudDebt.current_balance) + amount
            : Number(existingCloudDebt.current_balance) - amount
          : amount;

        const isSettled = Math.abs(newBalance) < 0.005;

        if (existingCloudDebt) {
          await supabase
            .from('debts')
            .update({
              current_balance: Math.round(newBalance * 100) / 100,
              status: isSettled ? 'settled' : 'active',
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingCloudDebt.id);
        } else {
          const { data: newCloudDebt } = await supabase
            .from('debts')
            .insert({
              user_id: user.id,
              person_name: personName,
              type: debtType,
              initial_amount: amount,
              current_balance: amount,
              status: 'active',
            })
            .select()
            .single();
          if (newCloudDebt) cloudDebtId = newCloudDebt.id;
        }

        if (cloudDebtId) {
          await supabase.from('debt_payments').insert({
            user_id: user.id,
            debt_id: cloudDebtId,
            amount,
            type: isCargo ? 'cargo' : 'abono',
            note: txData.note || (isCargo ? 'Préstamo / Cargo' : 'Cobro / Abono'),
            date: dateIso,
            is_settlement: isSettled,
          });
        }
      }

      return { error: null };
    } catch (err: any) {
      console.error('Error guardando transacción:', err);
      return { error: err?.message || 'Error guardando transacción' };
    }
  };

  // -------------------------------------------------------------
  // ELIMINAR TRANSACCIÓN (Con reversión total de saldos)
  // -------------------------------------------------------------
  const deleteTransaction = async (id: string): Promise<{ error: string | null }> => {
    const targetTx = transactions.find((t) => t.id === id);
    if (!targetTx) return { error: 'Transacción no encontrada' };

    let updatedAccounts = [...accounts];
    let updatedDebts = [...debts];
    const amount = Number(targetTx.amount) || 0;
    const commission = Number(targetTx.metadata?.commission) || 0;
    const netInvested = Math.max(0, amount - commission);

    // 1. Revertir saldo de cuentas según el tipo
    // a. Ingreso / Trade Profit / Transfer In: restamos a la cuenta origen
    if (targetTx.type === 'ingreso' || targetTx.type === 'trade_profit' || targetTx.type === 'transfer_in') {
      updatedAccounts = updatedAccounts.map((acc) => {
        if (acc.id === targetTx.account_id) {
          const bal = (Number(acc.current_balance) || 0) - amount;
          return { ...acc, current_balance: Math.round(bal * 100) / 100 };
        }
        return acc;
      });
    }

    // b. Gasto / Trade Loss / Transfer Out / Debt Payment: devolvemos a la cuenta origen
    if (targetTx.type === 'gasto' || targetTx.type === 'trade_loss' || targetTx.type === 'transfer_out' || targetTx.type === 'debt_payment') {
      updatedAccounts = updatedAccounts.map((acc) => {
        if (acc.id === targetTx.account_id) {
          const bal = (Number(acc.current_balance) || 0) + amount;
          return { ...acc, current_balance: Math.round(bal * 100) / 100 };
        }
        return acc;
      });
    }

    // c. Transferencia: devolvemos a origen (amount) y restamos de destino (amount - commission)
    if (targetTx.type === 'transfer' || targetTx.type === 'transferencia') {
      updatedAccounts = updatedAccounts.map((acc) => {
        if (acc.id === targetTx.account_id) {
          const bal = (Number(acc.current_balance) || 0) + amount;
          return { ...acc, current_balance: Math.round(bal * 100) / 100 };
        }
        if (acc.id === targetTx.destination_account_id) {
          const bal = (Number(acc.current_balance) || 0) - (amount - commission);
          return { ...acc, current_balance: Math.round(bal * 100) / 100 };
        }
        return acc;
      });
    }

    // d. Invertir en Broker: devolvemos a origen y restamos de Hapi
    if (targetTx.type === 'invest' || targetTx.type === 'inversion') {
      const asset = targetTx.metadata?.investment_asset?.toLowerCase() === 'nasdaq' ? 'nasdaq' : 'sp500';
      updatedAccounts = updatedAccounts.map((acc) => {
        if (acc.id === targetTx.account_id) {
          const bal = (Number(acc.current_balance) || 0) + amount;
          return { ...acc, current_balance: Math.round(bal * 100) / 100 };
        }
        if (acc.code === 'hapi') {
          const meta = { ...(acc.metadata || {}) };
          if (asset === 'nasdaq') {
            meta.nasdaq_balance = Math.max(0, Math.round(((Number(meta.nasdaq_balance) || 0) - netInvested) * 100) / 100);
          } else {
            meta.sp500_balance = Math.max(0, Math.round(((Number(meta.sp500_balance) || 0) - netInvested) * 100) / 100);
          }
          return { ...acc, metadata: meta };
        }
        return acc;
      });
    }

    // e. Prestar Dinero (loan_out): devolvemos al banco, restamos de por_cobrar y reducimos deuda
    if (targetTx.type === 'loan_out') {
      const personName = (targetTx.metadata?.person || '').trim();
      updatedAccounts = updatedAccounts.map((acc) => {
        if (acc.id === targetTx.account_id) {
          const bal = (Number(acc.current_balance) || 0) + amount;
          return { ...acc, current_balance: Math.round(bal * 100) / 100 };
        }
        if (acc.code === 'por_cobrar') {
          const bal = (Number(acc.current_balance) || 0) - amount;
          return { ...acc, current_balance: Math.round(bal * 100) / 100 };
        }
        return acc;
      });

      if (personName) {
        const existingDebt = updatedDebts.find((d) => d.person_name.toLowerCase() === personName.toLowerCase() && d.type === 'me_deben');
        if (existingDebt) {
          const newDebtBal = Math.round(((Number(existingDebt.current_balance) || 0) - amount) * 100) / 100;
          const isSettled = Math.abs(newDebtBal) < 0.005;
          updatedDebts = updatedDebts.map((d) =>
            d.id === existingDebt.id ? { ...d, current_balance: newDebtBal, status: isSettled ? ('settled' as const) : ('active' as const) } : d
          );
        }
      }
    }

    // f. Cobrar Préstamo (loan_payment): restamos del banco, sumamos a por_cobrar y reabrimos deuda
    if (targetTx.type === 'loan_payment') {
      const personName = (targetTx.metadata?.person || '').trim();
      updatedAccounts = updatedAccounts.map((acc) => {
        if (acc.id === targetTx.account_id) {
          const bal = (Number(acc.current_balance) || 0) - amount;
          return { ...acc, current_balance: Math.round(bal * 100) / 100 };
        }
        if (acc.code === 'por_cobrar') {
          const bal = (Number(acc.current_balance) || 0) + amount;
          return { ...acc, current_balance: Math.round(bal * 100) / 100 };
        }
        return acc;
      });

      if (personName) {
        const existingDebt = updatedDebts.find((d) => d.person_name.toLowerCase() === personName.toLowerCase() && d.type === 'me_deben');
        if (existingDebt) {
          const newDebtBal = Math.round(((Number(existingDebt.current_balance) || 0) + amount) * 100) / 100;
          const isSettled = Math.abs(newDebtBal) < 0.005;
          updatedDebts = updatedDebts.map((d) =>
            d.id === existingDebt.id ? { ...d, current_balance: newDebtBal, status: isSettled ? ('settled' as const) : ('active' as const) } : d
          );
        }
      }
    }

    // g. Asumir Deuda (debt_in): reducimos deuda
    if (targetTx.type === 'debt_in') {
      const personName = (targetTx.metadata?.person || '').trim();
      if (personName) {
        const existingDebt = updatedDebts.find((d) => d.person_name.toLowerCase() === personName.toLowerCase() && d.type === 'debo');
        if (existingDebt) {
          const newDebtBal = Math.round(((Number(existingDebt.current_balance) || 0) - amount) * 100) / 100;
          const isSettled = Math.abs(newDebtBal) < 0.005;
          updatedDebts = updatedDebts.map((d) =>
            d.id === existingDebt.id ? { ...d, current_balance: newDebtBal, status: isSettled ? ('settled' as const) : ('active' as const) } : d
          );
        }
      }
    }

    // h. Me deben por servicio/daño (debt_service_in): restamos de por_cobrar y reducimos deuda
    if (targetTx.type === 'debt_service_in') {
      const personName = (targetTx.metadata?.person || '').trim();
      updatedAccounts = updatedAccounts.map((acc) => {
        if (acc.code === 'por_cobrar') {
          const bal = (Number(acc.current_balance) || 0) - amount;
          return { ...acc, current_balance: Math.round(bal * 100) / 100 };
        }
        return acc;
      });

      if (personName) {
        const existingDebt = updatedDebts.find((d) => d.person_name.toLowerCase() === personName.toLowerCase() && d.type === 'me_deben');
        if (existingDebt) {
          const newDebtBal = Math.round(((Number(existingDebt.current_balance) || 0) - amount) * 100) / 100;
          const isSettled = Math.abs(newDebtBal) < 0.005;
          updatedDebts = updatedDebts.map((d) =>
            d.id === existingDebt.id ? { ...d, current_balance: newDebtBal, status: isSettled ? ('settled' as const) : ('active' as const) } : d
          );
        }
      }
    }

    const updatedTxs = transactions.filter((t) => t.id !== id);

    let updatedPayments = [...debtPayments];
    if (['loan_out', 'loan_payment', 'debt_in', 'debt_service_in'].includes(targetTx.type)) {
      const isCargo = ['loan_out', 'debt_in', 'debt_service_in'].includes(targetTx.type);
      const payType = isCargo ? 'cargo' : 'abono';
      const pIdx = updatedPayments.findIndex(
        (p) => p.amount === amount && p.type === payType && (p.date === targetTx.date || p.note === targetTx.note)
      );
      if (pIdx >= 0) updatedPayments.splice(pIdx, 1);
    }

    setAccounts(updatedAccounts);
    setTransactions(updatedTxs);
    setDebts(updatedDebts);
    setDebtPayments(updatedPayments);

    // MODO INVITADO
    if (!isSupabaseConfigured || !supabase || !user) {
      saveGuestAccounts(updatedAccounts);
      saveGuestTransactions(updatedTxs);
      saveGuestDebts(updatedDebts);
      saveGuestDebtPayments(updatedPayments);
      return { error: null };
    }

    // MODO NUBE
    try {
      await supabase.from('transactions').delete().eq('id', id);
      if (targetTx.account_id) {
        const srcAcc = updatedAccounts.find((a) => a.id === targetTx.account_id);
        if (srcAcc) await supabase.from('accounts').update({ current_balance: srcAcc.current_balance, metadata: srcAcc.metadata }).eq('id', srcAcc.id);
      }
      if (targetTx.destination_account_id) {
        const destAcc = updatedAccounts.find((a) => a.id === targetTx.destination_account_id);
        if (destAcc) await supabase.from('accounts').update({ current_balance: destAcc.current_balance }).eq('id', destAcc.id);
      }
      const hapiAcc = updatedAccounts.find((a) => a.code === 'hapi');
      if (hapiAcc && (targetTx.type === 'invest' || targetTx.type === 'inversion')) {
        await supabase.from('accounts').update({ metadata: hapiAcc.metadata }).eq('id', hapiAcc.id);
      }
      const porCobrarAcc = updatedAccounts.find((a) => a.code === 'por_cobrar');
      if (porCobrarAcc && ['loan_out', 'loan_payment', 'debt_service_in'].includes(targetTx.type)) {
        await supabase.from('accounts').update({ current_balance: porCobrarAcc.current_balance }).eq('id', porCobrarAcc.id);
      }

      // Sincronizar deudas y debt_payments en Supabase
      if (['loan_out', 'loan_payment', 'debt_in', 'debt_service_in'].includes(targetTx.type) && targetTx.metadata?.person) {
        const personName = targetTx.metadata.person.trim();
        const debtType = targetTx.type === 'debt_in' ? 'debo' : 'me_deben';
        const targetDebt = updatedDebts.find((d) => d.person_name.toLowerCase() === personName.toLowerCase() && d.type === debtType);
        if (targetDebt && targetDebt.id && !targetDebt.id.startsWith('debt-')) {
          await supabase.from('debts').update({
            current_balance: targetDebt.current_balance,
            status: targetDebt.status,
            updated_at: new Date().toISOString(),
          }).eq('id', targetDebt.id);

          const isCargo = ['loan_out', 'debt_in', 'debt_service_in'].includes(targetTx.type);
          const payType = isCargo ? 'cargo' : 'abono';
          await supabase.from('debt_payments')
            .delete()
            .eq('debt_id', targetDebt.id)
            .eq('amount', amount)
            .eq('type', payType);
        }
      }

      return { error: null };
    } catch (err: any) {
      console.error('Error eliminando transacción en nube:', err);
      return { error: err?.message || 'Error al eliminar en Supabase' };
    }
  };

  // -------------------------------------------------------------
  // EDITAR TRANSACCIÓN (Actualización atómica in-place conservando ID)
  // -------------------------------------------------------------
  const updateTransaction = async (
    id: string,
    updatedData: {
      account_id?: string | null;
      destination_account_id?: string | null;
      type: TransactionType;
      amount: number;
      category?: string;
      note?: string;
      date?: string;
      person?: string;
      commission?: number;
      share_price?: number;
      shares?: number;
      investment_asset?: 'sp500' | 'nasdaq' | string;
    }
  ): Promise<{ error: string | null }> => {
    const targetTx = transactions.find((t) => t.id === id);
    if (!targetTx) return { error: 'Transacción no encontrada para editar' };

    // 1. Revertir targetTx en cuentas y deudas
    let currentAccounts = [...accounts];
    let currentDebts = [...debts];
    let currentPayments = [...debtPayments];
    const oldAmount = Number(targetTx.amount) || 0;
    const oldCommission = Number(targetTx.metadata?.commission) || 0;
    const oldNetInvested = Math.max(0, oldAmount - oldCommission);

    // Reversión en cuentas:
    if (['ingreso', 'trade_profit', 'transfer_in'].includes(targetTx.type)) {
      currentAccounts = currentAccounts.map((a) =>
        a.id === targetTx.account_id ? { ...a, current_balance: Math.round(((Number(a.current_balance) || 0) - oldAmount) * 100) / 100 } : a
      );
    }
    if (['gasto', 'trade_loss', 'transfer_out', 'debt_payment'].includes(targetTx.type)) {
      currentAccounts = currentAccounts.map((a) =>
        a.id === targetTx.account_id ? { ...a, current_balance: Math.round(((Number(a.current_balance) || 0) + oldAmount) * 100) / 100 } : a
      );
    }
    if (['transfer', 'transferencia'].includes(targetTx.type)) {
      currentAccounts = currentAccounts.map((a) => {
        if (a.id === targetTx.account_id) return { ...a, current_balance: Math.round(((Number(a.current_balance) || 0) + oldAmount) * 100) / 100 };
        if (a.id === targetTx.destination_account_id) return { ...a, current_balance: Math.round(((Number(a.current_balance) || 0) - (oldAmount - oldCommission)) * 100) / 100 };
        return a;
      });
    }
    if (['invest', 'inversion'].includes(targetTx.type)) {
      const asset = targetTx.metadata?.investment_asset?.toLowerCase() === 'nasdaq' ? 'nasdaq' : 'sp500';
      currentAccounts = currentAccounts.map((a) => {
        if (a.id === targetTx.account_id) return { ...a, current_balance: Math.round(((Number(a.current_balance) || 0) + oldAmount) * 100) / 100 };
        if (a.code === 'hapi') {
          const meta = { ...(a.metadata || {}) };
          if (asset === 'nasdaq') meta.nasdaq_balance = Math.max(0, Math.round(((Number(meta.nasdaq_balance) || 0) - oldNetInvested) * 100) / 100);
          else meta.sp500_balance = Math.max(0, Math.round(((Number(meta.sp500_balance) || 0) - oldNetInvested) * 100) / 100);
          return { ...a, metadata: meta };
        }
        return a;
      });
    }
    if (targetTx.type === 'loan_out') {
      const pName = (targetTx.metadata?.person || '').trim();
      currentAccounts = currentAccounts.map((a) => {
        if (a.id === targetTx.account_id) return { ...a, current_balance: Math.round(((Number(a.current_balance) || 0) + oldAmount) * 100) / 100 };
        if (a.code === 'por_cobrar') return { ...a, current_balance: Math.round(((Number(a.current_balance) || 0) - oldAmount) * 100) / 100 };
        return a;
      });
      if (pName) {
        const exDebt = currentDebts.find((d) => d.person_name.toLowerCase() === pName.toLowerCase() && d.type === 'me_deben');
        if (exDebt) {
          const bal = Math.round(((Number(exDebt.current_balance) || 0) - oldAmount) * 100) / 100;
          currentDebts = currentDebts.map((d) => d.id === exDebt.id ? { ...d, current_balance: bal, status: Math.abs(bal) < 0.005 ? 'settled' : 'active' } : d);
        }
      }
    }
    if (targetTx.type === 'loan_payment') {
      const pName = (targetTx.metadata?.person || '').trim();
      currentAccounts = currentAccounts.map((a) => {
        if (a.id === targetTx.account_id) return { ...a, current_balance: Math.round(((Number(a.current_balance) || 0) - oldAmount) * 100) / 100 };
        if (a.code === 'por_cobrar') return { ...a, current_balance: Math.round(((Number(a.current_balance) || 0) + oldAmount) * 100) / 100 };
        return a;
      });
      if (pName) {
        const exDebt = currentDebts.find((d) => d.person_name.toLowerCase() === pName.toLowerCase() && d.type === 'me_deben');
        if (exDebt) {
          const bal = Math.round(((Number(exDebt.current_balance) || 0) + oldAmount) * 100) / 100;
          currentDebts = currentDebts.map((d) => d.id === exDebt.id ? { ...d, current_balance: bal, status: Math.abs(bal) < 0.005 ? 'settled' : 'active' } : d);
        }
      }
    }
    if (targetTx.type === 'debt_in') {
      const pName = (targetTx.metadata?.person || '').trim();
      if (pName) {
        const exDebt = currentDebts.find((d) => d.person_name.toLowerCase() === pName.toLowerCase() && d.type === 'debo');
        if (exDebt) {
          const bal = Math.round(((Number(exDebt.current_balance) || 0) - oldAmount) * 100) / 100;
          currentDebts = currentDebts.map((d) => d.id === exDebt.id ? { ...d, current_balance: bal, status: Math.abs(bal) < 0.005 ? 'settled' : 'active' } : d);
        }
      }
    }
    if (targetTx.type === 'debt_service_in') {
      const pName = (targetTx.metadata?.person || '').trim();
      currentAccounts = currentAccounts.map((a) => a.code === 'por_cobrar' ? { ...a, current_balance: Math.round(((Number(a.current_balance) || 0) - oldAmount) * 100) / 100 } : a);
      if (pName) {
        const exDebt = currentDebts.find((d) => d.person_name.toLowerCase() === pName.toLowerCase() && d.type === 'me_deben');
        if (exDebt) {
          const bal = Math.round(((Number(exDebt.current_balance) || 0) - oldAmount) * 100) / 100;
          currentDebts = currentDebts.map((d) => d.id === exDebt.id ? { ...d, current_balance: bal, status: Math.abs(bal) < 0.005 ? 'settled' : 'active' } : d);
        }
      }
    }

    // 2. Aplicar nuevos datos sobre currentAccounts y currentDebts:
    const newAmount = Number(updatedData.amount);
    const newCommission = Number(updatedData.commission) || 0;
    const newNetInvested = Math.max(0, newAmount - newCommission);
    const newDateIso = updatedData.date || targetTx.date;

    if (['ingreso', 'trade_profit', 'transfer_in'].includes(updatedData.type)) {
      currentAccounts = currentAccounts.map((a) =>
        a.id === updatedData.account_id ? { ...a, current_balance: Math.round(((Number(a.current_balance) || 0) + newAmount) * 100) / 100 } : a
      );
    }
    if (['gasto', 'trade_loss', 'transfer_out', 'debt_payment'].includes(updatedData.type)) {
      currentAccounts = currentAccounts.map((a) =>
        a.id === updatedData.account_id ? { ...a, current_balance: Math.round(((Number(a.current_balance) || 0) - newAmount) * 100) / 100 } : a
      );
    }
    if (['transfer', 'transferencia'].includes(updatedData.type)) {
      currentAccounts = currentAccounts.map((a) => {
        if (a.id === updatedData.account_id) return { ...a, current_balance: Math.round(((Number(a.current_balance) || 0) - newAmount) * 100) / 100 };
        if (a.id === updatedData.destination_account_id) return { ...a, current_balance: Math.round(((Number(a.current_balance) || 0) + (newAmount - newCommission)) * 100) / 100 };
        return a;
      });
    }
    if (['invest', 'inversion'].includes(updatedData.type)) {
      const asset = updatedData.investment_asset?.toLowerCase() === 'nasdaq' ? 'nasdaq' : 'sp500';
      currentAccounts = currentAccounts.map((a) => {
        if (a.id === updatedData.account_id) return { ...a, current_balance: Math.round(((Number(a.current_balance) || 0) - newAmount) * 100) / 100 };
        if (a.code === 'hapi') {
          const meta = { ...(a.metadata || {}) };
          if (asset === 'nasdaq') meta.nasdaq_balance = Math.round(((Number(meta.nasdaq_balance) || 0) + newNetInvested) * 100) / 100;
          else meta.sp500_balance = Math.round(((Number(meta.sp500_balance) || 0) + newNetInvested) * 100) / 100;
          return { ...a, metadata: meta };
        }
        return a;
      });
    }
    if (updatedData.type === 'loan_out') {
      const pName = (updatedData.person || 'Sin persona').trim();
      currentAccounts = currentAccounts.map((a) => {
        if (a.id === updatedData.account_id) return { ...a, current_balance: Math.round(((Number(a.current_balance) || 0) - newAmount) * 100) / 100 };
        if (a.code === 'por_cobrar') return { ...a, current_balance: Math.round(((Number(a.current_balance) || 0) + newAmount) * 100) / 100 };
        return a;
      });
      const exDebt = currentDebts.find((d) => d.person_name.toLowerCase() === pName.toLowerCase() && d.type === 'me_deben');
      if (exDebt) {
        const bal = Math.round(((Number(exDebt.current_balance) || 0) + newAmount) * 100) / 100;
        currentDebts = currentDebts.map((d) => d.id === exDebt.id ? { ...d, current_balance: bal, status: Math.abs(bal) < 0.005 ? 'settled' : 'active' } : d);
      }
    }
    if (updatedData.type === 'loan_payment') {
      const pName = (updatedData.person || 'Sin persona').trim();
      currentAccounts = currentAccounts.map((a) => {
        if (a.id === updatedData.account_id) return { ...a, current_balance: Math.round(((Number(a.current_balance) || 0) + newAmount) * 100) / 100 };
        if (a.code === 'por_cobrar') return { ...a, current_balance: Math.round(((Number(a.current_balance) || 0) - newAmount) * 100) / 100 };
        return a;
      });
      const exDebt = currentDebts.find((d) => d.person_name.toLowerCase() === pName.toLowerCase() && d.type === 'me_deben');
      if (exDebt) {
        const bal = Math.round(((Number(exDebt.current_balance) || 0) - newAmount) * 100) / 100;
        currentDebts = currentDebts.map((d) => d.id === exDebt.id ? { ...d, current_balance: bal, status: Math.abs(bal) < 0.005 ? 'settled' : 'active' } : d);
      }
    }
    if (updatedData.type === 'debt_in') {
      const pName = (updatedData.person || 'Sin persona').trim();
      const exDebt = currentDebts.find((d) => d.person_name.toLowerCase() === pName.toLowerCase() && d.type === 'debo');
      if (exDebt) {
        const bal = Math.round(((Number(exDebt.current_balance) || 0) + newAmount) * 100) / 100;
        currentDebts = currentDebts.map((d) => d.id === exDebt.id ? { ...d, current_balance: bal, status: Math.abs(bal) < 0.005 ? 'settled' : 'active' } : d);
      }
    }
    if (updatedData.type === 'debt_service_in') {
      const pName = (updatedData.person || 'Sin persona').trim();
      currentAccounts = currentAccounts.map((a) => a.code === 'por_cobrar' ? { ...a, current_balance: Math.round(((Number(a.current_balance) || 0) + newAmount) * 100) / 100 } : a);
      const exDebt = currentDebts.find((d) => d.person_name.toLowerCase() === pName.toLowerCase() && d.type === 'me_deben');
      if (exDebt) {
        const bal = Math.round(((Number(exDebt.current_balance) || 0) + newAmount) * 100) / 100;
        currentDebts = currentDebts.map((d) => d.id === exDebt.id ? { ...d, current_balance: bal, status: Math.abs(bal) < 0.005 ? 'settled' : 'active' } : d);
      }
    }

    // 3. Preparar metadata combinada
    const mergedMetadata = { ...(targetTx.metadata || {}) };
    if (updatedData.commission !== undefined) mergedMetadata.commission = updatedData.commission;
    if (updatedData.person !== undefined) mergedMetadata.person = updatedData.person.trim();
    if (updatedData.investment_asset !== undefined) mergedMetadata.investment_asset = updatedData.investment_asset;
    if (updatedData.share_price !== undefined) mergedMetadata.share_price = updatedData.share_price;
    if (updatedData.shares !== undefined) mergedMetadata.shares = updatedData.shares;

    // 4. Actualizar objeto transacción en estado local (conservando ID y created_at)
    const updatedTx: Transaction = {
      ...targetTx,
      account_id: updatedData.account_id || null,
      destination_account_id: updatedData.destination_account_id || null,
      type: updatedData.type,
      amount: newAmount,
      category: updatedData.category || targetTx.category,
      note: updatedData.note !== undefined ? updatedData.note : targetTx.note,
      date: newDateIso,
      metadata: mergedMetadata,
    };

    setAccounts(currentAccounts);
    setDebts(currentDebts);
    setTransactions((prev) => prev.map((t) => (t.id === id ? updatedTx : t)));

    // Actualizar debtPayments en local si aplica
    if (['loan_out', 'loan_payment', 'debt_in', 'debt_service_in'].includes(targetTx.type) || ['loan_out', 'loan_payment', 'debt_in', 'debt_service_in'].includes(updatedData.type)) {
      const isCargo = ['loan_out', 'debt_in', 'debt_service_in'].includes(updatedData.type);
      const payType = isCargo ? 'cargo' : 'abono';
      currentPayments = currentPayments.map((p) => {
        if (p.amount === oldAmount && (p.date === targetTx.date || p.note === targetTx.note)) {
          return {
            ...p,
            amount: newAmount,
            type: payType,
            note: updatedData.note !== undefined ? updatedData.note : p.note,
            date: newDateIso,
          };
        }
        return p;
      });
      setDebtPayments(currentPayments);
    }

    // MODO INVITADO
    if (!isSupabaseConfigured || !supabase || !user) {
      saveGuestAccounts(currentAccounts);
      saveGuestDebts(currentDebts);
      saveGuestTransactions(transactions.map((t) => t.id === id ? updatedTx : t));
      saveGuestDebtPayments(currentPayments);
      return { error: null };
    }

    // MODO NUBE (SUPABASE)
    try {
      // 1. UPDATE real en la tabla transactions conservando ID original
      const { error: txErr } = await supabase
        .from('transactions')
        .update({
          account_id: updatedData.account_id || null,
          destination_account_id: updatedData.destination_account_id || null,
          type: updatedData.type,
          amount: newAmount,
          category: updatedData.category || targetTx.category,
          note: updatedData.note !== undefined ? updatedData.note : targetTx.note,
          date: newDateIso,
          metadata: mergedMetadata,
        })
        .eq('id', id);

      if (txErr) throw txErr;

      // 2. Actualizar cuentas afectadas en Supabase
      const affectedAccountIds = Array.from(new Set([
        targetTx.account_id,
        targetTx.destination_account_id,
        updatedData.account_id,
        updatedData.destination_account_id,
      ].filter(Boolean))) as string[];

      for (const accId of affectedAccountIds) {
        const acc = currentAccounts.find((a) => a.id === accId);
        if (acc) {
          await supabase.from('accounts').update({ current_balance: acc.current_balance, metadata: acc.metadata }).eq('id', acc.id);
        }
      }

      const hapiAcc = currentAccounts.find((a) => a.code === 'hapi');
      if (hapiAcc && (targetTx.type === 'invest' || targetTx.type === 'inversion' || updatedData.type === 'invest' || updatedData.type === 'inversion')) {
        await supabase.from('accounts').update({ metadata: hapiAcc.metadata }).eq('id', hapiAcc.id);
      }

      const porCobrarAcc = currentAccounts.find((a) => a.code === 'por_cobrar');
      if (porCobrarAcc && (
        ['loan_out', 'loan_payment', 'debt_service_in'].includes(targetTx.type) ||
        ['loan_out', 'loan_payment', 'debt_service_in'].includes(updatedData.type)
      )) {
        await supabase.from('accounts').update({ current_balance: porCobrarAcc.current_balance }).eq('id', porCobrarAcc.id);
      }

      // 3. Sincronizar deudas en Supabase si aplica
      const affectedPerson = updatedData.person?.trim() || targetTx.metadata?.person?.trim();
      if (affectedPerson) {
        const debtType = (updatedData.type === 'debt_in' || targetTx.type === 'debt_in') ? 'debo' : 'me_deben';
        const targetDebt = currentDebts.find((d) => d.person_name.toLowerCase() === affectedPerson.toLowerCase() && d.type === debtType);
        if (targetDebt && targetDebt.id && !targetDebt.id.startsWith('debt-')) {
          await supabase.from('debts').update({
            current_balance: targetDebt.current_balance,
            status: targetDebt.status,
            updated_at: new Date().toISOString(),
          }).eq('id', targetDebt.id);

          // Actualizar en debt_payments si existe
          const isCargo = ['loan_out', 'debt_in', 'debt_service_in'].includes(updatedData.type);
          const payType = isCargo ? 'cargo' : 'abono';
          await supabase.from('debt_payments')
            .update({
              amount: newAmount,
              note: updatedData.note !== undefined ? updatedData.note : targetTx.note,
              date: newDateIso,
              type: payType,
            })
            .eq('debt_id', targetDebt.id)
            .eq('amount', oldAmount);
        }
      }

      return { error: null };
    } catch (err: any) {
      console.error('Error actualizando transacción en Supabase:', err);
      return { error: err?.message || 'Error al actualizar en Supabase' };
    }
  };

  // Crear Deuda
  const createDebt = async (person_name: string, type: 'me_deben' | 'debo', initial_amount: number, note?: string) => {
    const amount = Number(initial_amount);
    const newDebt: Debt = {
      id: `debt-${Date.now()}`,
      user_id: user?.id || 'guest',
      person_name,
      type,
      initial_amount: amount,
      current_balance: amount,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const newPayment: DebtPayment = {
      id: `pay-${Date.now()}`,
      user_id: user?.id || 'guest',
      debt_id: newDebt.id,
      amount,
      type: 'cargo',
      note: note || 'Inicio de deuda',
      date: new Date().toISOString(),
      is_settlement: false,
      created_at: new Date().toISOString(),
    };

    const updatedDebts = [newDebt, ...debts];
    const updatedPayments = [newPayment, ...debtPayments];

    // Actualizar Por Cobrar
    const updatedAccounts = accounts.map((acc) => {
      if (acc.code === 'por_cobrar' && type === 'me_deben') {
        return { ...acc, current_balance: Math.round(((Number(acc.current_balance) || 0) + amount) * 100) / 100 };
      }
      return acc;
    });

    setAccounts(updatedAccounts);
    setDebts(updatedDebts);
    setDebtPayments(updatedPayments);

    if (!isSupabaseConfigured || !supabase || !user) {
      saveGuestAccounts(updatedAccounts);
      saveGuestDebts(updatedDebts);
      saveGuestDebtPayments(updatedPayments);
      return { error: null };
    }

    try {
      const { data: insertedDebt, error: dErr } = await supabase
        .from('debts')
        .insert({
          user_id: user.id,
          person_name,
          type,
          initial_amount: amount,
          current_balance: amount,
          status: 'active',
        })
        .select()
        .single();

      if (dErr) throw dErr;

      await supabase.from('debt_payments').insert({
        user_id: user.id,
        debt_id: insertedDebt.id,
        amount,
        type: 'cargo',
        note: note || 'Inicio de deuda',
        date: new Date().toISOString(),
      });

      const porCobrarAcc = updatedAccounts.find((a) => a.code === 'por_cobrar');
      if (porCobrarAcc) {
        await supabase.from('accounts').update({ current_balance: porCobrarAcc.current_balance }).eq('id', porCobrarAcc.id);
      }

      await loadData();
      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Error al crear deuda' };
    }
  };

  // Agregar Pago o Cargo a Deuda
  const addDebtPayment = async (payData: {
    debt_id: string;
    amount: number;
    type: 'cargo' | 'abono';
    note?: string;
    date?: string;
    is_settlement?: boolean;
  }) => {
    const amount = Number(payData.amount);
    const targetDebt = debts.find((d) => d.id === payData.debt_id);
    if (!targetDebt) return { error: 'Deuda no encontrada' };

    let newBal = targetDebt.current_balance;
    if (payData.type === 'cargo') {
      newBal += amount;
    } else {
      newBal -= amount;
    }
    newBal = Math.round(newBal * 100) / 100;
    const isSettled = Math.abs(newBal) < 0.005;

    const newPayment: DebtPayment = {
      id: `pay-${Date.now()}`,
      user_id: user?.id || 'guest',
      debt_id: payData.debt_id,
      amount,
      type: payData.type,
      note: payData.note || '',
      date: payData.date || new Date().toISOString(),
      is_settlement: isSettled,
      created_at: new Date().toISOString(),
    };

    const updatedDebts = debts.map((d) =>
      d.id === payData.debt_id
        ? { ...d, current_balance: newBal, status: isSettled ? ('settled' as const) : ('active' as const) }
        : d
    );
    const updatedPayments = [newPayment, ...debtPayments];

    // Actualizar cuenta Por Cobrar
    const diff = payData.type === 'cargo' ? amount : -amount;
    const updatedAccounts = accounts.map((acc) => {
      if (acc.code === 'por_cobrar' && targetDebt.type === 'me_deben') {
        const cur = Number(acc.current_balance) || 0;
        return { ...acc, current_balance: Math.round((cur + diff) * 100) / 100 };
      }
      return acc;
    });

    setAccounts(updatedAccounts);
    setDebts(updatedDebts);
    setDebtPayments(updatedPayments);

    if (!isSupabaseConfigured || !supabase || !user) {
      saveGuestAccounts(updatedAccounts);
      saveGuestDebts(updatedDebts);
      saveGuestDebtPayments(updatedPayments);
      return { error: null };
    }

    try {
      await supabase.from('debt_payments').insert({
        user_id: user.id,
        debt_id: payData.debt_id,
        amount,
        type: payData.type,
        note: payData.note || '',
        date: payData.date || new Date().toISOString(),
        is_settlement: isSettled,
      });

      await supabase
        .from('debts')
        .update({
          current_balance: newBal,
          status: isSettled ? 'settled' : 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', payData.debt_id);

      const porCobrarAcc = updatedAccounts.find((a) => a.code === 'por_cobrar');
      if (porCobrarAcc) {
        await supabase.from('accounts').update({ current_balance: porCobrarAcc.current_balance }).eq('id', porCobrarAcc.id);
      }

      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Error al registrar abono de deuda' };
    }
  };

  const updateInvestmentSettings = async (newSettings: Partial<InvestmentSettings>) => {
    const updated = { ...investmentSettings, ...newSettings, updated_at: new Date().toISOString() };
    setInvestmentSettings(updated);

    if (!isSupabaseConfigured || !supabase || !user) {
      saveGuestSettings(updated);
      return;
    }

    try {
      await supabase
        .from('investment_settings')
        .upsert({ ...updated, user_id: user.id }, { onConflict: 'user_id' });
    } catch (err) {
      console.warn('Error guardando configuración de inversiones:', err);
    }
  };

  const updateAccountBalance = async (accountId: string, newBalance: number) => {
    const updated = accounts.map((a) =>
      a.id === accountId ? { ...a, current_balance: newBalance } : a
    );
    setAccounts(updated);

    if (!isSupabaseConfigured || !supabase || !user) {
      saveGuestAccounts(updated);
      return;
    }

    try {
      await supabase.from('accounts').update({ current_balance: newBalance }).eq('id', accountId);
    } catch (err) {
      console.warn('Error actualizando saldo de cuenta:', err);
    }
  };

  const updateAccountVisibility = async (accountId: string, isArchived: boolean) => {
    const updated = accounts.map((a) =>
      a.id === accountId ? { ...a, is_archived: isArchived } : a
    );
    setAccounts(updated);

    if (!isSupabaseConfigured || !supabase || !user) {
      saveGuestAccounts(updated);
      return;
    }

    try {
      await supabase.from('accounts').update({ is_archived: isArchived }).eq('id', accountId);
    } catch (err) {
      console.warn('Error actualizando visibilidad de cuenta:', err);
    }
  };

  const updateMultipleAccountsVisibility = async (visibilityMap: Record<string, boolean>) => {
    const updated = accounts.map((a) =>
      visibilityMap[a.id] !== undefined ? { ...a, is_archived: !visibilityMap[a.id] } : a
    );
    setAccounts(updated);

    if (!isSupabaseConfigured || !supabase || !user) {
      saveGuestAccounts(updated);
      return;
    }

    try {
      const client = supabase;
      if (client) {
        await Promise.all(
          Object.entries(visibilityMap).map(([id, isVisible]) =>
            client.from('accounts').update({ is_archived: !isVisible }).eq('id', id)
          )
        );
      }
    } catch (err) {
      console.warn('Error actualizando visibilidad de cuentas múltiples:', err);
    }
  };

  return (
    <FinanceContext.Provider
      value={{
        accounts,
        transactions,
        debts,
        debtPayments,
        investmentSettings,
        netWorth,
        totalInvestedCapital,
        loading,
        addTransaction,
        addDebtPayment,
        createDebt,
        deleteTransaction,
        updateTransaction,
        updateInvestmentSettings,
        updateAccountBalance,
        updateAccountVisibility,
        updateMultipleAccountsVisibility,
        refreshData: loadData,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance debe ser usado dentro de un FinanceProvider');
  }
  return context;
}
