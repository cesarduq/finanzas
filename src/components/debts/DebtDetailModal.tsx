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
import { Debt, DebtPayment } from '../../types/database';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency } from '../../utils/formatters';
import { processDebtCycles, DebtMovementProcessed } from '../../utils/calculations';
import { ModalShell } from '../ui/ModalShell';

interface DebtDetailModalProps {
  debt: Debt;
  onClose: () => void;
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  return dateStr.slice(0, 10);
}

function getMovementBadge(mov: DebtMovementProcessed, debt: Debt) {
  const rawType = (mov.rawType || '').toLowerCase();
  const note = (mov.note || '').toLowerCase();
  const isCargo = mov.type === 'cargo';

  if (rawType === 'loan_out') {
    return {
      label: 'Préstamo',
      badgeClass: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
      icon: ArrowUpRight,
      color: 'text-amber-400',
    };
  }
  if (rawType === 'loan_payment') {
    return {
      label: 'Cobro',
      badgeClass: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
      icon: ArrowDownLeft,
      color: 'text-emerald-400',
    };
  }
  if (rawType === 'debt_in') {
    return {
      label: 'Deuda Asumida',
      badgeClass: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
      icon: HandCoins,
      color: 'text-rose-400',
    };
  }
  if (rawType === 'debt_payment') {
    return {
      label: 'Pago Deuda',
      badgeClass: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
      icon: Banknote,
      color: 'text-blue-400',
    };
  }

  // Detección contextual por notas comunes en el historial
  const isDeudaAsumida =
    !isCargo &&
    (/\b(pedidos ya|pedidosya|kfc|pizza|hamburguesa|cajun|buffalos|delivery|asum|alitas|me dio pagando|me dio pidiendo|me pago una|comi yo)\b/i.test(note) ||
      debt.type === 'debo');

  if (isDeudaAsumida) {
    return {
      label: 'Deuda Asumida',
      badgeClass: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
      icon: HandCoins,
      color: 'text-rose-400',
    };
  }

  if (!isCargo) {
    return {
      label: 'Cobro',
      badgeClass: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
      icon: ArrowDownLeft,
      color: 'text-emerald-400',
    };
  }

  return {
    label: 'Préstamo',
    badgeClass: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
    icon: ArrowUpRight,
    color: 'text-amber-400',
  };
}

