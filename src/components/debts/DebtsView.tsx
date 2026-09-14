import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { Debt } from '../../types/database';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { DebtDetailModal } from './DebtDetailModal';

interface PersonSummary {
  personName: string;
  totalMeDeben: number;
  totalDebo: number;
  netBalance: number;
  isSettled: boolean;
  movementsCount: number;
  lastDate: string;
}

export function DebtsView() {
  const { debts, transactions, debtPayments } = useFinance();
  const [filterTab, setFilterTab] = useState<'all' | 'me_deben' | 'debo' | 'settled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);

  // Agrupar deudas por persona de forma unificada
  const personsList = useMemo(() => {
    const personMap = new Map<
      string,
      {
        personName: string;
        debts: Debt[];
      }
    >();

    debts.forEach((d) => {
      if (!d.person_name) return;
      const key = d.person_name.trim().toLowerCase();
      if (!personMap.has(key)) {
        personMap.set(key, {
          personName: d.person_name.trim(),
          debts: [],
        });
      }
      personMap.get(key)!.debts.push(d);
    });

    const list: PersonSummary[] = Array.from(personMap.values()).map((p) => {
      const meDebenDebts = p.debts.filter((d) => d.type === 'me_deben');
      const deboDebts = p.debts.filter((d) => d.type === 'debo');

      const totalMeDeben = meDebenDebts.reduce(
        (sum, d) => sum + (Number(d.current_balance) || 0),
        0
      );
      const totalDebo = deboDebts.reduce(
        (sum, d) => sum + (Number(d.current_balance) || 0),
        0
      );
      const netBalance = totalMeDeben - totalDebo;
      const isSettled = Math.abs(netBalance) < 0.005;

      // Conteo de movimientos y última fecha
      const personNorm = p.personName.toLowerCase();
      const personTxs = transactions.filter((t) => {
        const rawNote = (t.note || '').toLowerCase();
        const tPerson = (t.metadata?.person || '').toLowerCase();
        return (
          tPerson === personNorm ||
          rawNote.includes(personNorm)
        );
      });

      const debtIds = new Set(p.debts.map((d) => d.id));
      const personPayments = debtPayments.filter((dp) => debtIds.has(dp.debt_id));

      const count = Math.max(personPayments.length, personTxs.length, p.debts.length);

      const dates = [
        ...p.debts.map((d) => d.created_at),
        ...personTxs.map((t) => t.date || t.created_at),
        ...personPayments.map((dp) => dp.date || dp.created_at),
      ]
        .filter(Boolean)
        .sort();

      const lastDate = dates.length > 0 ? dates[dates.length - 1] : '';

      return {
        personName: p.personName,
        totalMeDeben,
        totalDebo,
        netBalance,
        isSettled,
        movementsCount: count,
        lastDate,
      };
    });

    // Ordenar: deudas activas primero (mayor saldo neto absoluto), saldadas al final
    return list.sort((a, b) => {
      if (!a.isSettled && b.isSettled) return -1;
      if (a.isSettled && !b.isSettled) return 1;
      return Math.abs(b.netBalance) - Math.abs(a.netBalance);
    });
  }, [debts, transactions, debtPayments]);

  // Contadores para pestañas de filtro
  const counts = useMemo(() => {
    return {
      all: personsList.length,
      me_deben: personsList.filter((p) => p.netBalance > 0.005).length,
      debo: personsList.filter((p) => p.netBalance < -0.005).length,
      settled: personsList.filter((p) => p.isSettled).length,
    };
  }, [personsList]);

  // Lista filtrada según búsqueda y pestaña activa
  const filteredPersons = useMemo(() => {
    return personsList.filter((p) => {
      // Filtro de pestaña
      if (filterTab === 'me_deben' && p.netBalance <= 0.005) return false;
      if (filterTab === 'debo' && p.netBalance >= -0.005) return false;
      if (filterTab === 'settled' && !p.isSettled) return false;

      // Filtro de búsqueda
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        if (!p.personName.toLowerCase().includes(q)) return false;
      }

      return true;
    });
  }, [personsList, filterTab, searchQuery]);

  return (
    <div className="w-full space-y-4">
      {/* Contenedor Principal Unificado */}
      <div className="w-full rounded-3xl glass-panel p-4 sm:p-6 border border-white/10 shadow-2xl space-y-5">
        {/* Cabecera y Filtros */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Selector de Pestañas Rápidas */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-black/40 border border-white/10 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                filterTab === 'all'
                  ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Todos ({counts.all})
            </button>
            <button
              onClick={() => setFilterTab('me_deben')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                filterTab === 'me_deben'
                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Te Deben ({counts.me_deben})
            </button>
            <button
              onClick={() => setFilterTab('debo')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                filterTab === 'debo'
                  ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Debes ({counts.debo})
            </button>
            <button
              onClick={() => setFilterTab('settled')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                filterTab === 'settled'
                  ? 'bg-slate-500/25 text-slate-300 border border-slate-400/40 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Al Día ({counts.settled})
            </button>
          </div>

          {/* Buscador de Persona */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar persona..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-1.5 rounded-2xl bg-black/40 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
          </div>
        </div>

        {/* Listado de Tarjetas Compactas: 2 por Fila */}
        {filteredPersons.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-30 text-slate-400" />
            <p className="font-semibold text-sm text-slate-300">
              No se encontraron registros
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? `No hay personas que coincidan con "${searchQuery}".`
                : 'Registra una transacción con categoría de préstamo o deuda para verla aquí.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-3.5">
            {filteredPersons.map((person) => {
              const initial = person.personName.charAt(0).toUpperCase();

              return (
                <div
                  key={person.personName}
                  onClick={() => setSelectedPerson(person.personName)}
                  className={`px-4 py-3.5 sm:px-5 sm:py-4 rounded-2xl border cursor-pointer transition-all duration-200 hover:-translate-y-0.5 relative group flex items-center justify-between gap-3.5 ${
                    person.isSettled
                      ? 'bg-black/25 border-white/5 opacity-65 hover:opacity-100 hover:border-white/20'
                      : person.netBalance > 0
                      ? 'bg-gradient-to-r from-emerald-950/20 via-black/40 to-black/50 border-emerald-500/20 hover:border-emerald-500/45 hover:shadow-lg hover:shadow-emerald-500/10'
                      : 'bg-gradient-to-r from-rose-950/20 via-black/40 to-black/50 border-rose-500/20 hover:border-rose-500/45 hover:shadow-lg hover:shadow-rose-500/10'
                  }`}
                >
                  {/* Lado Izquierdo: Avatar + Nombre + Movimientos */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center font-black text-sm shadow-inner ${
                        person.isSettled
                          ? 'bg-slate-800 text-slate-300 border border-slate-700'
                          : person.netBalance > 0
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      {initial}
                    </div>

                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight group-hover:text-cyan-300 transition-colors truncate">
                        {person.personName}
                      </h3>
                      <span className="text-[11px] text-slate-400 block truncate">
                        {person.movementsCount}{' '}
                        {person.movementsCount === 1 ? 'mov.' : 'mov.'}
                        {person.lastDate ? ` · ${formatDate(person.lastDate)}` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Lado Derecho: Saldo Neto Prominente + Flecha */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      {person.isSettled ? (
                        <span className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-slate-400">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          $0.00
                        </span>
                      ) : person.netBalance > 0 ? (
                        <span className="text-emerald-400 font-black font-display text-lg sm:text-xl drop-shadow-sm">
                          +{formatCurrency(person.netBalance)}
                        </span>
                      ) : (
                        <span className="text-rose-400 font-black font-display text-lg sm:text-xl drop-shadow-sm">
                          -{formatCurrency(Math.abs(person.netBalance))}
                        </span>
                      )}
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Unificado de Ciclos e Historial por Persona */}
      {selectedPerson && (
        <DebtDetailModal
          personName={selectedPerson}
          onClose={() => setSelectedPerson(null)}
        />
      )}
    </div>
  );
}
