import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  CheckCircle2,
  List,
  ArrowDownLeft,
  ArrowUpRight,
  HandCoins,
  Banknote,
} from 'lucide-react';
import { Debt } from '../../types/database';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency } from '../../utils/formatters';
import {
  processUnifiedPersonDebtCycles,
  UnifiedRawMovement,
  DebtMovementProcessed,
} from '../../utils/calculations';
import { ModalShell } from '../ui/ModalShell';

interface DebtDetailModalProps {
  personName: string;
  onClose: () => void;
  debt?: Debt;
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  return dateStr.slice(0, 10);
}

function getMovementBadge(mov: DebtMovementProcessed) {
  const rawType = (mov.rawType || '').toLowerCase();

  if (rawType === 'loan_out') {
    return {
      label: 'Préstamo realizado',
      badgeClass: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
      icon: ArrowUpRight,
      color: 'text-emerald-400',
      sign: '+',
    };
  }
  if (rawType === 'debt_service_in') {
    return {
      label: 'Consumo / Servicio',
      badgeClass: 'bg-purple-500/15 text-purple-300 border border-purple-500/30',
      icon: ArrowUpRight,
      color: 'text-emerald-400',
      sign: '+',
    };
  }
  if (rawType === 'loan_payment') {
    return {
      label: 'Cobro recibido',
      badgeClass: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
      icon: ArrowDownLeft,
      color: 'text-cyan-300',
      sign: '-',
    };
  }
  if (rawType === 'debt_in') {
    return {
      label: 'Deuda (Me prestó)',
      badgeClass: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
      icon: HandCoins,
      color: 'text-rose-400',
      sign: '-',
    };
  }
  if (rawType === 'debt_payment') {
    return {
      label: 'Pago realizado',
      badgeClass: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
      icon: Banknote,
      color: 'text-blue-300',
      sign: '+',
    };
  }

  // Fallbacks
  if (mov.type === 'cargo') {
    return {
      label: 'Préstamo realizado',
      badgeClass: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
      icon: ArrowUpRight,
      color: 'text-emerald-400',
      sign: '+',
    };
  }

  return {
    label: 'Abono / Pago',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
    icon: ArrowDownLeft,
    color: 'text-cyan-300',
    sign: '-',
  };
}