export function DebtDetailModal({ debt, onClose }: DebtDetailModalProps) {
  const { debtPayments } = useFinance();

  // Filtrar pagos de esta persona/deuda
  const relatedPayments = useMemo(
    () => debtPayments.filter((p) => p.debt_id === debt.id),
    [debtPayments, debt.id]
  );

  const { cycles, allMovements, currentTotalBalance } = useMemo(
    () => processDebtCycles(relatedPayments),
    [relatedPayments]
  );

  // Paginación de ciclos (0 = ciclo actual más reciente, -1 = ver todos)
  const [selectedCycleIndex, setSelectedCycleIndex] = useState<number>(0);

  const displayMovements = useMemo(() => {
    if (selectedCycleIndex === -1) return allMovements;
    return cycles[selectedCycleIndex]?.movements || [];
  }, [selectedCycleIndex, cycles, allMovements]);

  const totalCycles = cycles.length;


  return (
    <ModalShell onClose={onClose} maxWidth="64rem" maxHeight="92vh">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="relative w-full flex flex-col p-5 sm:p-6 text-white overflow-hidden" style={{ maxHeight: '88vh' }}
      >
          {/* Header del Modal */}
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10 shrink-0">
            <div>
              <h2 className="text-xl sm:text-2xl font-black font-display text-white">
                Historial: {debt.person_name}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Detalle de movimientos y ciclos de deuda
              </p>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Selector / Barra de Navegación de Ciclos */}
          {totalCycles > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto py-3 scrollbar-none shrink-0 border-b border-white/5">
              {cycles.map((cyc, idx) => {
                const isCurrent = idx === 0;
                const isSelected = selectedCycleIndex === idx;
                let label = '';
                if (isCurrent) {
                  label = cyc.isFullySettled
                    ? 'Ciclo Actual (Saldado)'
                    : 'Ciclo Actual (Activo)';
                } else {
                  label = `Ciclo Histórico ${totalCycles - idx} (${cyc.isFullySettled ? 'Saldado' : 'Cerrado'
                    })`;
                }

                return (
                  <button
                    key={cyc.cycleIndex}
                    type="button"
                    onClick={() => setSelectedCycleIndex(idx)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${isSelected
                        ? 'bg-linear-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30 border border-purple-500/50'
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
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${selectedCycleIndex === -1
                    ? 'bg-linear-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30 border border-purple-500/50'
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
                No hay movimientos registrados para esta selección.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-155">
                  <thead>
                    <tr className="border-b border-white/10 text-[11px] font-black uppercase tracking-wider text-slate-400">
                      <th className="py-2.5 px-3 text-left w-26.25">FECHA</th>
                      <th className="py-2.5 px-3 text-left w-32.5">MOVIMIENTO</th>
                      <th className="py-2.5 px-3 text-left">NOTA</th>
                      <th className="py-2.5 px-3 text-right w-31.25">MONTO</th>
                      <th className="py-2.5 px-3 text-right w-35">SALDO DEUDA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {displayMovements.map((mov) => {
                      const badge = getMovementBadge(mov, debt);
                      const Icon = badge.icon;
                      const isSettled =
                        mov.is_settlement || Math.abs(mov.newBalance) < 0.005;

                      return (
                        <tr
                          key={mov.id}
                          className={`hover:bg-white/2.5 transition-colors ${isSettled ? 'bg-emerald-500/3' : ''
                            }`}
                        >
                          {/* 1. FECHA */}
                          <td className="py-3 px-3 text-xs font-bold text-slate-200 whitespace-nowrap align-middle">
                            {formatDisplayDate(mov.date)}
                          </td>

                          {/* 2. MOVIMIENTO (Badge con icono) */}
                          <td className="py-3 px-3 whitespace-nowrap align-middle">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-bold ${badge.badgeClass}`}
                            >
                              <Icon className="w-3 h-3 shrink-0" />
                              <span>{badge.label}</span>
                            </span>
                          </td>

                          {/* 3. NOTA */}
                          <td className="py-3 px-3 text-xs text-slate-300 leading-relaxed max-w-xs sm:max-w-md align-middle">
                            {mov.note?.trim() || '-'}
                          </td>

                          {/* 4. MONTO + DEUDA PREVIA */}
                          <td className="py-3 px-3 text-right whitespace-nowrap align-middle">
                            <div>
                              <span className={`font-black text-sm ${badge.color}`}>
                                {formatCurrency(mov.amount)}
                              </span>
                              <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">
                                Deuda previa:{' '}
                                {formatCurrency(Math.abs(mov.previousBalance))}
                              </span>
                            </div>
                          </td>

                          {/* 5. SALDO RESULTANTE */}
                          <td className="py-3 px-3 text-right whitespace-nowrap align-middle">
                            {isSettled ? (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white text-slate-900 font-extrabold text-[11px] shadow-sm">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 fill-emerald-100" />
                                <span>Saldada ($0.00)</span>
                              </div>
                            ) : (
                              <div>
                                <span
                                  className={`font-black text-sm ${mov.newBalance > 0
                                      ? 'text-emerald-400'
                                      : 'text-rose-400'
                                    }`}
                                >
                                  {formatCurrency(Math.abs(mov.newBalance))}
                                </span>
                                <span
                                  className={`text-[10px] block mt-0.5 font-bold ${mov.newBalance > 0
                                      ? 'text-emerald-500'
                                      : 'text-rose-500'
                                    }`}
                                >
                                  {mov.newBalance > 0 ? 'Te debe' : 'Le debes'}
                                </span>
                              </div>
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

          {/* Footer de Saldo */}
          <div className="pt-3 border-t border-white/10 shrink-0">

            {/* Footer con Resumen y Saldo Final */}
            <div className="flex items-center justify-between gap-4 pt-2">
              <div>
                <p className="text-xs text-slate-400 font-medium">Estado actual de la cuenta:</p>
                <p className="text-xs text-slate-200 font-semibold mt-0.5">
                  {currentTotalBalance > 0.005
                    ? 'Cuenta activa con saldo pendiente a tu favor'
                    : currentTotalBalance < -0.005
                      ? 'Cuenta activa con saldo pendiente que debes saldar'
                      : 'Todas las deudas han sido saldadas en $0.00'}
                </p>
              </div>

              <div className="text-right">
                <span
                  className={`text-xl sm:text-2xl font-black font-display tracking-tight ${currentTotalBalance > 0.005
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
