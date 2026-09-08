// src/components/transactions/TransactionForm.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusCircle,
  Calendar,
  Layers,
  TrendingUp,
  TrendingDown,
  DollarSign,
  User,
  Zap,
  Info,
  CheckCircle2,
  AlertCircle,
  Percent,
  ChevronDown,
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  HandCoins,
  Handshake,
  ShieldAlert,
  ShieldCheck,
  Check,
  Clock,
  X,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { Transaction, TransactionType } from '../../types/database';
import { formatCurrency, getLocalTodayDateString } from '../../utils/formatters';
import { getCachedMarketPrices, fetchLiveMarketPrices, LiveMarketPrices } from '../../utils/marketPrices';

interface TransactionFormProps {
  defaultAccountId?: string;
  onSuccess?: () => void;
  onCancelEdit?: () => void;
  isCompact?: boolean;
  editTransaction?: Transaction;
}

function getLocalNowTimeString(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

interface ActionOption {
  type: TransactionType;
  label: string;
  badge: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ACTION_OPTIONS: { group: string; options: ActionOption[] }[] = [
  {
    group: '⚡ Movimientos Cotidianos',
    options: [
      { type: 'gasto', label: 'Gasto / Pago / Retiro', badge: 'Salida', color: '#f43f5e', icon: ArrowDownRight },
      { type: 'ingreso', label: 'Ingreso / Depósito', badge: 'Entrada', color: '#10b981', icon: ArrowUpRight },
      { type: 'transfer', label: 'Transferencia entre Cuentas', badge: 'Mover', color: '#3b82f6', icon: ArrowLeftRight },
    ],
  },
  {
    group: '📈 Inversiones & Trading',
    options: [
      { type: 'invest', label: 'Invertir en Acciones (Broker)', badge: 'Hapi', color: '#a855f7', icon: TrendingUp },
      { type: 'trade_profit', label: 'Trading: Ganancia', badge: 'Profit', color: '#10b981', icon: TrendingUp },
      { type: 'trade_loss', label: 'Trading: Pérdida', badge: 'Loss', color: '#ef4444', icon: TrendingDown },
    ],
  },
  {
    group: '🤝 Préstamos & Deudas',
    options: [
      { type: 'loan_out', label: 'Prestar Dinero (Salida de Banco)', badge: 'Me deben', color: '#f59e0b', icon: HandCoins },
      { type: 'loan_payment', label: 'Cobrar Préstamo (Entrada a Banco)', badge: 'Cobro', color: '#06b6d4', icon: Handshake },
      { type: 'debt_in', label: 'Asumir Deuda (Yo debo - Sin Banco)', badge: 'Yo debo', color: '#8b5cf6', icon: ShieldAlert },
      { type: 'debt_service_in', label: 'Me deben dinero (Servicio/Daño - Sin Banco)', badge: 'Me deben', color: '#14b8a6', icon: ShieldCheck },
    ],
  },
];

function inferActionType(tx: Transaction): TransactionType {
  if (['transferencia', 'transfer_in', 'transfer_out'].includes(tx.type)) return 'transfer';
  if (tx.type === 'inversion') return 'invest';
  if (tx.type === 'debt_payment') return 'loan_payment';
  if (['loan_out', 'loan_payment', 'debt_in', 'debt_service_in', 'trade_profit', 'trade_loss', 'invest', 'transfer'].includes(tx.type)) {
    return tx.type;
  }
  const note = (tx.note || '').toLowerCase().trim();
  const category = (tx.category || '').toLowerCase().trim();
  const hasPerson = !!(tx.metadata?.person && String(tx.metadata.person).trim().length > 0);

  // Si se guardó como gasto pero tiene person o texto de préstamo -> loan_out
  if (
    tx.type === 'gasto' &&
    (hasPerson ||
      /\b(le preste|le presté|preste|presté|prestamo a|préstamo a|presté a|preste a|le di prestado|prestar dinero|prestamo|préstamo)\b/i.test(note) ||
      category.includes('prest'))
  ) {
    return 'loan_out';
  }

  // Si se guardó como ingreso pero tiene person o texto de cobro -> loan_payment
  if (
    tx.type === 'ingreso' &&
    (hasPerson ||
      /\b(me pago|me pagó|me pagaron|me cancelo|me canceló|cobro de prestamo|cobro de préstamo|cobro prestamo|cobro préstamo|abono de|abono a deuda|abono deuda|de lo que le preste|de una deuda|me pago mi ma)\b/i.test(note) ||
      category.includes('cobro'))
  ) {
    return 'loan_payment';
  }

  if (/\b(me presto|me prestó|me prestaron|pedi prestado|pedí prestado|yo debo|me endeude)\b/i.test(note)) {
    return 'debt_in';
  }

  return tx.type;
}

export function TransactionForm({ defaultAccountId, onSuccess, onCancelEdit, isCompact = false, editTransaction }: TransactionFormProps) {
  const { accounts, debts, addTransaction, updateTransaction } = useFinance();

  // Estados del Formulario
  const [date, setDate] = useState(
    editTransaction?.date ? editTransaction.date.slice(0, 10) : getLocalTodayDateString()
  );
  const [time, setTime] = useState<string>(() => {
    if (editTransaction?.date) {
      const d = new Date(editTransaction.date);
      if (!isNaN(d.getTime())) {
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      }
    }
    return getLocalNowTimeString();
  });

  const isToday = date === getLocalTodayDateString();

  // Si no se está editando y la fecha es hoy, fijar automáticamente con la hora actual
  useEffect(() => {
    if (!editTransaction && isToday) {
      setTime(getLocalNowTimeString());
    }
  }, [date, isToday, editTransaction]);

  const [actionType, setActionType] = useState<TransactionType>(
    editTransaction ? inferActionType(editTransaction) : 'gasto'
  );
  const [accountId, setAccountId] = useState<string>(
    editTransaction?.account_id || defaultAccountId || ''
  );
  const [destinationAccountId, setDestinationAccountId] = useState<string>(
    editTransaction?.destination_account_id || ''
  );
  const [amount, setAmount] = useState<string>(
    editTransaction ? String(editTransaction.amount) : ''
  );
  const [commission, setCommission] = useState<string>(
    editTransaction?.metadata?.commission ? String(editTransaction.metadata.commission) : ''
  );
  const [note, setNote] = useState<string>(editTransaction?.note || '');
  const [person, setPerson] = useState<string>(editTransaction?.metadata?.person || '');
  const [investAsset, setInvestAsset] = useState<'sp500' | 'nasdaq'>(
    (editTransaction?.metadata?.investment_asset as any) || 'sp500'
  );
  const [sharePrice, setSharePrice] = useState<string>(
    editTransaction?.metadata?.share_price ? String(editTransaction.metadata.share_price) : ''
  );

  // Sincronizar dinámicamente cuando editTransaction cambia (al hacer click en editar otra transacción o cancelar)
  useEffect(() => {
    if (editTransaction) {
      setDate(editTransaction.date ? editTransaction.date.slice(0, 10) : getLocalTodayDateString());
      const d = new Date(editTransaction.date);
      if (!isNaN(d.getTime())) {
        setTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
      } else {
        setTime(getLocalNowTimeString());
      }
      setActionType(inferActionType(editTransaction));
      setAccountId(editTransaction.account_id || '');
      setDestinationAccountId(editTransaction.destination_account_id || '');
      setAmount(String(editTransaction.amount || ''));
      setCommission(editTransaction.metadata?.commission ? String(editTransaction.metadata.commission) : '');
      setNote(editTransaction.note || '');
      setPerson(editTransaction.metadata?.person || '');
      setInvestAsset((editTransaction.metadata?.investment_asset as any) || 'sp500');
      setSharePrice(editTransaction.metadata?.share_price ? String(editTransaction.metadata.share_price) : '');
    } else {
      setDate(getLocalTodayDateString());
      setTime(getLocalNowTimeString());
      setActionType('gasto');
      setAmount('');
      setCommission('');
      setNote('');
      setPerson('');
      if (defaultAccountId) {
        setAccountId(defaultAccountId);
      } else if (visibleAccounts.length > 0) {
        const defaultAcc = visibleAccounts.find((a) => a.code === 'pichincha') || visibleAccounts[0];
        setAccountId(defaultAcc.id);
      }
    }
  }, [editTransaction]);

  // Dropdowns UI custom
  const [isActionOpen, setIsActionOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isDestAccountOpen, setIsDestAccountOpen] = useState(false);

  const actionRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const destAccountRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Precios en vivo
  const [marketPrices, setMarketPrices] = useState<LiveMarketPrices>(getCachedMarketPrices());
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Cerrar dropdowns al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (actionRef.current && !actionRef.current.contains(event.target as Node)) setIsActionOpen(false);
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) setIsAccountOpen(false);
      if (destAccountRef.current && !destAccountRef.current.contains(event.target as Node)) setIsDestAccountOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cuentas visibles (no archivadas)
  const visibleAccounts = useMemo(() => {
    const vis = accounts.filter((a) => !a.is_archived);
    return vis.length > 0 ? vis : accounts;
  }, [accounts]);

  // Inicializar o actualizar cuenta cuando cambia defaultAccountId o visibleAccounts
  useEffect(() => {
    if (editTransaction) return;
    if (defaultAccountId) {
      setAccountId(defaultAccountId);
    } else if (visibleAccounts.length > 0 && (!accountId || !visibleAccounts.some(a => a.id === accountId))) {
      const defaultAcc = visibleAccounts.find((a) => a.code === 'pichincha') || visibleAccounts[0];
      setAccountId(defaultAcc.id);
    }
  }, [visibleAccounts, defaultAccountId, editTransaction]);

  // Si cambia a 'invest', asegurar cuenta de broker Hapi si existe
  useEffect(() => {
    if (actionType === 'invest' || actionType === 'inversion') {
      const hapi = visibleAccounts.find((a) => a.code === 'hapi') || accounts.find((a) => a.code === 'hapi');
      if (hapi && !editTransaction) setAccountId(hapi.id);

      const price = investAsset === 'sp500' ? marketPrices.SP500.price : marketPrices.Nasdaq.price;
      if (!sharePrice) {
        setSharePrice(price.toFixed(2));
      }
    }
  }, [actionType, investAsset, visibleAccounts, marketPrices, editTransaction]);

  // Cargar cotizaciones
  useEffect(() => {
    fetchLiveMarketPrices().then((prices) => setMarketPrices(prices));
  }, []);

  // Parseos numéricos seguros
  const parsedAmount = Math.max(0, parseFloat(amount) || 0);
  const parsedCommission = Math.max(0, parseFloat(commission) || 0);
  const parsedSharePrice = Math.max(0.01, parseFloat(sharePrice) || (investAsset === 'sp500' ? marketPrices.SP500.price : marketPrices.Nasdaq.price));

  // Cálculo de acciones para Hapi
  const netInvested = Math.max(0, parsedAmount - parsedCommission);
  const calculatedShares = parsedSharePrice > 0 ? netInvested / parsedSharePrice : 0;

  // Lista única de personas para autocompletado rápido
  const existingPersons = useMemo(() => {
    const list = new Set<string>();
    debts.forEach((d) => {
      if (d.person_name) list.add(d.person_name);
    });
    return Array.from(list).sort();
  }, [debts]);

  const selectedAccount = useMemo(() => {
    return accounts.find((a) => a.id === accountId);
  }, [accounts, accountId]);

  const destAccount = useMemo(() => {
    return accounts.find((a) => a.id === destinationAccountId);
  }, [accounts, destinationAccountId]);

  // Metadata de la acción actual
  const currentActionMeta = useMemo(() => {
    for (const grp of ACTION_OPTIONS) {
      const match = grp.options.find((o) => o.type === actionType);
      if (match) return match;
    }
    return ACTION_OPTIONS[0].options[0];
  }, [actionType]);

  const handleUseLivePrice = async () => {
    setLoadingPrice(true);
    const fresh = await fetchLiveMarketPrices();
    setMarketPrices(fresh);
    const live = investAsset === 'sp500' ? fresh.SP500.price : fresh.Nasdaq.price;
    setSharePrice(live.toFixed(2));
    setLoadingPrice(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (parsedAmount <= 0) {
      setFeedback({ type: 'error', message: 'Ingresa un monto válido mayor a 0.' });
      return;
    }

    if ((actionType === 'transfer' || actionType === 'transferencia') && accountId === destinationAccountId) {
      setFeedback({ type: 'error', message: 'La cuenta origen y destino no pueden ser iguales.' });
      return;
    }

    if (['loan_out', 'loan_payment', 'debt_in', 'debt_service_in'].includes(actionType) && !person.trim()) {
      setFeedback({ type: 'error', message: 'Ingresa el nombre de la persona para esta operación.' });
      return;
    }

    setIsSubmitting(true);

    // Construir fecha y hora precisa en la zona horaria local de la máquina
    let finalDateIso = new Date().toISOString();
    if (date) {
      const timeToUse = (!editTransaction && isToday)
        ? getLocalNowTimeString()
        : (time || '12:00');
      
      const [hours, minutes] = timeToUse.split(':').map((v) => parseInt(v, 10) || 0);
      const [year, month, day] = date.split('-').map((v) => parseInt(v, 10) || 0);

      const localDate = new Date(year, (month || 1) - 1, day || 1, hours, minutes, 0);
      finalDateIso = isNaN(localDate.getTime()) ? new Date().toISOString() : localDate.toISOString();
    }

    const payload = {
      account_id: ['debt_in', 'debt_service_in'].includes(actionType) ? null : accountId,
      destination_account_id: ['transfer', 'transferencia'].includes(actionType) ? destinationAccountId : null,
      type: actionType,
      amount: parsedAmount,
      commission: parsedCommission > 0 ? parsedCommission : undefined,
      note: note.trim() || undefined,
      date: finalDateIso,
      person: person.trim() || undefined,
      investment_asset: actionType === 'invest' || actionType === 'inversion' ? investAsset : undefined,
      share_price: actionType === 'invest' ? parsedSharePrice : undefined,
      shares: actionType === 'invest' ? calculatedShares : undefined,
    };

    const res = editTransaction
      ? await updateTransaction(editTransaction.id, payload)
      : await addTransaction(payload);

    setIsSubmitting(false);

    if (res.error) {
      setFeedback({ type: 'error', message: res.error });
    } else {
      setFeedback({
        type: 'success',
        message: editTransaction ? '¡Transacción actualizada correctamente!' : '¡Transacción registrada correctamente!',
      });
      if (editTransaction) {
        setTimeout(() => {
          if (onCancelEdit) onCancelEdit();
          if (onSuccess) onSuccess();
        }, 700);
      } else {
        setAmount('');
        setCommission('');
        setNote('');
        setPerson('');
        if (onSuccess) {
          setTimeout(() => onSuccess(), 600);
        } else {
          setTimeout(() => setFeedback(null), 3500);
        }
      }
    }
  };

  const ActionIcon = currentActionMeta.icon;

  return (
    <div className={`w-full rounded-3xl glass-panel p-5 sm:p-6 border shadow-2xl relative transition-all duration-300 ${
      editTransaction
        ? 'border-cyan-400/60 ring-2 ring-cyan-400/25 shadow-cyan-500/15'
        : 'border-white/10'
    }`}>
      {/* Header del Formulario */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${
            editTransaction
              ? 'bg-linear-to-tr from-amber-500/20 to-cyan-500/20 border-cyan-400/40 text-cyan-300'
              : 'bg-linear-to-tr from-cyan-500/20 to-blue-500/20 border-cyan-500/30 text-cyan-400'
          }`}>
            {editTransaction ? <Check className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-black font-display tracking-tight text-white truncate">
              {editTransaction ? 'Editar Transacción' : 'Nueva Transacción'}
            </h2>
            <p className="text-[11px] text-slate-400 truncate">
              {editTransaction ? 'Modifica los datos del movimiento' : 'Panel rápido de operaciones'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Botón Cancelar Edición */}
          {editTransaction && onCancelEdit && (
            <button
              type="button"
              onClick={onCancelEdit}
              title="Cancelar edición y volver a crear"
              className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 border border-white/15 transition-all cursor-pointer flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cancelar</span>
            </button>
          )}

          {/* Badge de Acción Actual */}
          <span
            className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-sm"
            style={{
              backgroundColor: `${currentActionMeta.color}18`,
              borderColor: `${currentActionMeta.color}40`,
              color: currentActionMeta.color,
            }}
          >
            {currentActionMeta.badge}
          </span>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`mb-4 p-3 rounded-xl flex items-center gap-2.5 text-xs font-bold transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
              : 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 1. Selector Visual Glassmórfico de Acción */}
        <div className="relative" ref={actionRef}>
          <label className="block text-[11px] font-bold text-slate-300 mb-1.5 flex items-center justify-between">
            <span>Acción / Operación</span>
            <span className="text-[10px] text-cyan-300/80 font-normal">Click para cambiar</span>
          </label>

          {/* Botón Trigger de Acción */}
          <button
            type="button"
            onClick={() => setIsActionOpen(!isActionOpen)}
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 shadow-inner transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border shadow-sm"
                style={{
                  backgroundColor: `${currentActionMeta.color}22`,
                  borderColor: `${currentActionMeta.color}50`,
                  color: currentActionMeta.color,
                }}
              >
                <ActionIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-black text-white truncate group-hover:text-cyan-300 transition-colors">
                  {currentActionMeta.label}
                </div>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ml-2 ${isActionOpen ? 'rotate-180 text-cyan-400' : ''}`} />
          </button>

          {/* Menú Desplegable Glass de Acciones */}
          <AnimatePresence>
            {isActionOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl modal-glass-container border border-cyan-400/30 p-2 shadow-2xl max-h-[340px] overflow-y-auto"
              >
                {ACTION_OPTIONS.map((grp) => (
                  <div key={grp.group} className="mb-2 last:mb-0">
                    <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-cyan-300 border-b border-white/10 mb-1">
                      {grp.group}
                    </div>
                    <div className="space-y-1">
                      {grp.options.map((opt) => {
                        const Icon = opt.icon;
                        const isSelected = opt.type === actionType;
                        return (
                          <button
                            key={opt.type}
                            type="button"
                            onClick={() => {
                              setActionType(opt.type);
                              setIsActionOpen(false);
                              if (opt.type === 'invest') {
                                const hapi = accounts.find((a) => a.code === 'hapi');
                                if (hapi) setAccountId(hapi.id);
                              }
                            }}
                            className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all ${
                              isSelected
                                ? 'bg-sky-500/25 text-white font-black border border-cyan-400/40 shadow-sm'
                                : 'hover:bg-white/10 text-slate-200 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border"
                                style={{
                                   backgroundColor: `${opt.color}20`,
                                   borderColor: `${opt.color}45`,
                                   color: opt.color,
                                }}
                              >
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                              <span className="text-xs font-bold truncate">{opt.label}</span>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 2. Selector de Cuenta Origen con Logo Flotante Real */}
        {!['debt_in', 'debt_service_in'].includes(actionType) && (
          <div className="relative" ref={accountRef}>
            <label className="block text-[11px] font-bold text-slate-300 mb-1.5">
              {actionType === 'transfer' ? 'Desde (Cuenta Origen)' : actionType === 'invest' ? 'Cuenta Broker / Origen' : 'Cuenta / Banco'}
            </label>

            <button
              type="button"
              onClick={() => setIsAccountOpen(!isAccountOpen)}
              className="w-full flex items-center justify-between p-2.5 sm:p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 shadow-inner transition-all text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {selectedAccount?.icon_url ? (
                  <div className="w-7 h-7 shrink-0 flex items-center justify-center">
                    <img src={selectedAccount.icon_url} alt={selectedAccount.name} className="w-full h-full object-contain drop-shadow-md" />
                  </div>
                ) : (
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black shrink-0 shadow-sm"
                    style={{ background: selectedAccount?.color || '#3b82f6' }}
                  >
                    {selectedAccount?.name.slice(0, 2).toUpperCase() || 'CU'}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-black text-white truncate">{selectedAccount?.name || 'Seleccionar cuenta'}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {selectedAccount && (
                  <span className={`text-xs font-black ${(Number(selectedAccount.current_balance) || 0) < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {formatCurrency(Number(selectedAccount.current_balance) || 0)}
                  </span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isAccountOpen ? 'rotate-180 text-cyan-400' : ''}`} />
              </div>
            </button>

            {/* Menú Desplegable de Cuentas */}
            <AnimatePresence>
              {isAccountOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl modal-glass-container border border-cyan-400/30 p-2 shadow-2xl max-h-[280px] overflow-y-auto space-y-1"
                >
                  {visibleAccounts.map((acc) => {
                    const isSelected = acc.id === accountId;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => {
                          setAccountId(acc.id);
                          setIsAccountOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all ${
                          isSelected
                            ? 'bg-sky-500/25 text-white font-black border border-cyan-400/40 shadow-sm'
                            : 'hover:bg-white/10 text-slate-200 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {acc.icon_url ? (
                            <div className="w-6 h-6 shrink-0 flex items-center justify-center">
                              <img src={acc.icon_url} alt={acc.name} className="w-full h-full object-contain" />
                            </div>
                          ) : (
                            <div
                              className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-black shrink-0"
                              style={{ background: acc.color }}
                            >
                              {acc.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <span className="text-xs font-bold truncate">{acc.name}</span>
                        </div>
                          <span className={`text-xs font-black shrink-0 ml-2 ${(Number(acc.current_balance) || 0) < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {formatCurrency(Number(acc.current_balance) || 0)}
                          </span>
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* 3. Selector de Cuenta Destino (Solo Transferencias) */}
        {(actionType === 'transfer' || actionType === 'transferencia') && (
          <div className="relative" ref={destAccountRef}>
            <label className="block text-[11px] font-bold text-slate-300 mb-1.5">Hacia (Cuenta Destino)</label>
            <button
              type="button"
              onClick={() => setIsDestAccountOpen(!isDestAccountOpen)}
              className="w-full flex items-center justify-between p-2.5 sm:p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 shadow-inner transition-all text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {destAccount?.icon_url ? (
                  <div className="w-7 h-7 shrink-0 flex items-center justify-center">
                    <img src={destAccount.icon_url} alt={destAccount.name} className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 text-xs font-bold shrink-0">
                    ➔
                  </div>
                )}
                <span className="text-xs sm:text-sm font-black text-white truncate">
                  {destAccount ? destAccount.name : 'Selecciona cuenta destino...'}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {destAccount && (
                  <span className={`text-xs font-black ${(Number(destAccount.current_balance) || 0) < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {formatCurrency(Number(destAccount.current_balance) || 0)}
                  </span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isDestAccountOpen ? 'rotate-180 text-blue-400' : ''}`} />
              </div>
            </button>

            {/* Dropdown Destino */}
            <AnimatePresence>
              {isDestAccountOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl modal-glass-container border border-blue-400/30 p-2 shadow-2xl max-h-[260px] overflow-y-auto space-y-1"
                >
                  {visibleAccounts
                    .filter((a) => a.id !== accountId)
                    .map((acc) => {
                      const isSelected = acc.id === destinationAccountId;
                      return (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => {
                            setDestinationAccountId(acc.id);
                            setIsDestAccountOpen(false);
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all ${
                            isSelected
                              ? 'bg-blue-600/35 text-white font-black border border-blue-400/40 shadow-sm'
                              : 'hover:bg-white/10 text-slate-200 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {acc.icon_url ? (
                              <div className="w-6 h-6 shrink-0 flex items-center justify-center">
                                <img src={acc.icon_url} alt={acc.name} className="w-full h-full object-contain" />
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-black shrink-0" style={{ background: acc.color }}>
                                {acc.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <span className="text-xs font-bold truncate">{acc.name}</span>
                          </div>
                          <span className={`text-xs font-black shrink-0 ml-2 ${(Number(acc.current_balance) || 0) < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {formatCurrency(Number(acc.current_balance) || 0)}
                          </span>
                        </button>
                      );
                    })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* 4. Activo a Comprar (Inversiones Broker) */}
        {(actionType === 'invest' || actionType === 'inversion') && (
          <div className="p-3.5 rounded-2xl bg-blue-950/40 border border-cyan-500/30 space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-cyan-300 mb-1.5">Activo / ETF a Comprar</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setInvestAsset('sp500');
                    setSharePrice(marketPrices.SP500.price.toFixed(2));
                  }}
                  className={`p-2.5 rounded-xl border flex flex-col text-left transition-all ${
                    investAsset === 'sp500'
                      ? 'bg-blue-600/40 border-cyan-400 text-white shadow-md'
                      : 'bg-white/[0.04] border-white/10 text-slate-300 hover:text-white'
                  }`}
                >
                  <span className="text-xs font-black">S&P 500 (VOO)</span>
                  <span className="text-[10px] text-cyan-300">${marketPrices.SP500.price.toFixed(2)}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    investAsset === 'nasdaq';
                    setInvestAsset('nasdaq');
                    setSharePrice(marketPrices.Nasdaq.price.toFixed(2));
                  }}
                  className={`p-2.5 rounded-xl border flex flex-col text-left transition-all ${
                    investAsset === 'nasdaq'
                      ? 'bg-cyan-600/40 border-cyan-400 text-white shadow-md'
                      : 'bg-white/[0.04] border-white/10 text-slate-300 hover:text-white'
                  }`}
                >
                  <span className="text-xs font-black">NASDAQ-100 (QQQ)</span>
                  <span className="text-[10px] text-cyan-300">${marketPrices.Nasdaq.price.toFixed(2)}</span>
                </button>
              </div>
            </div>

            {/* Precio por Acción */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-cyan-300">Precio por Acción ($)</label>
                <button
                  type="button"
                  onClick={handleUseLivePrice}
                  disabled={loadingPrice}
                  className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Zap className={`w-3 h-3 ${loadingPrice ? 'animate-spin' : ''}`} />
                  Usar cotización actual
                </button>
              </div>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={sharePrice}
                onChange={(e) => setSharePrice(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-slate-900/60 border border-white/10 rounded-xl text-xs sm:text-sm font-bold text-white outline-none focus:border-cyan-400 shadow-inner"
              />
            </div>
          </div>
        )}

        {/* 5. Persona (Para Deudas, Préstamos y Asumir Deuda) */}
        {['loan_out', 'loan_payment', 'debt_in', 'debt_service_in'].includes(actionType) && (
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">Persona</label>
            <div className="relative">
              <User className="w-4 h-4 text-cyan-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                list="persons-datalist"
                value={person}
                onChange={(e) => setPerson(e.target.value)}
                placeholder="Nombre (ej. Nahomi, Jeanpier...)"
                className="w-full pl-9 pr-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-xs sm:text-sm font-semibold text-white outline-none focus:border-cyan-400 shadow-inner transition-all placeholder:text-slate-400"
                required
              />
              <datalist id="persons-datalist">
                {existingPersons.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>

            {/* Badges rápidos de personas frecuentes */}
            {existingPersons.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                <span className="text-[10px] text-cyan-300/70">Frecuentes:</span>
                {existingPersons.slice(0, 4).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPerson(p)}
                    className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white/10 hover:bg-white/20 border border-sky-400/20 text-slate-200 hover:text-white transition-all cursor-pointer"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 6. Monto Total ($ USD) - FILA COMPLETA */}
        <div>
          <label className="block text-[11px] font-bold text-slate-300 mb-1">Monto ($ USD)</label>
          <div className="relative">
            <DollarSign className="w-4 h-4 text-cyan-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full pl-9 pr-3 py-3 bg-black/30 border border-white/12 rounded-xl text-base sm:text-lg font-black font-display text-white outline-none focus:border-cyan-400 focus:bg-black/40 shadow-inner transition-all placeholder:text-slate-400"
              required
            />
          </div>
        </div>

        {/* 7. Fecha y Hora del Movimiento */}
        <div className="flex items-end gap-2.5">
          {/* Fecha (permite escribir directamente con teclado o abrir con el botón de calendario) */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-slate-300">Fecha</label>
              <div className="flex items-center gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => setDate(getLocalTodayDateString())}
                  className={`px-1.5 py-0.5 rounded transition-all font-semibold cursor-pointer ${
                    isToday
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const y = new Date();
                    y.setDate(y.getDate() - 1);
                    const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
                    setDate(yStr);
                  }}
                  className="px-1.5 py-0.5 rounded text-slate-400 hover:text-white transition-all font-semibold cursor-pointer"
                >
                  Ayer
                </button>
              </div>
            </div>

            <div className="relative flex items-center bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 focus-within:border-cyan-400 rounded-xl px-3 py-2 transition-all shadow-inner">
              <input
                ref={dateInputRef}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-transparent text-xs sm:text-sm font-bold text-white outline-none [color-scheme:dark] cursor-pointer"
                required
              />
            </div>
          </div>

          {/* Hora (Bloqueada a la hora actual si es HOY al crear, editable al editar o en otras fechas) */}
          <div className="w-[125px] shrink-0">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-slate-300">Hora</label>
              {!editTransaction && isToday ? (
                <span className="text-[9px] font-bold text-cyan-400 flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" /> Auto
                </span>
              ) : (
                <span className="text-[9px] font-semibold text-slate-400">Manual</span>
              )}
            </div>

            <div
              className={`relative flex items-center border rounded-xl px-3 py-2 transition-all shadow-inner ${
                !editTransaction && isToday
                  ? 'bg-white/[0.02] border-white/5 opacity-85'
                  : 'bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 focus-within:border-cyan-400'
              }`}
            >
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                disabled={!editTransaction && isToday}
                readOnly={!editTransaction && isToday}
                className={`w-full bg-transparent text-xs sm:text-sm font-bold outline-none [color-scheme:dark] ${
                  !editTransaction && isToday ? 'text-slate-400 cursor-not-allowed' : 'text-white cursor-pointer'
                }`}
                required
              />
            </div>
          </div>
        </div>

        {/* 8. Comisión (Para Transferencias e Inversiones) */}
        {(['transfer', 'transferencia', 'invest', 'inversion'].includes(actionType)) && (
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">Comisión ($ opcional)</label>
            <div className="relative">
              <Percent className="w-3.5 h-3.5 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                step="0.01"
                min="0"
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                placeholder="0.00"
                className="w-full pl-9 pr-3 py-2 bg-white/[0.04] border border-white/10 rounded-xl text-xs sm:text-sm font-semibold text-white outline-none focus:border-amber-400 shadow-inner transition-all placeholder:text-slate-400"
              />
            </div>
            {actionType === 'transfer' && destinationAccountId && parsedAmount > 0 && (
              <p className="text-[11px] text-amber-300 mt-1 flex items-center gap-1">
                <Info className="w-3 h-3 shrink-0" />
                {destAccount?.name || 'Destino'} recibirá {formatCurrency(Math.max(0, parsedAmount - parsedCommission))}
              </p>
            )}
          </div>
        )}

        {/* 9. Vista Previa en Vivo de Inversión */}
        {(actionType === 'invest' || actionType === 'inversion') && parsedAmount > 0 && (
          <div className="p-3.5 rounded-2xl bg-blue-950/40 border border-cyan-500/30 text-xs space-y-1.5 shadow-md">
            <div className="flex items-center justify-between font-bold border-b border-cyan-500/20 pb-1 text-cyan-300">
              <span>Resumen de Compra:</span>
              <span className="uppercase font-black text-cyan-300">{investAsset} ({investAsset === 'sp500' ? 'VOO' : 'QQQ'})</span>
            </div>
            <div className="flex items-center justify-between text-slate-200">
              <span>Total Debitado:</span>
              <span className="font-bold text-white">{formatCurrency(parsedAmount)}</span>
            </div>
            {parsedCommission > 0 && (
              <div className="flex items-center justify-between text-amber-300">
                <span>Comisión Broker:</span>
                <span className="font-bold">-{formatCurrency(parsedCommission)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-emerald-400 font-bold">
              <span>Neto a Invertir:</span>
              <span>{formatCurrency(netInvested)}</span>
            </div>
            <div className="flex items-center justify-between text-cyan-300 font-extrabold pt-1 border-t border-cyan-500/20">
              <span>Acciones Estimadas:</span>
              <span>{calculatedShares.toFixed(4)} acc</span>
            </div>
          </div>
        )}

        {/* 10. Detalle / Nota (Opcional) - FILA COMPLETA */}
        <div>
          <label className="block text-[11px] font-bold text-slate-300 mb-1">Detalle / Nota (Opcional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ej. Almuerzo, compras, pago del mes..."
            className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-xs sm:text-sm text-white outline-none focus:border-cyan-400 shadow-inner transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Botones Guardar y Cancelar */}
        <div className="flex items-center gap-2 mt-3">
          {editTransaction && onCancelEdit && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="py-3 px-3.5 rounded-xl font-bold text-xs sm:text-sm text-slate-300 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 transition-all cursor-pointer shrink-0"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 py-3.5 px-4 rounded-xl font-black text-xs sm:text-sm tracking-wide text-white uppercase bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-blue-500 shadow-lg shadow-cyan-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {editTransaction ? <Check className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
                {editTransaction ? 'Guardar Cambios' : 'Guardar Transacción'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
