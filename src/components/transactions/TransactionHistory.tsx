// src/components/transactions/TransactionHistory.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  TrendingUp,
  Calendar,
  Filter,
  ChevronLeft,
  ChevronRight,
  User,
  Edit2,
  Trash2,
  HandCoins,
  Handshake,
  Layers,
  ChevronDown,
  Check,
  BarChart3,
  Sparkles,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { Transaction } from '../../types/database';
import { formatCurrency, formatDate, formatTime } from '../../utils/formatters';
import { getCachedMarketPrices, fetchLiveMarketPrices, LiveMarketPrices } from '../../utils/marketPrices';
import { DeleteConfirmModal } from './DeleteConfirmModal';

interface TransactionHistoryProps {
  initialAccountFilter?: string;
  onSelectAccountFilter?: (accId: string) => void;
  onEditTransaction?: (tx: Transaction) => void;
}

const ITEMS_PER_PAGE = 12;

export interface TransactionTypeMeta {
  label: string;
  bg: string;
  text: string;
  border: string;
  category: 'expense' | 'income' | 'transfer' | 'invest' | 'loan' | 'debt';
  isLoanOut?: boolean;
  isLoanPayment?: boolean;
  isDebtIn?: boolean;
  isDebtService?: boolean;
  isCommission?: boolean;
}

export function getTransactionTypeMeta(tx: Transaction): TransactionTypeMeta {
  const note = (tx.note || '').toLowerCase().trim();
  const category = (tx.category || '').toLowerCase().trim();

  // 1. Intereses / Rendimiento
  if (category.includes('interes') || note.includes('interes') || note.includes('rendimiento')) {
    return {
      label: 'Intereses / Rendimiento',
      bg: 'bg-emerald-500/15',
      text: 'text-emerald-300',
      border: 'border-emerald-500/30',
      category: 'income',
    };
  }

  // 2. Comisiones bancarias o de broker
  if (
    note.startsWith('comision') ||
    note.startsWith('comisión') ||
    note.includes('comision por') ||
    note.includes('comisión por') ||
    category.includes('comision') ||
    category.includes('comisión')
  ) {
    return {
      label: 'Comisión',
      bg: 'bg-rose-500/15',
      text: 'text-rose-300',
      border: 'border-rose-500/30',
      category: 'expense',
      isCommission: true,
    };
  }

  // 3. Trading
  if (tx.type === 'trade_profit') {
    return {
      label: 'Trading: Ganancia',
      bg: 'bg-emerald-500/15',
      text: 'text-emerald-300',
      border: 'border-emerald-500/30',
      category: 'income',
    };
  }
  if (tx.type === 'trade_loss') {
    return {
      label: 'Trading: Pérdida',
      bg: 'bg-rose-500/15',
      text: 'text-rose-300',
      border: 'border-rose-500/30',
      category: 'expense',
    };
  }

  // 4. Préstamos y Deudas
  if (tx.type === 'loan_out') {
    return {
      label: 'Préstamo (Presté)',
      bg: 'bg-amber-500/15',
      text: 'text-amber-300',
      border: 'border-amber-500/30',
      category: 'loan',
      isLoanOut: true,
    };
  }

  if (tx.type === 'loan_payment') {
    return {
      label: 'Cobro de Préstamo',
      bg: 'bg-emerald-500/15',
      text: 'text-emerald-300',
      border: 'border-emerald-500/30',
      category: 'loan',
      isLoanPayment: true,
    };
  }

  if (tx.type === 'debt_in') {
    return {
      label: 'Deuda (Yo debo - Sin Banco)',
      bg: 'bg-orange-500/15',
      text: 'text-orange-300',
      border: 'border-orange-500/30',
      category: 'debt',
      isDebtIn: true,
    };
  }

  if (tx.type === 'debt_service_in') {
    return {
      label: 'Por Cobrar (Sin Banco)',
      bg: 'bg-purple-500/15',
      text: 'text-purple-300',
      border: 'border-purple-500/30',
      category: 'debt',
      isDebtService: true,
    };
  }

  if (tx.type === 'debt_payment') {
    return {
      label: 'Pago de Deuda',
      bg: 'bg-rose-500/15',
      text: 'text-rose-300',
      border: 'border-rose-500/30',
      category: 'debt',
    };
  }

  // 5. Transferencias entre cuentas
  if (['transfer', 'transferencia', 'transfer_in', 'transfer_out'].includes(tx.type)) {
    if (tx.type === 'transfer_in') {
      return {
        label: 'Transferencia (Entrada)',
        bg: 'bg-emerald-500/15',
        text: 'text-emerald-300',
        border: 'border-emerald-500/30',
        category: 'transfer',
      };
    }
    if (tx.type === 'transfer_out') {
      return {
        label: 'Transferencia (Salida)',
        bg: 'bg-rose-500/15',
        text: 'text-rose-300',
        border: 'border-rose-500/30',
        category: 'transfer',
      };
    }
    return {
      label: 'Transferencia',
      bg: 'bg-cyan-500/15',
      text: 'text-cyan-300',
      border: 'border-cyan-500/30',
      category: 'transfer',
    };
  }

  // 6. Inversión en broker / Compra de acciones
  if (tx.type === 'invest' || tx.type === 'inversion') {
    if (tx.metadata?.shares !== undefined || note.startsWith('compra')) {
      return {
        label: 'Compra de Acciones',
        bg: 'bg-purple-500/15',
        text: 'text-purple-300',
        border: 'border-purple-500/30',
        category: 'invest',
      };
    }
    return {
      label: 'Inversión en Broker',
      bg: 'bg-indigo-500/15',
      text: 'text-indigo-300',
      border: 'border-indigo-500/30',
      category: 'invest',
    };
  }

  // 7. Ingreso regular
  if (tx.type === 'ingreso') {
    return {
      label: 'Ingreso',
      bg: 'bg-emerald-500/15',
      text: 'text-emerald-300',
      border: 'border-emerald-500/30',
      category: 'income',
    };
  }

  // 8. Gasto regular / Pago
  return {
    label: 'Gasto / Pago',
    bg: 'bg-rose-500/15',
    text: 'text-rose-300',
    border: 'border-rose-500/30',
    category: 'expense',
  };
}

