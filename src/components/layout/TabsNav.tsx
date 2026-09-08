import React from 'react';
import { PlusCircle, History, Users, PieChart, TrendingUp } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';

export type ActiveTab = 'history' | 'debts' | 'summary' | 'projections';

interface TabsNavProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenNewTransaction: () => void;
}

export function TabsNav({ activeTab, onTabChange, onOpenNewTransaction }: TabsNavProps) {
  const { debts } = useFinance();
  const activeDebtsCount = debts.filter((d) => d.status === 'active' && Math.abs(Number(d.current_balance)) > 0.005).length;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-2xl glass-panel border border-white/10 mb-6">
      {/* Pestañas de Navegación */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 w-full sm:w-auto">
        {/* Historial */}
        <button
          onClick={() => onTabChange('history')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
            activeTab === 'history'
              ? 'bg-gradient-to-r from-sky-500/30 to-blue-600/35 text-white border border-cyan-400/50 shadow-md shadow-cyan-500/20'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <History className="w-4 h-4 text-cyan-400" />
          <span>Historial</span>
        </button>

        {/* Deudas Activas */}
        <button
          onClick={() => onTabChange('debts')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 relative cursor-pointer ${
            activeTab === 'debts'
              ? 'bg-gradient-to-r from-blue-600/35 to-indigo-600/35 text-white border border-blue-400/50 shadow-md shadow-blue-500/20'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <Users className="w-4 h-4 text-blue-400" />
          <span>Deudas Activas</span>
          {activeDebtsCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-cyan-500 text-slate-950">
              {activeDebtsCount}
            </span>
          )}
        </button>

        {/* Resumen */}
        <button
          onClick={() => onTabChange('summary')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
            activeTab === 'summary'
              ? 'bg-gradient-to-r from-indigo-600/35 to-blue-600/35 text-white border border-indigo-400/50 shadow-md shadow-indigo-500/20'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <PieChart className="w-4 h-4 text-indigo-400" />
          <span>Resumen</span>
        </button>

        {/* Proyección */}
        <button
          onClick={() => onTabChange('projections')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
            activeTab === 'projections'
              ? 'bg-gradient-to-r from-teal-600/35 to-cyan-600/35 text-white border border-teal-400/50 shadow-md shadow-teal-500/20'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-teal-400" />
          <span>Proyección</span>
        </button>
      </div>

      {/* Botón flotante móvil para nueva transacción */}
      <button
        onClick={onOpenNewTransaction}
        className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-cyan-500/20 transition-all ml-auto"
      >
        <PlusCircle className="w-3.5 h-3.5" />
        <span>+ Movimiento</span>
      </button>
    </div>
  );
}
