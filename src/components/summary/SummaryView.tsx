import React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { PieChart, ArrowDownRight, ArrowUpRight, Wallet, TrendingUp } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency, formatPercentage } from '../../utils/formatters';

ChartJS.register(ArcElement, Tooltip, Legend);

export function SummaryView() {
  const { accounts, transactions, netWorth } = useFinance();

  // Agrupación de saldos por tipo
  const typeLabels: Record<string, string> = {
    banco: 'Bancos Tradicionales',
    billetera: 'Billeteras Digitales',
    broker: 'Inversiones (Broker)',
    cripto: 'Criptomonedas',
    efectivo: 'Efectivo',
    deuda: 'Por Cobrar',
  };

  const typeColors: Record<string, string> = {
    banco: '#3b82f6',
    billetera: '#06b6d4',
    broker: '#8b5cf6',
    cripto: '#eab308',
    efectivo: '#10b981',
    deuda: '#ec4899',
  };

  const balancesByType = accounts.reduce((acc, account) => {
    const t = account.type || 'banco';
    let val = Number(account.current_balance) || 0;
    if (account.code === 'hapi' && account.metadata) {
      val += (Number(account.metadata.sp500_balance) || 0) + (Number(account.metadata.nasdaq_balance) || 0);
    }
    acc[t] = (acc[t] || 0) + val;
    return acc;
  }, {} as Record<string, number>);

  const typesList = Object.keys(balancesByType).filter((t) => balancesByType[t] > 0);

  // Totales de ingresos y gastos del mes actual
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthlyTransactions = transactions.filter((tx) => {
    const d = new Date(tx.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const totalMonthlyIncome = monthlyTransactions
    .filter((tx) => tx.type === 'ingreso')
    .reduce((sum, tx) => sum + Number(tx.amount), 0);

  const totalMonthlyExpense = monthlyTransactions
    .filter((tx) => tx.type === 'gasto')
    .reduce((sum, tx) => sum + Number(tx.amount), 0);

  const monthlySavings = totalMonthlyIncome - totalMonthlyExpense;

  const chartData = {
    labels: typesList.map((t) => typeLabels[t] || t),
    datasets: [
      {
        data: typesList.map((t) => balancesByType[t]),
        backgroundColor: typesList.map((t) => typeColors[t] || '#64748b'),
        borderColor: '#07090e',
        borderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: '#cbd5e1',
          font: { family: 'Inter', size: 11 },
          usePointStyle: true,
          boxWidth: 8,
          padding: 12,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: '#ffffff',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: function (context: any) {
            const val = context.parsed;
            const pct = netWorth > 0 ? ((val / netWorth) * 100).toFixed(1) : 0;
            return ` ${context.label}: ${formatCurrency(val)} (${pct}%)`;
          },
        },
      },
    },
    cutout: '70%',
  };

  return (
    <div className="w-full space-y-6">
      {/* KPIs del Mes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl glass-panel border border-emerald-500/20 bg-gradient-to-br from-emerald-950/20 to-black/40">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-emerald-400 mb-1">
            <span>Ingresos del Mes</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-display text-emerald-300">
            {formatCurrency(totalMonthlyIncome)}
          </div>
        </div>

        <div className="p-5 rounded-3xl glass-panel border border-rose-500/20 bg-gradient-to-br from-rose-950/20 to-black/40">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-rose-400 mb-1">
            <span>Gastos del Mes</span>
            <ArrowDownRight className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black font-display text-rose-300">
            {formatCurrency(totalMonthlyExpense)}
          </div>
        </div>

        <div className="p-5 rounded-3xl glass-panel border border-cyan-500/20 bg-gradient-to-br from-cyan-950/20 to-black/40">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-cyan-400 mb-1">
            <span>Flujo / Ahorro Neto</span>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <div className={`text-2xl font-black font-display ${monthlySavings >= 0 ? 'text-cyan-300' : 'text-rose-400'}`}>
            {formatCurrency(monthlySavings)}
          </div>
        </div>
      </div>

      {/* Distribución de Activos */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 rounded-3xl glass-panel p-6 border border-white/10 flex flex-col items-center justify-between min-h-[340px]">
          <div className="w-full flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
              <PieChart className="w-4 h-4 text-purple-400" />
              Distribución Gráfica
            </span>
            <span className="text-xs font-black text-cyan-400">
              Total: {formatCurrency(netWorth)}
            </span>
          </div>
          <div className="w-full h-56 relative flex items-center justify-center">
            <Doughnut data={chartData} options={chartOptions} />
          </div>
        </div>

        <div className="lg:col-span-7 rounded-3xl glass-panel p-6 border border-white/10 space-y-4">
          <h3 className="text-base font-black font-display text-white pb-3 border-b border-white/10">
            Desglose por Categoría de Activo
          </h3>

          <div className="space-y-3.5">
            {typesList.map((t) => {
              const val = balancesByType[t];
              const pct = netWorth > 0 ? (val / netWorth) * 100 : 0;
              const color = typeColors[t] || '#3b82f6';

              return (
                <div key={t} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-300 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                      {typeLabels[t] || t}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-white font-extrabold">{formatCurrency(val)}</span>
                      <span className="text-slate-400 w-12 text-right">{pct.toFixed(1)}%</span>
                    </div>
                  </div>
                  {/* Barra de Progreso */}
                  <div className="w-full h-2 rounded-full bg-black/40 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, pct)}%`, background: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