export function TransactionHistory({ initialAccountFilter, onSelectAccountFilter, onEditTransaction }: TransactionHistoryProps) {
  const { transactions, accounts, deleteTransaction } = useFinance();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterAccount, setFilterAccount] = useState<string>(initialAccountFilter || 'all');
  const [currentPage, setCurrentPage] = useState(1);

  // Dropdown de selección de bancos personalizado con logos
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const accountDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target as Node)) {
        setIsAccountDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Metadatos de la cuenta seleccionada para el disparador del dropdown
  const selectedFilterAccountMeta = useMemo(() => {
    if (filterAccount === 'all') {
      return { name: 'Todas las cuentas', isAll: true };
    }
    if (filterAccount === 'sp500') {
      return { name: 'S&P 500 (VOO)', isStock: true, color: 'text-purple-300' };
    }
    if (filterAccount === 'nasdaq') {
      return { name: 'NASDAQ-100 (QQQM)', isStock: true, color: 'text-cyan-300' };
    }
    if (filterAccount === 'all_stocks') {
      return { name: 'Total Acciones (VOO + QQQM)', isStock: true, color: 'text-indigo-300' };
    }
    const acc = accounts.find((a) => a.id === filterAccount);
    return {
      name: acc ? (acc.code === 'hapi' ? 'Hapi (Broker - Saldo Efectivo)' : acc.name) : 'Cuenta',
      icon: acc?.icon_url,
      code: acc?.code,
      isAll: false,
    };
  }, [filterAccount, accounts]);

  // Estado para Eliminación
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);

  // Precios de mercado en vivo
  const [marketPrices, setMarketPrices] = useState<LiveMarketPrices>(() => getCachedMarketPrices());

  useEffect(() => {
    fetchLiveMarketPrices().then(setMarketPrices).catch(() => {});
  }, []);

  // Mapa de Saldos Resultantes (Estilo Banco Pichincha: Saldo posterior a cada movimiento)
  const runningBalances = useMemo(() => {
    const balancesMap: Record<string, Record<string, number>> = {};

    accounts.forEach((acc) => {
      // Orden cronológico: de la transacción más antigua a la más reciente
      const accTxs = transactions
        .filter((t) => {
          if (acc.code === 'hapi') {
            // En Hapi (Broker Cash): solo movimientos de flujo de caja líquido
            // Excluye las compras de acciones físicas que pertenecen a los activos S&P 500 / NASDAQ
            const isStockPurchase = t.metadata?.shares !== undefined || (t.note || '').toLowerCase().startsWith('compra');
            if (isStockPurchase) return false;
            return t.account_id === acc.id || t.destination_account_id === acc.id;
          }
          if (t.account_id === acc.id || t.destination_account_id === acc.id) return true;
          if (acc.code === 'por_cobrar' && ['loan_out', 'loan_payment', 'debt_service_in', 'debt_payment', 'debt_in'].includes(t.type)) return true;
          return false;
        })
        .sort((a, b) => {
          const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
          if (dateDiff !== 0) return dateDiff;
          const fsA = Number(a.metadata?.firestore_id) || 0;
          const fsB = Number(b.metadata?.firestore_id) || 0;
          if (fsA && fsB && fsA !== fsB) return fsA - fsB;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });

      let running = Number(acc.initial_balance) || 0;

      accTxs.forEach((tx) => {
        if (!balancesMap[tx.id]) balancesMap[tx.id] = {};

        const amount = Number(tx.amount) || 0;
        const commission = Number(tx.metadata?.commission) || 0;
        let impact = 0;

        if (acc.code === 'por_cobrar') {
          if (tx.type === 'loan_out' || tx.type === 'debt_service_in' || tx.type === 'debt_payment') impact = +amount;
          if (tx.type === 'loan_payment' || tx.type === 'debt_in') impact = -amount;
        } else if (acc.code === 'hapi') {
          if (tx.type === 'transfer_in') impact = +amount;
          else if (['transfer_out', 'invest', 'inversion', 'gasto', 'trade_loss'].includes(tx.type)) impact = -amount;
          else if (tx.type === 'transfer' || tx.type === 'transferencia') {
            if (tx.destination_account_id === acc.id) impact = +(amount - commission);
            else if (tx.account_id === acc.id) impact = -amount;
          }
        } else if (['ingreso', 'trade_profit', 'loan_payment', 'transfer_in'].includes(tx.type)) {
          if (tx.account_id === acc.id) impact = +amount;
        } else if (['gasto', 'trade_loss', 'invest', 'inversion', 'loan_out', 'transfer_out', 'debt_payment'].includes(tx.type)) {
          if (tx.account_id === acc.id) impact = -amount;
        } else if (tx.type === 'transfer' || tx.type === 'transferencia') {
          if (tx.destination_account_id === acc.id) {
            impact = +(amount - commission);
          } else if (tx.account_id === acc.id) {
            impact = -amount;
          }
        }

        running = Math.round((running + impact) * 100) / 100;
        balancesMap[tx.id][acc.id] = running;
      });
    });

    return balancesMap;
  }, [accounts, transactions]);

  // Mapa de progreso acumulado para acciones (S&P 500 y NASDAQ-100)
  const stockLedgers = useMemo(() => {
    const map: Record<
      string,
      {
        asset: 'sp500' | 'nasdaq';
        assetLabel: string;
        ticker: string;
        shares: number;
        sharePrice: number;
        runningInvested: number;
        runningShares: number;
        currentVal: number;
        estValueAtTxPrice: number;
        returnPct: number;
        avgCost: number;
        isSell: boolean;
      }
    > = {};

    const hapiAcc = accounts.find((a) => a.code === 'hapi');

    (['sp500', 'nasdaq'] as const).forEach((assetKey) => {
      const assetLabel = assetKey === 'sp500' ? 'S&P 500 (VOO)' : 'NASDAQ-100 (QQQM)';
      const ticker = assetKey === 'sp500' ? 'VOO' : 'QQQM';
      const returnPct =
        assetKey === 'sp500'
          ? (hapiAcc?.metadata?.sp500_return ?? 0.0)
          : (hapiAcc?.metadata?.nasdaq_return ?? 0.0);

      const assetTxs = transactions
        .filter((t) => {
          const isMatch =
            (t.metadata?.investment_asset === assetKey ||
              (assetKey === 'sp500' && (t.note || '').toLowerCase().includes('s&p 500')) ||
              (assetKey === 'nasdaq' && (t.note || '').toLowerCase().includes('nasdaq'))) &&
            (t.metadata?.shares !== undefined || (t.note || '').toLowerCase().startsWith('compra'));
          return isMatch;
        })
        .sort((a, b) => {
          const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
          if (dateDiff !== 0) return dateDiff;
          const fsA = Number(a.metadata?.firestore_id) || 0;
          const fsB = Number(b.metadata?.firestore_id) || 0;
          if (fsA && fsB && fsA !== fsB) return fsA - fsB;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });

      let runningInvested = 0;
      let runningShares = 0;

      assetTxs.forEach((tx) => {
        const amount = Number(tx.amount) || 0;
        const shares = Number(tx.metadata?.shares) || 0;
        const sharePrice = Number(tx.metadata?.share_price) || (shares > 0 ? Math.round((amount / shares) * 100) / 100 : 0);

        const isSell = (tx.note || '').toLowerCase().startsWith('venta');
        if (isSell) {
          runningInvested = Math.max(0, Math.round((runningInvested - amount) * 100) / 100);
          runningShares = Math.max(0, runningShares - shares);
        } else {
          runningInvested = Math.round((runningInvested + amount) * 100) / 100;
          runningShares = runningShares + shares;
        }

        const avgCost = runningShares > 0 ? Math.round((runningInvested / runningShares) * 100) / 100 : 0;
        const currentVal = Math.round(runningInvested * (1 + returnPct / 100) * 100) / 100;
        const estValueAtTxPrice = Math.round(runningShares * sharePrice * 100) / 100;

        map[tx.id] = {
          asset: assetKey,
          assetLabel,
          ticker,
          shares,
          sharePrice,
          runningInvested,
          runningShares,
          currentVal,
          estValueAtTxPrice,
          returnPct,
          avgCost,
          isSell,
        };
      });
    });

    return map;
  }, [transactions, accounts]);

  // Resumen del activo filtrado (S&P 500, NASDAQ-100 o Total Acciones)
  const stockSummary = useMemo(() => {
    if (filterAccount !== 'sp500' && filterAccount !== 'nasdaq' && filterAccount !== 'all_stocks') return null;
    const isSp = filterAccount === 'sp500';
    const isAll = filterAccount === 'all_stocks';
    const hapiAcc = accounts.find((a) => a.code === 'hapi');

    if (isAll) {
      const spTxs = Object.values(stockLedgers).filter((s) => s.asset === 'sp500');
      const nasdaqTxs = Object.values(stockLedgers).filter((s) => s.asset === 'nasdaq');
      const lastSp = spTxs[spTxs.length - 1];
      const lastNas = nasdaqTxs[nasdaqTxs.length - 1];

      const spInvested = lastSp ? lastSp.runningInvested : (hapiAcc?.metadata?.sp500_balance || 853.08);
      const nasInvested = lastNas ? lastNas.runningInvested : (hapiAcc?.metadata?.nasdaq_balance || 366.11);
      const totalInvested = Math.round((spInvested + nasInvested) * 100) / 100;

      const spShares = lastSp ? lastSp.runningShares : 1.2130;
      const nasShares = lastNas ? lastNas.runningShares : 1.2529;

      const spLivePrice = marketPrices.SP500?.price || 702.56;
      const nasLivePrice = marketPrices.Nasdaq?.price || 294.39;

      const spVal = Math.round(spShares * spLivePrice * 100) / 100;
      const nasVal = Math.round(nasShares * nasLivePrice * 100) / 100;
      const currentVal = Math.round((spVal + nasVal) * 100) / 100;

      const gainLoss = Math.round((currentVal - totalInvested) * 100) / 100;
      const returnPct = totalInvested > 0 ? Math.round(((currentVal - totalInvested) / totalInvested) * 1000) / 10 : 0;

      return {
        isSp: false,
        isAll: true,
        assetKey: 'all_stocks' as const,
        ticker: 'VOO + QQQM',
        name: 'Portafolio Global de Acciones (VOO + QQQM)',
        totalInvested,
        totalShares: spShares + nasShares,
        sharesDisplay: `${spShares.toFixed(2)} VOO + ${nasShares.toFixed(2)} QQQM`,
        avgCost: 0,
        currentVal,
        gainLoss,
        returnPct,
        livePrice: 0,
        liveChange: 0,
      };
    }

    const assetKey = isSp ? 'sp500' : 'nasdaq';
    const ticker = isSp ? 'VOO' : 'QQQM';
    const name = isSp ? 'Vanguard S&P 500 ETF' : 'Invesco NASDAQ-100 ETF (QQQM)';

    const txsInAsset = Object.values(stockLedgers).filter((s) => s.asset === assetKey);
    const lastItem = txsInAsset[txsInAsset.length - 1];

    const totalInvested = lastItem ? lastItem.runningInvested : (isSp ? (hapiAcc?.metadata?.sp500_balance || 853.08) : (hapiAcc?.metadata?.nasdaq_balance || 366.11));
    const totalShares = lastItem ? lastItem.runningShares : (isSp ? 1.2130 : 1.2529);
    const returnPctFallback = isSp ? (hapiAcc?.metadata?.sp500_return ?? 0.0) : (hapiAcc?.metadata?.nasdaq_return ?? 0.0);
    const avgCost = totalShares > 0 ? Math.round((totalInvested / totalShares) * 100) / 100 : 0;

    const livePrice = isSp ? marketPrices.SP500?.price : marketPrices.Nasdaq?.price;
    const liveChange = isSp ? marketPrices.SP500?.change : marketPrices.Nasdaq?.change;

    const currentVal =
      livePrice && totalShares > 0
        ? Math.round(totalShares * livePrice * 100) / 100
        : Math.round(totalInvested * (1 + returnPctFallback / 100) * 100) / 100;
    const gainLoss = Math.round((currentVal - totalInvested) * 100) / 100;
    const returnPct = totalInvested > 0 ? Math.round(((currentVal - totalInvested) / totalInvested) * 1000) / 10 : returnPctFallback;

    return {
      isSp,
      isAll: false,
      assetKey,
      ticker,
      name,
      totalInvested,
      totalShares,
      sharesDisplay: `${totalShares.toFixed(4)} acc`,
      avgCost,
      currentVal,
      gainLoss,
      returnPct,
      livePrice,
      liveChange,
    };
  }, [filterAccount, stockLedgers, accounts, marketPrices]);

  const hapiAccount = accounts.find((a) => a.code === 'hapi');

  // Resumen del efectivo de Hapi (flujo de caja del broker)
  const hapiCashSummary = useMemo(() => {
    if (!hapiAccount || filterAccount !== hapiAccount.id) return null;
    const cashTxs = transactions.filter((t) => {
      const isStockPurchase = t.metadata?.shares !== undefined || (t.note || '').toLowerCase().startsWith('compra');
      if (isStockPurchase) return false;
      return t.account_id === hapiAccount.id || t.destination_account_id === hapiAccount.id;
    });

    const totalDeposits = cashTxs.filter((t) => t.type === 'transfer_in').reduce((s, t) => s + Number(t.amount), 0);
    const totalInvestedOutflows = cashTxs.filter((t) => t.type === 'invest' || t.type === 'inversion').reduce((s, t) => s + Number(t.amount), 0);
    const totalFees = cashTxs.filter((t) => t.type === 'gasto' || t.type === 'trade_loss').reduce((s, t) => s + Number(t.amount), 0);
    const currentCash = Number(hapiAccount.current_balance) || 0;

    return {
      currentCash,
      totalDeposits,
      totalInvestedOutflows,
      totalFees,
    };
  }, [filterAccount, hapiAccount, transactions]);

  // Sincronizar si cambia el filtro desde props (ej. click en tarjeta bancaria)
  useEffect(() => {
    if (initialAccountFilter !== undefined) {
      setFilterAccount(initialAccountFilter);
      setCurrentPage(1);
    }
  }, [initialAccountFilter]);

  const filteredTransactions = transactions.filter((tx) => {
    const matchesSearch =
      (tx.note || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.metadata?.person || '').toLowerCase().includes(searchTerm.toLowerCase());

    let matchesType = true;
    if (filterType === 'gasto') {
      matchesType = tx.type === 'gasto' || tx.type === 'trade_loss';
    } else if (filterType === 'ingreso') {
      matchesType = tx.type === 'ingreso' || tx.type === 'trade_profit';
    } else if (filterType === 'transferencia') {
      matchesType = ['transfer', 'transferencia', 'transfer_in', 'transfer_out'].includes(tx.type);
    } else if (filterType === 'inversion') {
      matchesType = ['invest', 'inversion'].includes(tx.type);
    } else if (filterType === 'deuda') {
      matchesType = ['loan_out', 'loan_payment', 'debt_in', 'debt_service_in', 'debt_payment'].includes(tx.type);
    }

    let matchesAccount = true;
    if (filterAccount === 'all') {
      matchesAccount = true;
    } else if (filterAccount === 'sp500') {
      // En S&P 500 (VOO): muestra únicamente las compras y entradas de acciones del fondo (ej. +$140.00, +$713.08)
      // Excluye las salidas de efectivo de Hapi ('Inversión en...') para no confundir con ventas
      matchesAccount = !!(
        (tx.note?.toLowerCase().startsWith('compra') || tx.note?.toLowerCase().startsWith('venta') || tx.metadata?.shares !== undefined) &&
        (tx.metadata?.investment_asset === 'sp500' || tx.note?.toLowerCase().includes('s&p 500') || tx.note?.toLowerCase().includes('voo'))
      );
    } else if (filterAccount === 'nasdaq') {
      // En NASDAQ-100 (QQQM): muestra únicamente las compras y entradas de acciones del fondo (ej. +$60.59, +$305.52)
      // Excluye las salidas de efectivo de Hapi ('Inversión en...') para no confundir con ventas
      matchesAccount = !!(
        (tx.note?.toLowerCase().startsWith('compra') || tx.note?.toLowerCase().startsWith('venta') || tx.metadata?.shares !== undefined) &&
        (tx.metadata?.investment_asset === 'nasdaq' || tx.note?.toLowerCase().includes('nasdaq') || tx.note?.toLowerCase().includes('qqq'))
      );
    } else if (filterAccount === 'all_stocks') {
      // En Total Acciones (VOO + QQQM): muestra todas las compras de acciones físicas de ambos fondos
      matchesAccount = !!(
        (tx.note?.toLowerCase().startsWith('compra') || tx.note?.toLowerCase().startsWith('venta') || tx.metadata?.shares !== undefined) &&
        (tx.metadata?.investment_asset === 'sp500' || tx.metadata?.investment_asset === 'nasdaq' ||
         tx.note?.toLowerCase().includes('s&p 500') || tx.note?.toLowerCase().includes('voo') ||
         tx.note?.toLowerCase().includes('nasdaq') || tx.note?.toLowerCase().includes('qqq'))
      );
    } else if (hapiAccount && filterAccount === hapiAccount.id) {
      // En Hapi (Broker - Saldo Efectivo): muestra los 9 movimientos de flujo de caja del broker (transferencias, comisiones, pérdidas y salidas para inversión)
      matchesAccount = !!(
        (tx.account_id === hapiAccount.id || tx.destination_account_id === hapiAccount.id) &&
        !tx.note?.toLowerCase().startsWith('compra')
      );
    } else {
      matchesAccount =
        tx.account_id === filterAccount ||
        tx.destination_account_id === filterAccount;
    }

    return matchesSearch && matchesType && matchesAccount;
  });

  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      const fsA = Number(a.metadata?.firestore_id) || 0;
      const fsB = Number(b.metadata?.firestore_id) || 0;
      if (fsA && fsB && fsA !== fsB) return fsB - fsA;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [filteredTransactions]);

  // Paginación
  const totalPages = Math.max(1, Math.ceil(sortedTransactions.length / ITEMS_PER_PAGE));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const paginatedTransactions = sortedTransactions.slice(
    (validCurrentPage - 1) * ITEMS_PER_PAGE,
    validCurrentPage * ITEMS_PER_PAGE
  );

  const getAccountName = (accId: string | null | undefined) => {
    if (!accId) return 'N/A';
    const acc = accounts.find((a) => a.id === accId);
    return acc ? acc.name : 'Cuenta';
  };

  const renderAccountBadge = (accId?: string | null) => {
    if (!accId) return <span className="text-slate-400 italic">Sin cuenta</span>;
    const acc = accounts.find((a) => a.id === accId);
    if (!acc) return <span className="text-slate-400">Cuenta #{accId.slice(0, 4)}</span>;

    return (
      <span className="inline-flex items-center gap-1.5 font-semibold text-slate-300">
        {acc.icon_url ? (
          <img src={acc.icon_url} alt="" aria-hidden="true" className="w-3.5 h-3.5 object-contain rounded-full inline-block shrink-0 drop-shadow-sm" />
        ) : acc.code === 'por_cobrar' ? (
          <HandCoins className="w-3.5 h-3.5 text-purple-400 shrink-0" />
        ) : (
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400/40 inline-block shrink-0" />
        )}
        <span>{acc.name}</span>
      </span>
    );
  };

  return (
    <div className="w-full rounded-3xl glass-panel p-5 sm:p-7 border border-white/10 shadow-2xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-black font-display tracking-tight text-white flex items-center gap-2">
            Historial de Transacciones
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Registro cronológico de todos tus ingresos, gastos, transferencias e inversiones
          </p>
        </div>

        {/* Buscador */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-cyan-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por detalle o persona..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-slate-900/60 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-cyan-400 focus:bg-slate-900/80 shadow-inner transition-all placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Filtros rápidos */}
      <div className="flex flex-wrap items-center gap-2 mb-5 pb-4 border-b border-white/10 text-xs">
        <div className="flex items-center gap-1.5 text-cyan-300 font-semibold mr-1">
          <Filter className="w-3.5 h-3.5" />
          <span>Filtros:</span>
        </div>

        <button
          onClick={() => {
            setFilterType('all');
            setCurrentPage(1);
          }}
          className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
            filterType === 'all'
              ? 'bg-sky-500/35 text-white border border-cyan-400/60 shadow-md shadow-sky-500/25'
              : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.06]'
          }`}
        >
          Todos ({transactions.length})
        </button>

        <button
          onClick={() => {
            setFilterType('gasto');
            setCurrentPage(1);
          }}
          className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
            filterType === 'gasto'
              ? 'bg-rose-500/35 text-rose-200 border border-rose-400/60 shadow-md shadow-rose-500/20'
              : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.06]'
          }`}
        >
          Gastos
        </button>

        <button
          onClick={() => {
            setFilterType('ingreso');
            setCurrentPage(1);
          }}
          className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
            filterType === 'ingreso'
              ? 'bg-emerald-500/35 text-emerald-200 border border-emerald-400/60 shadow-md shadow-emerald-500/20'
              : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.06]'
          }`}
        >
          Ingresos
        </button>

        <button
          onClick={() => {
            setFilterType('transferencia');
            setCurrentPage(1);
          }}
          className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
            filterType === 'transferencia'
              ? 'bg-cyan-600/40 text-cyan-200 border border-cyan-400/60 shadow-md shadow-cyan-500/20'
              : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.06]'
          }`}
        >
          Transferencias
        </button>

        <button
          onClick={() => {
            setFilterType('inversion');
            setCurrentPage(1);
          }}
          className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
            filterType === 'inversion'
              ? 'bg-purple-600/40 text-purple-200 border border-purple-400/60 shadow-md shadow-purple-500/20'
              : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.06]'
          }`}
        >
          Inversiones
        </button>

        <button
          onClick={() => {
            setFilterType('deuda');
            setCurrentPage(1);
          }}
          className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
            filterType === 'deuda'
              ? 'bg-amber-500/35 text-amber-200 border border-amber-400/60 shadow-md shadow-amber-500/20'
              : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.06]'
          }`}
        >
          Deudas / Préstamos
        </button>

        {/* Filtro Glassmórfico por Cuenta / Banco con Logos Oficiales */}
        <div className="relative ml-auto" ref={accountDropdownRef}>
          <button
            type="button"
            onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/80 hover:bg-slate-800/90 border border-white/15 hover:border-cyan-400/50 rounded-xl text-xs font-bold text-white transition-all shadow-md cursor-pointer"
          >
            {selectedFilterAccountMeta.isAll ? (
              <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            ) : selectedFilterAccountMeta.isStock ? (
              <TrendingUp className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            ) : selectedFilterAccountMeta.icon ? (
              <img src={selectedFilterAccountMeta.icon} alt="" className="w-3.5 h-3.5 object-contain rounded-full shrink-0" />
            ) : selectedFilterAccountMeta.code === 'por_cobrar' ? (
              <HandCoins className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            ) : (
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shrink-0" />
            )}
            <span className="truncate max-w-[140px] sm:max-w-[190px]">{selectedFilterAccountMeta.name}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isAccountDropdownOpen ? 'rotate-180 text-cyan-400' : ''}`} />
          </button>

          <AnimatePresence>
            {isAccountDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-1.5 w-64 max-h-80 overflow-y-auto rounded-2xl bg-[#0d172e]/95 backdrop-blur-xl border border-white/15 shadow-2xl p-1.5 z-50 scrollbar-thin"
              >
                {/* Opción: Todas las cuentas */}
                <button
                  type="button"
                  onClick={() => {
                    setFilterAccount('all');
                    setIsAccountDropdownOpen(false);
                    setCurrentPage(1);
                    if (onSelectAccountFilter) onSelectAccountFilter('all');
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    filterAccount === 'all'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'hover:bg-white/10 text-slate-200 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Layers className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                    <span>Todas las cuentas</span>
                  </div>
                  {filterAccount === 'all' && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                </button>

                <div className="h-px bg-white/10 my-1" />

                {/* Cuentas y Activos */}
                {accounts
                  .filter((a) => !a.is_archived)
                  .map((acc) => {
                    if (acc.code === 'hapi') {
                      return (
                        <React.Fragment key={acc.id}>
                          {/* Hapi Efectivo */}
                          <button
                            type="button"
                            onClick={() => {
                              setFilterAccount(acc.id);
                              setIsAccountDropdownOpen(false);
                              setCurrentPage(1);
                              if (onSelectAccountFilter) onSelectAccountFilter(acc.id);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              filterAccount === acc.id
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'hover:bg-white/10 text-slate-200 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <img src="/assets/hapi.svg" alt="Hapi" className="w-4 h-4 object-contain rounded-full shrink-0" />
                              <span className="truncate">Hapi (Broker - Saldo Efectivo)</span>
                            </div>
                            {filterAccount === acc.id && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                          </button>

                          {/* S&P 500 (VOO) */}
                          <button
                            type="button"
                            onClick={() => {
                              setFilterAccount('sp500');
                              setIsAccountDropdownOpen(false);
                              setCurrentPage(1);
                              if (onSelectAccountFilter) onSelectAccountFilter('sp500');
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              filterAccount === 'sp500'
                                ? 'bg-purple-600 text-white shadow-sm'
                                : 'hover:bg-white/10 text-purple-300 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <TrendingUp className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                              <span className="truncate">📈 S&P 500 (VOO)</span>
                            </div>
                            {filterAccount === 'sp500' && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                          </button>

                          {/* NASDAQ-100 (QQQM) */}
                          <button
                            type="button"
                            onClick={() => {
                              setFilterAccount('nasdaq');
                              setIsAccountDropdownOpen(false);
                              setCurrentPage(1);
                              if (onSelectAccountFilter) onSelectAccountFilter('nasdaq');
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              filterAccount === 'nasdaq'
                                ? 'bg-cyan-600 text-white shadow-sm'
                                : 'hover:bg-white/10 text-cyan-300 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <TrendingUp className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                              <span className="truncate">📈 NASDAQ-100 (QQQM)</span>
                            </div>
                            {filterAccount === 'nasdaq' && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                          </button>

                          {/* Total Acciones (VOO + QQQM) */}
                          <button
                            type="button"
                            onClick={() => {
                              setFilterAccount('all_stocks');
                              setIsAccountDropdownOpen(false);
                              setCurrentPage(1);
                              if (onSelectAccountFilter) onSelectAccountFilter('all_stocks');
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              filterAccount === 'all_stocks'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'hover:bg-white/10 text-indigo-300 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <TrendingUp className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              <span className="truncate">📊 Total Acciones (VOO + QQQM)</span>
                            </div>
                            {filterAccount === 'all_stocks' && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                          </button>
                        </React.Fragment>
                      );
                    }

                    const isSelected = filterAccount === acc.id;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => {
                          setFilterAccount(acc.id);
                          setIsAccountDropdownOpen(false);
                          setCurrentPage(1);
                          if (onSelectAccountFilter) onSelectAccountFilter(acc.id);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'hover:bg-white/10 text-slate-200 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {acc.icon_url ? (
                            <img src={acc.icon_url} alt={acc.name} className="w-4 h-4 object-contain rounded-full shrink-0" />
                          ) : acc.code === 'por_cobrar' ? (
                            <HandCoins className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                          ) : (
                            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shrink-0" />
                          )}
                          <span className="truncate">{acc.name}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                      </button>
                    );
                  })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Banner de Resumen de Activo de Inversión (S&P 500 / NASDAQ-100 / Total Acciones) */}
      {stockSummary && (
        <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-linear-to-r from-purple-950/40 via-indigo-950/30 to-cyan-950/30 border border-purple-500/30 shadow-xl relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0">
                <TrendingUp className="w-6 h-6 text-purple-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black font-display tracking-tight text-white">
                    {stockSummary.name}
                  </h3>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-purple-500/25 text-purple-200 border border-purple-400/40">
                    {stockSummary.ticker}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Portafolio de Acciones en Broker Hapi · Tenencia acumulada
                </p>
              </div>
            </div>

            {/* Métricas destacadas del Activo */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10">
              <div className="bg-black/35 px-3 py-2 rounded-xl border border-white/10">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Invertido</div>
                <div className="text-sm sm:text-base font-black text-white">{formatCurrency(stockSummary.totalInvested)}</div>
              </div>

              <div className="bg-black/35 px-3 py-2 rounded-xl border border-purple-500/30">
                <div className="text-[10px] text-purple-300 font-bold uppercase tracking-wider">Tenencia Total</div>
                <div className="text-sm sm:text-base font-black text-purple-300">{stockSummary.sharesDisplay || `${stockSummary.totalShares} acc`}</div>
              </div>

              <div className="bg-black/35 px-3 py-2 rounded-xl border border-white/10">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Precio Promedio</div>
                <div className="text-sm sm:text-base font-black text-slate-200">{stockSummary.avgCost > 0 ? `$${stockSummary.avgCost.toFixed(2)}` : 'Múltiple'}</div>
              </div>

              <div className={`bg-black/35 px-3 py-2 rounded-xl border ${stockSummary.gainLoss < 0 ? 'border-rose-500/30' : 'border-emerald-500/30'}`}>
                <div className={`text-[10px] ${stockSummary.gainLoss < 0 ? 'text-rose-300' : 'text-emerald-300'} font-bold uppercase tracking-wider flex items-center justify-between gap-1`}>
                  <span>Valor Actual</span>
                  <span className={`text-[9px] px-1 py-0.2 rounded font-black ${stockSummary.returnPct < 0 ? 'bg-rose-500/25 text-rose-200' : 'bg-emerald-500/25 text-emerald-200'}`}>
                    {stockSummary.returnPct > 0 ? `+${stockSummary.returnPct}%` : `${stockSummary.returnPct}%`}
                  </span>
                </div>
                <div className={`text-sm sm:text-base font-black ${stockSummary.gainLoss < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{formatCurrency(stockSummary.currentVal)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Banner de Resumen de Flujo de Efectivo en Hapi (Broker Cash) */}
      {hapiCashSummary && (
        <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-linear-to-r from-blue-950/40 via-purple-950/30 to-slate-900/40 border border-blue-500/30 shadow-xl relative overflow-hidden backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                <img src="/assets/hapi.svg" alt="Hapi" className="w-6 h-6 object-contain" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black font-display tracking-tight text-white">
                  Hapi (Broker - Saldo Efectivo)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Flujo de caja líquido del broker (depósitos recibidos, comisiones y compras de acciones)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10">
              <div className="bg-black/35 px-3 py-2 rounded-xl border border-emerald-500/30">
                <div className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider">Depósitos Recibidos</div>
                <div className="text-sm sm:text-base font-black text-emerald-400">+{formatCurrency(hapiCashSummary.totalDeposits)}</div>
              </div>

              <div className="bg-black/35 px-3 py-2 rounded-xl border border-purple-500/30">
                <div className="text-[10px] text-purple-300 font-bold uppercase tracking-wider">Invertido en Acciones</div>
                <div className="text-sm sm:text-base font-black text-purple-300">-{formatCurrency(hapiCashSummary.totalInvestedOutflows)}</div>
              </div>

              <div className="bg-black/35 px-3 py-2 rounded-xl border border-rose-500/30">
                <div className="text-[10px] text-rose-300 font-bold uppercase tracking-wider">Comisiones / Ajustes</div>
                <div className="text-sm sm:text-base font-black text-rose-300">-{formatCurrency(hapiCashSummary.totalFees)}</div>
              </div>

              <div className="bg-black/35 px-3 py-2 rounded-xl border border-cyan-500/30">
                <div className="text-[10px] text-cyan-300 font-bold uppercase tracking-wider">Efectivo Disponible</div>
                <div className="text-sm sm:text-base font-black text-cyan-300">{formatCurrency(hapiCashSummary.currentCash)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lista de transacciones */}
      {paginatedTransactions.length === 0 ? (
        <div className="py-12 text-center text-slate-300">
          <Calendar className="w-10 h-10 mx-auto mb-2 opacity-40 text-cyan-400" />
          <p className="font-semibold text-sm">No hay transacciones con estos filtros</p>
          <p className="text-xs text-slate-400 mt-1">
            Prueba cambiando los filtros o usa el panel de la izquierda para registrar un nuevo movimiento.
          </p>
        </div>
      ) : (
        <div>
          {/* Cabecera estilo estado de cuenta / tabla (pantallas medianas y grandes) */}
          <div className="hidden md:flex items-center justify-between px-4 py-2 mb-2 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400 border-b border-white/10">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <span className="w-24 sm:w-28 shrink-0">Fecha / Hora</span>
              <span className="ml-14">Concepto y Cuenta</span>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <span className="text-right">Movimiento & Saldo</span>
              <span className="w-14 text-right pr-1">Acciones</span>
            </div>
          </div>

          <div className="space-y-2.5">
            {paginatedTransactions.map((tx) => {
              const typeBadge = getTransactionTypeMeta(tx);
              const stockInfo = stockLedgers[tx.id];
              const isInvestOutflow = typeBadge.label === 'Inversión en Broker';
              const isInvestPurchase = typeBadge.label === 'Compra de Acciones';

              const isTransferIn = tx.type === 'transfer_in' || (
                (tx.type === 'transferencia' || tx.type === 'transfer') && tx.destination_account_id === filterAccount
              );
              const isTransferOut = tx.type === 'transfer_out' || (
                (tx.type === 'transferencia' || tx.type === 'transfer') && tx.account_id === filterAccount
              );

              const isIncome =
                tx.type === 'ingreso' ||
                tx.type === 'trade_profit' ||
                tx.type === 'loan_payment' ||
                isTransferIn ||
                isInvestPurchase;

              const isExpense =
                tx.type === 'gasto' ||
                tx.type === 'trade_loss' ||
                tx.type === 'loan_out' ||
                tx.type === 'debt_payment' ||
                isInvestOutflow ||
                isTransferOut;

              const isDebtAction = ['debt_in', 'debt_service_in'].includes(tx.type);

              // Badge dinámico para transferencias contextualizadas por cuenta
              let effectiveBadge = { ...typeBadge };
              if (isTransferIn && !['ingreso', 'trade_profit', 'loan_payment'].includes(tx.type)) {
                effectiveBadge = {
                  label: 'Transferencia (Entrada)',
                  bg: 'bg-emerald-500/15',
                  text: 'text-emerald-300',
                  border: 'border-emerald-500/30',
                  category: 'transfer',
                };
              } else if (isTransferOut && !['gasto', 'trade_loss', 'loan_out', 'debt_payment'].includes(tx.type)) {
                effectiveBadge = {
                  label: 'Transferencia (Salida)',
                  bg: 'bg-rose-500/15',
                  text: 'text-rose-300',
                  border: 'border-rose-500/30',
                  category: 'transfer',
                };
              }

              // Estilo de la tarjeta de transacción según Entrada / Salida / Deuda / Transferencia neutral
              const cardColorStyle = isIncome
                ? 'bg-emerald-950/20 hover:bg-emerald-950/35 border-white/[0.08] hover:border-emerald-500/30 border-l-4 border-l-emerald-500/80 hover:border-l-emerald-400 shadow-sm shadow-emerald-950/10'
                : isExpense
                ? 'bg-rose-950/20 hover:bg-rose-950/35 border-white/[0.08] hover:border-rose-500/30 border-l-4 border-l-rose-500/80 hover:border-l-rose-400 shadow-sm shadow-rose-950/10'
                : isDebtAction
                ? 'bg-amber-950/20 hover:bg-amber-950/35 border-white/[0.08] hover:border-amber-500/30 border-l-4 border-l-amber-500/80 hover:border-l-amber-400 shadow-sm shadow-amber-950/10'
                : 'bg-cyan-950/20 hover:bg-cyan-950/35 border-white/[0.08] hover:border-cyan-500/30 border-l-4 border-l-cyan-500/80 hover:border-l-cyan-400 shadow-sm shadow-cyan-950/10';

              // Para compras de acciones: título compacto con acciones y activo
              const stockShares = stockLedgers[tx.id]?.shares;
              const investAssetLabel = tx.metadata?.investment_asset === 'sp500' ? 'S&P 500 (VOO)' : tx.metadata?.investment_asset === 'nasdaq' ? 'NASDAQ-100 (QQQ)' : null;
              const cleanNote = (tx.note || '').replace(/\s*-\s*$/, '').trim();
              const displayTitle =
                isInvestPurchase && stockShares
                  ? `Inversión en ${investAssetLabel || 'Broker'}`
                  : isInvestPurchase
                  ? `Inversión en ${investAssetLabel || 'Broker'}`
                  : cleanNote ||
                    (isTransferIn || isTransferOut
                      ? 'Transferencia'
                      : isInvestOutflow
                      ? 'Inversión en Broker'
                      : isIncome
                      ? 'Ingreso registrado'
                      : 'Gasto registrado');

              const txSharePrice = stockLedgers[tx.id]?.sharePrice;
              const txCommission = Number(tx.metadata?.commission) || 0;

              return (
                <div
                  key={tx.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-3.5 rounded-2xl border shadow-sm transition-all duration-200 ${cardColorStyle}`}
                >
                  {/* Lado Izquierdo: Fecha (Izquierda) + Divisor + Icono + Detalle/Cuenta */}
                  <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
                    {/* 1. Fecha & Hora a la izquierda */}
                    <div className="flex flex-col text-left shrink-0 w-24 sm:w-28">
                      <span className="text-xs sm:text-[13px] font-bold text-slate-200 tracking-tight leading-tight">
                        {formatDate(tx.date, false)}
                      </span>
                      <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium leading-tight mt-0.5">
                        {formatTime(tx.date)}
                      </span>
                    </div>

                    {/* Separador vertical sutil */}
                    <div className="hidden sm:block w-px h-8 bg-white/10 shrink-0" />

                    {/* 2. Icono representativo */}
                    <div
                      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                        typeBadge.isLoanOut
                          ? 'bg-amber-500/20 border-amber-500/30 text-amber-400'
                          : typeBadge.isLoanPayment
                          ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                          : isDebtAction
                          ? 'bg-orange-500/20 border-orange-500/30 text-orange-400'
                          : isInvestPurchase || isInvestOutflow
                          ? 'bg-purple-500/20 border-purple-500/30 text-purple-400'
                          : isTransferIn
                          ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400 shadow-sm shadow-emerald-500/10'
                          : isTransferOut
                          ? 'bg-rose-500/20 border-rose-500/30 text-rose-400 shadow-sm shadow-rose-500/10'
                          : isExpense
                          ? 'bg-rose-500/20 border-rose-500/30 text-rose-400'
                          : isIncome
                          ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                          : 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400'
                      }`}
                    >
                      {typeBadge.isLoanOut ? (
                        <HandCoins className="w-5 h-5" />
                      ) : typeBadge.isLoanPayment ? (
                        <Handshake className="w-5 h-5" />
                      ) : isDebtAction ? (
                        <ArrowDownRight className="w-5 h-5" />
                      ) : isInvestPurchase || isInvestOutflow ? (
                        <TrendingUp className="w-5 h-5" />
                      ) : isTransferIn ? (
                        <ArrowUpRight className="w-5 h-5" />
                      ) : isTransferOut ? (
                        <ArrowDownRight className="w-5 h-5" />
                      ) : isExpense ? (
                        <ArrowDownRight className="w-5 h-5" />
                      ) : isIncome ? (
                        <ArrowUpRight className="w-5 h-5" />
                      ) : (
                        <ArrowLeftRight className="w-5 h-5" />
                      )}
                    </div>

                    {/* 3. Concepto, Badges y Cuenta */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold text-white truncate max-w-full">
                          {displayTitle}
                        </span>
                        {/* Badge tipo — siempre visible para todas las transacciones */}
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border shadow-xs ${effectiveBadge.bg} ${effectiveBadge.text} ${effectiveBadge.border}`}>
                          {effectiveBadge.label}
                        </span>
                        {/* Para compras de acciones: pill de comisión si aplica */}
                        {isInvestPurchase && txCommission > 0 && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-900/40 text-rose-300 border border-rose-500/25">
                            comisión {formatCurrency(txCommission)}
                          </span>
                        )}
                        {/* Pill de acciones para compras */}
                        {isInvestPurchase && stockShares && stockShares > 0 && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-700/60 text-slate-300 border border-slate-500/30">
                            {stockShares.toFixed(4)} acc
                          </span>
                        )}
                        {tx.metadata?.person && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <User className="w-2.5 h-2.5" />
                            {tx.metadata.person}
                          </span>
                        )}
                      </div>

                      {/* Fila de Cuenta / Banco con su Logo */}
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 flex-wrap">
                        {isInvestPurchase ? (
                          <span className="inline-flex items-center gap-1.5 font-semibold text-purple-300">
                            <img src="/assets/hapi.svg" alt="Hapi" className="w-3.5 h-3.5 object-contain shrink-0" />
                            Hapi (Broker)
                            {investAssetLabel && (
                              <>
                                <span className="text-purple-400 font-bold text-[11px]">&#10132;</span>
                                <span>{investAssetLabel}</span>
                              </>
                            )}
                          </span>
                        ) : isInvestOutflow ? (
                          <span className="inline-flex items-center gap-1.5 flex-wrap">
                            {renderAccountBadge(tx.account_id)}
                            <span className="text-purple-400 font-bold text-[11px]">&#10132;</span>
                            <span className="inline-flex items-center gap-1 font-semibold text-purple-300">
                              <TrendingUp className="w-3 h-3 text-purple-400 shrink-0" />
                              {investAssetLabel || 'Broker'}
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 flex-wrap">
                            {renderAccountBadge(tx.account_id)}
                            {isTransferOut && tx.destination_account_id && (
                              <>
                                <span className="text-cyan-400 font-bold text-[11px]">&#10132;</span>
                                {renderAccountBadge(tx.destination_account_id)}
                              </>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Lado Derecho: Exactamente 2 Líneas + Botones de Acción */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10">
                    <div className="text-right flex flex-col items-end min-w-0">
                      {stockInfo ? (
                        <>
                          {/* Línea 1: +$60.59 | +0.2052 acc — en la misma fila */}
                          <div className="flex items-center justify-end gap-2 leading-tight">
                            <span className="text-sm sm:text-base font-black font-display tracking-tight text-emerald-400">
                              {stockInfo.isSell ? '-' : '+'}{formatCurrency(Number(tx.amount))}
                            </span>
                            <span className="text-white/25 font-bold text-sm select-none">|</span>
                            <span className="text-xs sm:text-[13px] font-extrabold text-purple-300">
                              {stockInfo.isSell ? '-' : '+'}{stockInfo.shares.toFixed(4)} acc
                            </span>
                          </div>

                          {/* Línea 2: Saldo con color + valor estimado */}
                          <div className="flex items-center justify-end gap-1 text-[11px] sm:text-xs font-medium mt-1 leading-tight">
                            <span className="text-cyan-400 font-bold">Saldo:</span>
                            <strong className="text-purple-300 font-black">{stockInfo.runningShares.toFixed(4)} acc</strong>
                            {stockInfo.estValueAtTxPrice > 0 && (
                              <>
                                <span className="text-slate-500 font-bold mx-0.5">~</span>
                                <strong className="text-emerald-300 font-black">{formatCurrency(stockInfo.estValueAtTxPrice)}</strong>
                              </>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Línea 1: Monto con signo y color */}
                          <div className="flex items-center justify-end leading-tight">
                            <span
                              className={`text-sm sm:text-base font-black font-display tracking-tight ${
                                isIncome
                                ? 'text-emerald-400'
                                : isExpense
                                ? 'text-rose-400'
                                : 'text-cyan-300'
                              }`}
                            >
                              {isIncome ? '+' : isExpense ? '-' : ''}
                              {formatCurrency(Number(tx.amount))}
                            </span>
                          </div>

                          {/* Línea 2: Saldo Resultante en la cuenta */}
                          {(() => {
                            const isHapiCash =
                              (hapiAccount && tx.account_id === hapiAccount.id) ||
                              (hapiAccount && filterAccount === hapiAccount.id);
                            const targetAccId =
                              filterAccount !== 'all' && filterAccount !== 'sp500' && filterAccount !== 'nasdaq'
                                ? filterAccount
                                : tx.account_id || tx.destination_account_id;
                            const bal = targetAccId ? runningBalances[tx.id]?.[targetAccId] : undefined;
                            if (bal === undefined) return null;
                            return (
                              <div
                                className={`text-[11px] sm:text-xs font-bold mt-0.5 tracking-tight leading-tight ${
                                  bal < 0 ? 'text-rose-400' : 'text-cyan-300/85'
                                }`}
                              >
                                {isHapiCash ? 'Saldo Efectivo: ' : 'Saldo: '}
                                {formatCurrency(bal)}
                              </div>
                            );
                          })()}
                        </>
                      )}
                    </div>

                    {/* Botones de Acción: Editar y Eliminar */}
                    <div className="flex items-center gap-1 pl-2 border-l border-white/10 shrink-0">
                      <button
                        type="button"
                        onClick={() => onEditTransaction?.(tx)}
                        title="Editar transacción en el panel lateral"
                        className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.15] text-slate-400 hover:text-cyan-300 transition-all cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingTx(tx)}
                        title="Eliminar transacción"
                        className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10 text-xs">
          <div className="text-slate-300 font-semibold">
            Mostrando {((validCurrentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(validCurrentPage * ITEMS_PER_PAGE, sortedTransactions.length)} de {sortedTransactions.length} movimientos
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={validCurrentPage === 1}
              className="p-2 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-slate-200 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer flex items-center gap-1 font-bold shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Anterior</span>
            </button>

            <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-white font-black shadow-inner">
              {validCurrentPage} / {totalPages}
            </div>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={validCurrentPage === totalPages}
              className="p-2 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-slate-200 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer flex items-center gap-1 font-bold shadow-sm"
            >
              <span className="hidden sm:inline">Siguiente</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación */}
      {deletingTx && (
        <DeleteConfirmModal
          transaction={deletingTx}
          accounts={accounts}
          onClose={() => setDeletingTx(null)}
          onConfirm={async () => {
            await deleteTransaction(deletingTx.id);
            setDeletingTx(null);
          }}
        />
      )}
    </div>
  );
}