export function DebtDetailModal({ personName, onClose, debt }: DebtDetailModalProps) {
  const { debts, debtPayments, transactions, accounts } = useFinance();
  const targetPerson = (personName || debt?.person_name || '').trim();

  // 1. Todas las deudas asociadas a esta persona
  const personDebts = useMemo(() => {
    return debts.filter(
      (d) => d.person_name.toLowerCase().trim() === targetPerson.toLowerCase()
    );
  }, [debts, targetPerson]);

  const debtMap = useMemo(() => new Map(personDebts.map((d) => [d.id, d])), [personDebts]);

  // 2. Unificar movimientos de forma fidedigna y sin duplicados
  const rawMovements = useMemo(() => {
    const accMap = new Map(accounts.map((a) => [a.id, a]));

    // Pagos registrados en debt_payments (Single Source of Truth para deudas)
    const personPayments = debtPayments.filter((p) => debtMap.has(p.debt_id));

    // Transacciones de la persona para enriquecer metadatos (banco, timestamp original)
    const personTxs = transactions.filter((t) => {
      const pMatch = (t.metadata?.person || '').toLowerCase().trim() === targetPerson.toLowerCase();
      return (
        pMatch &&
        ['loan_out', 'loan_payment', 'debt_in', 'debt_service_in', 'debt_payment'].includes(t.type)
      );
    });

    // Mapa de búsqueda de transacciones por fecha y monto
    const txLookup = new Map<string, typeof transactions[0]>();
    personTxs.forEach((t) => {
      const key = `${t.date.slice(0, 10)}_${Math.abs(Number(t.amount))}`;
      txLookup.set(key, t);
    });

    const list: UnifiedRawMovement[] = personPayments.map((p) => {
      const linkedDebt = debtMap.get(p.debt_id);
      const debtType = linkedDebt?.type || 'me_deben';

      const key = `${p.date.slice(0, 10)}_${Math.abs(Number(p.amount))}`;
      const matchedTx = txLookup.get(key);

      // Detectar cuenta bancaria asociada
      const matchedAccount = (matchedTx?.account_id && matchedTx.account_id !== 'all')
        ? accMap.get(matchedTx.account_id)
        : null;
      const isRealBank = matchedAccount && matchedAccount.code !== 'por_cobrar';
      const accountName = isRealBank ? matchedAccount.name : null;
      const accountIconUrl = isRealBank ? matchedAccount.icon_url : null;
      const accountId = isRealBank ? matchedAccount.id : null;

      // Usar nota enriquecida si la transacción tiene una descripción más detallada
      const effectiveNote = (p.note && p.note !== 'Abono') ? p.note : (matchedTx?.note || p.note || '');
      const noteLower = effectiveNote.toLowerCase();

      let resolvedType: string = p.type;
      if (debtType === 'me_deben') {
        if (p.type === 'cargo') {
          resolvedType =
            noteLower.includes('servicio') ||
            noteLower.includes('daño') ||
            noteLower.includes('steam') ||
            noteLower.includes('pizza') ||
            noteLower.includes('xenoverse')
              ? 'debt_service_in'
              : 'loan_out';
        } else {
          resolvedType = 'loan_payment';
        }
      } else {
        if (p.type === 'cargo') {
          resolvedType = 'debt_in';
        } else {
          resolvedType = 'debt_payment';
        }
      }

      // Obtener timestamp exacto para mantener orden milimétrico de creación
      const originalTs = matchedTx?.metadata?.firestore_id
        ? Number(matchedTx.metadata.firestore_id)
        : matchedTx?.created_at
        ? new Date(matchedTx.created_at).getTime()
        : new Date(p.created_at).getTime();

      return {
        id: p.id,
        amount: Number(p.amount) || 0,
        type: resolvedType,
        note: effectiveNote,
        date: p.date,
        created_at: p.created_at,
        debtType,
        originalTs,
        accountId,
        accountName,
        accountIconUrl,
      };
    });

    // Si existe alguna transacción sin pago asociado (caso huérfano extraordinario)
    personTxs.forEach((t) => {
      const alreadyInList = list.some(
        (m) => m.date.slice(0, 10) === t.date.slice(0, 10) && Math.abs(m.amount - Number(t.amount)) < 0.005
      );
      if (!alreadyInList) {
        const matchedAccount = (t.account_id && t.account_id !== 'all')
          ? accMap.get(t.account_id)
          : null;
        const isRealBank = matchedAccount && matchedAccount.code !== 'por_cobrar';
        const accountName = isRealBank ? matchedAccount.name : null;
        const accountIconUrl = isRealBank ? matchedAccount.icon_url : null;
        const accountId = isRealBank ? matchedAccount.id : null;

        list.push({
          id: t.id,
          amount: Number(t.amount) || 0,
          type: t.type,
          note: t.note,
          date: t.date,
          created_at: t.created_at,
          debtType: t.type === 'debt_in' ? 'debo' : 'me_deben',
          originalTs: t.metadata?.firestore_id ? Number(t.metadata.firestore_id) : new Date(t.created_at).getTime(),
          accountId,
          accountName,
          accountIconUrl,
        });
      }
    });

    return list;
  }, [debtPayments, debtMap, transactions, accounts, targetPerson]);

  // 3. Procesar ciclos inteligentes unificados
  const { cycles, allMovements, currentTotalBalance } = useMemo(
    () => processUnifiedPersonDebtCycles(rawMovements),
    [rawMovements]
  );

  // Paginación de ciclos (0 = ciclo actual más reciente, -1 = ver todos)
  const [selectedCycleIndex, setSelectedCycleIndex] = useState<number>(0);

  const displayMovements = useMemo(() => {
    if (selectedCycleIndex === -1) return allMovements;
    return cycles[selectedCycleIndex]?.movements || [];
  }, [selectedCycleIndex, cycles, allMovements]);

  const totalCycles = cycles.length;

  return (
    <ModalShell
      open={true}
      onClose={onClose}
      maxWidth="54rem"
      maxHeight="88vh"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col h-full max-h-[85vh] p-5 sm:p-6 text-white"
      >
        {/* Cabecera del Modal */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl sm:text-2xl font-black text-white capitalize tracking-tight font-display">
                {targetPerson}
              </h2>
              <span
                className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                  currentTotalBalance > 0.005
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : currentTotalBalance < -0.005
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-slate-700/50 text-slate-300 border border-slate-600/40'
                }`}
              >
                {currentTotalBalance > 0.005
                  ? `TE DEBE: ${formatCurrency(currentTotalBalance)}`
                  : currentTotalBalance < -0.005
                  ? `LE DEBES: ${formatCurrency(Math.abs(currentTotalBalance))}`
                  : 'AL DÍA ($0.00)'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Historial unificado de préstamos otorgados y deudas asumidas con balance acumulado
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pestañas de Ciclos */}
        {totalCycles > 0 && (
          <div className="flex items-center gap-2 py-3 overflow-x-auto scrollbar-none shrink-0">
            {cycles.map((cyc, idx) => {
              const isSelected = selectedCycleIndex === idx;
              let label = `Ciclo Histórico ${cyc.cycleIndex} (Saldado)`;
              if (cyc.isCurrent) {
                label = cyc.isFullySettled
                  ? `Ciclo Actual (Saldado)`
                  : `Ciclo Actual (Activo)`;
              }

              return (
                <button
                  key={cyc.cycleIndex}
                  type="button"
                  onClick={() => setSelectedCycleIndex(idx)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-linear-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30 border border-emerald-500/50'
                      : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/50'
                  }`}
                >
                  <span>{label}</span>
                  <span className="opacity-75 text-[11px]">({cyc.movements.length})</span>
                </button>
              );
            })}

            {/* Botón Ver Todos */}
            <button
              type="button"
              onClick={() => setSelectedCycleIndex(-1)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                selectedCycleIndex === -1
                  ? 'bg-linear-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30 border border-emerald-500/50'
                  : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/50'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Ver Todos</span>
              <span className="opacity-75 text-[11px]">({allMovements.length})</span>
            </button>
          </div>
        )}

        {/* Tabla de Movimientos */}
        <div className="flex-1 overflow-y-auto min-h-0 my-2 pr-1">
          {displayMovements.length === 0 ? (
            <div className="py-14 text-center text-slate-400 text-sm">
              No hay movimientos registrados para esta persona.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-160">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] font-black uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-3 text-left w-24">FECHA</th>
                    <th className="py-2.5 px-3 text-left w-36">TIPO</th>
                    <th className="py-2.5 px-3 text-left w-36">BANCO / CUENTA</th>
                    <th className="py-2.5 px-3 text-left">CONCEPTO / NOTA</th>
                    <th className="py-2.5 px-3 text-right w-44">MOVIMIENTO & SALDO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {displayMovements.map((mov) => {
                    const badge = getMovementBadge(mov);
                    const Icon = badge.icon;
                    const isSettled =
                      mov.is_settlement || Math.abs(mov.newBalance) < 0.005;

                    return (
                      <tr
                        key={mov.id}
                        className={`hover:bg-white/2.5 transition-colors ${
                          isSettled ? 'bg-emerald-500/5' : ''
                        }`}
                      >
                        {/* 1. FECHA */}
                        <td className="py-3 px-3 text-xs font-bold text-slate-200 whitespace-nowrap align-middle">
                          {formatDisplayDate(mov.date)}
                        </td>

                        {/* 2. TIPO DE MOVIMIENTO (Badge con icono) */}
                        <td className="py-3 px-3 whitespace-nowrap align-middle">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-bold ${badge.badgeClass}`}
                          >
                            <Icon className="w-3 h-3 shrink-0" />
                            <span>{badge.label}</span>
                          </span>
                        </td>

                        {/* 3. BANCO / CUENTA */}
                        <td className="py-3 px-3 whitespace-nowrap align-middle">
                          {mov.accountName ? (
                            <div className="flex items-center gap-1.5">
                              {mov.accountIconUrl ? (
                                <img
                                  src={mov.accountIconUrl}
                                  alt={mov.accountName}
                                  className="w-4 h-4 rounded-full object-contain shrink-0"
                                />
                              ) : (
                                <div className="w-4 h-4 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-[9px] font-bold text-slate-300 shrink-0">
                                  {mov.accountName.charAt(0)}
                                </div>
                              )}
                              <span className="text-xs font-semibold text-slate-300 truncate max-w-[110px]">
                                {mov.accountName}
                              </span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/5 text-slate-400 border border-white/5">
                              Sin banco
                            </span>
                          )}
                        </td>

                        {/* 4. NOTA / CONCEPTO */}
                        <td className="py-3 px-3 text-xs text-slate-300 leading-relaxed max-w-xs sm:max-w-md align-middle font-medium">
                          {mov.note?.trim() || '-'}
                        </td>

                        {/* 5. MOVIMIENTO & SALDO */}
                        <td className="py-3 px-3 text-right whitespace-nowrap align-middle">
                          {/* Línea Superior: Monto del movimiento con signo y color */}
                          <div className={`font-black text-sm sm:text-base font-display ${badge.color}`}>
                            {badge.sign}
                            {formatCurrency(mov.amount)}
                          </div>

                          {/* Línea Inferior: Saldo neto resultante */}
                          {isSettled ? (
                            <div className="mt-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                Saldada ($0.00)
                              </span>
                            </div>
                          ) : mov.newBalance > 0 ? (
                            <span className="text-xs font-semibold text-emerald-400 block mt-0.5">
                              Te debe {formatCurrency(mov.newBalance)}
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-rose-400 block mt-0.5">
                              Le debes: -{formatCurrency(Math.abs(mov.newBalance))}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer con Resumen y Balance Final */}
        <div className="pt-3 border-t border-white/10 shrink-0">
          <div className="flex items-center justify-between gap-4 pt-2">
            <div>
              <p className="text-xs text-slate-400 font-medium">Estado general de la cuenta:</p>
              <p className="text-xs text-slate-200 font-semibold mt-0.5">
                {currentTotalBalance > 0.005
                  ? `${targetPerson} tiene saldo pendiente a tu favor`
                  : currentTotalBalance < -0.005
                  ? `Tienes saldo pendiente por pagarle a ${targetPerson}`
                  : `Todas las cuentas con ${targetPerson} están completamente saldadas ($0.00)`}
              </p>
            </div>

            <div className="text-right">
              <span
                className={`text-xl sm:text-2xl font-black font-display tracking-tight ${
                  currentTotalBalance > 0.005
                    ? 'text-emerald-400'
                    : currentTotalBalance < -0.005
                    ? 'text-rose-400'
                    : 'text-slate-400'
                }`}
              >
                {currentTotalBalance > 0.005
                  ? `Te debe: ${formatCurrency(currentTotalBalance)}`
                  : currentTotalBalance < -0.005
                  ? `Le debes: ${formatCurrency(Math.abs(currentTotalBalance))}`
                  : 'Totalmente Saldado ($0.00)'}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </ModalShell>
  );
}
