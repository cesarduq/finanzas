import React, { useState } from 'react';
import { Users, Plus, ArrowUpRight, ArrowDownRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { Debt } from '../../types/database';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { DebtDetailModal } from './DebtDetailModal';
import { ModalShell } from '../ui/ModalShell';

export function DebtsView() {
  const { debts, createDebt } = useFinance();
  const [debtTypeFilter, setDebtTypeFilter] = useState<'me_deben' | 'debo'>('me_deben');
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Estados para nueva deuda
  const [newPersonName, setNewPersonName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(false);

  // Métricas totales
  const totalMeDeben = debts
    .filter((d) => d.type === 'me_deben' && d.status === 'active')
    .reduce((sum, d) => sum + (Number(d.current_balance) || 0), 0);

  const totalDebo = debts
    .filter((d) => d.type === 'debo' && d.status === 'active')
    .reduce((sum, d) => sum + (Number(d.current_balance) || 0), 0);

  const filteredDebts = debts.filter((d) => d.type === debtTypeFilter);

  const handleCreateDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(newAmount);
    if (!newPersonName.trim() || isNaN(num) || num <= 0) return;

    setLoading(true);
    await createDebt(newPersonName.trim(), debtTypeFilter, num, newNote);
    setLoading(false);
    setNewPersonName('');
    setNewAmount('');
    setNewNote('');
    setShowCreateModal(false);
  };

  return (
    <div className="w-full space-y-6">
      {/* Tarjetas de Métricas de Deuda */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Total Me Deben */}
        <div className="p-5 rounded-3xl glass-panel border border-emerald-500/20 bg-gradient-to-br from-emerald-950/30 to-black/40 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Total Por Cobrar (Me Deben)
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-display text-white">
            {formatCurrency(totalMeDeben)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {debts.filter((d) => d.type === 'me_deben' && d.status === 'active').length} personas activas
          </div>
        </div>

        {/* Total Debo */}
        <div className="p-5 rounded-3xl glass-panel border border-rose-500/20 bg-gradient-to-br from-rose-950/30 to-black/40 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
              Total Por Pagar (Debo)
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-400">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-display text-white">
            {formatCurrency(totalDebo)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {debts.filter((d) => d.type === 'debo' && d.status === 'active').length} deudas activas
          </div>
        </div>
      </div>

      {/* Contenedor Principal de Deudas */}
      <div className="w-full rounded-3xl glass-panel p-5 sm:p-7 border border-white/10 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          {/* Selector de Pestaña: Me Deben vs Debo */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-black/40 border border-white/10">
            <button
              onClick={() => setDebtTypeFilter('me_deben')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                debtTypeFilter === 'me_deben'
                  ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Me Deben ({debts.filter((d) => d.type === 'me_deben').length})
            </button>
            <button
              onClick={() => setDebtTypeFilter('debo')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                debtTypeFilter === 'debo'
                  ? 'bg-rose-500/30 text-rose-300 border border-rose-500/40 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Debo ({debts.filter((d) => d.type === 'debo').length})
            </button>
          </div>

          {/* Botón Crear Nueva Deuda */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-600/25 transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Deuda / Persona</span>
          </button>
        </div>

        {/* Lista de Personas / Deudas */}
        {filteredDebts.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="font-semibold text-sm">No tienes registros en esta categoría</p>
            <p className="text-xs text-slate-500 mt-1">
              Agrega una persona o préstamo usando el botón superior.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredDebts.map((d) => {
              const isSettled = d.status === 'settled' || Number(d.current_balance) === 0;

              return (
                <div
                  key={d.id}
                  onClick={() => setSelectedDebt(d)}
                  className={`p-4 sm:p-5 rounded-2xl border cursor-pointer transition-all duration-300 hover:-translate-y-1 ${
                    isSettled
                      ? 'bg-black/20 border-white/5 opacity-60 hover:opacity-100'
                      : 'bg-black/40 border-white/10 hover:border-cyan-400/40 hover:shadow-xl hover:shadow-cyan-500/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <h3 className="text-base font-extrabold text-white tracking-tight">
                        {d.person_name}
                      </h3>
                      <span className="text-[11px] text-slate-400">
                        Iniciado: {formatDate(d.created_at)}
                      </span>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        isSettled
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {isSettled ? 'Saldada ($0.00)' : 'Pendiente'}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between mt-3 pt-3 border-t border-white/10">
                    <span className="text-xs text-slate-400 font-medium">Saldo Pendiente:</span>
                    <span
                      className={`text-xl font-black font-display ${
                        isSettled ? 'text-slate-400 line-through' : 'text-cyan-400'
                      }`}
                    >
                      {formatCurrency(Number(d.current_balance))}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Detalle de Deuda (Ciclos Inteligentes) */}
      {selectedDebt && (
        <DebtDetailModal
          debt={selectedDebt}
          onClose={() => setSelectedDebt(null)}
        />
      )}

      {/* Modal Crear Nueva Deuda */}
      {showCreateModal && (
        <ModalShell onClose={() => setShowCreateModal(false)} maxWidth="28rem">
          <div className="relative p-6 text-white">
            <h3 className="text-lg font-black font-display mb-4">
              Registrar Nueva Deuda ({debtTypeFilter === 'me_deben' ? 'Me Deben' : 'Le Debo'})
            </h3>

            <form onSubmit={handleCreateDebt} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Nombre de la Persona
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Carlos Mendoza"
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-black/40 border border-white/15 rounded-xl text-sm text-white outline-none focus:border-cyan-400"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Monto Inicial ($ USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="w-full px-4 py-2.5 bg-black/40 border border-white/15 rounded-xl text-lg font-black text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Nota / Concepto (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej. Préstamo personal para reparación"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="w-full px-4 py-2.5 bg-black/40 border border-white/15 rounded-xl text-sm text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-cyan-500/25"
                >
                  {loading ? 'Creando...' : 'Crear Registro'}
                </button>
              </div>
            </form>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
