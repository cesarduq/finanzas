import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  DollarSign,
  Calendar,
  Percent,
  ShieldCheck,
  Zap,
  PiggyBank,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Wallet,
  Activity,
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency } from '../../utils/formatters';
import { calculateInvestmentProjection, calculateRetirementPension } from '../../utils/calculations';
import { getCachedMarketPrices, fetchLiveMarketPrices, LiveMarketPrices } from '../../utils/marketPrices';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export function ProjectionView() {
  const { accounts, transactions, investmentSettings, updateInvestmentSettings } = useFinance();

  // Precios en vivo de Yahoo Finance
  const [marketPrices, setMarketPrices] = useState<LiveMarketPrices>(() => getCachedMarketPrices());
  const [isRefreshingPrices, setIsRefreshingPrices] = useState(false);

  // Estados interactivos para proyección independiente
  const [years, setYears] = useState<number>(investmentSettings.years || 30);
  const [spMonthly, setSpMonthly] = useState<number>(600);
  const [spRate, setSpRate] = useState<number>(investmentSettings.sp500_annual_rate || 10.0);
  const [nasdaqMonthly, setNasdaqMonthly] = useState<number>(200);
  const [nasdaqRate, setNasdaqRate] = useState<number>(investmentSettings.nasdaq_annual_rate || 13.0);
  const [showTable, setShowTable] = useState<boolean>(true);

  // Actualizar cotizaciones en vivo
  const handleRefreshPrices = async () => {
    setIsRefreshingPrices(true);
    try {
      const updated = await fetchLiveMarketPrices();
      setMarketPrices(updated);
    } catch (err) {
      console.warn('Error al actualizar precios en vivo', err);
    } finally {
      setIsRefreshingPrices(false);
    }
  };

  // Cálculo automático y dinámico de métricas de portafolio para S&P 500 y NASDAQ-100
  const assetStats = useMemo(() => {
    const hapiAcc = accounts.find((a) => a.code === 'hapi');

    const computeAsset = (assetKey: 'sp500' | 'nasdaq') => {
      const isSp = assetKey === 'sp500';
      const ticker = isSp ? 'VOO' : 'QQQ';
      const name = isSp ? 'S&P 500 (VOO)' : 'NASDAQ-100 (QQQ)';
      const returnPctDefault = isSp
        ? (hapiAcc?.metadata?.sp500_return ?? 0.7)
        : (hapiAcc?.metadata?.nasdaq_return ?? 146.0);

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
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });

      const buyTxs = assetTxs.filter((t) => !(t.note || '').toLowerCase().startsWith('venta'));
      const firstTx = buyTxs[0];

      let runningInvested = 0;
      let runningShares = 0;

      assetTxs.forEach((tx) => {
        const amount = Number(tx.amount) || 0;
        const shares = Number(tx.metadata?.shares) || 0;
        const isSell = (tx.note || '').toLowerCase().startsWith('venta');
        if (isSell) {
          runningInvested = Math.max(0, Math.round((runningInvested - amount) * 100) / 100);
          runningShares = Math.max(0, runningShares - shares);
        } else {
          runningInvested = Math.round((runningInvested + amount) * 100) / 100;
          runningShares = runningShares + shares;
        }
      });

      const totalInvested =
        runningInvested > 0
          ? runningInvested
          : isSp
          ? (hapiAcc?.metadata?.sp500_balance ?? 853.08)
          : (hapiAcc?.metadata?.nasdaq_balance ?? 366.11);

      const totalShares =
        runningShares > 0
          ? runningShares
          : isSp
          ? 1.2130
          : 1.2529;

      const avgCost = totalShares > 0 ? Math.round((totalInvested / totalShares) * 100) / 100 : 0;
      const currentVal = Math.round(totalInvested * (1 + returnPctDefault / 100) * 100) / 100;
      const gainLossPct =
        totalInvested > 0
          ? Math.round(((currentVal - totalInvested) / totalInvested) * 1000) / 10
          : returnPctDefault;

      const livePrice = isSp ? marketPrices.SP500?.price : marketPrices.Nasdaq?.price;
      const liveChange = isSp ? marketPrices.SP500?.change : marketPrices.Nasdaq?.change;

      return {
        assetKey,
        ticker,
        name,
        firstDate: firstTx?.date || '2026-08-24',
        firstAmount: firstTx?.amount ? Number(firstTx.amount) : isSp ? 713.08 : 305.52,
        txCount: buyTxs.length > 0 ? buyTxs.length : 2,
        totalInvested,
        totalShares: Math.round(totalShares * 100) / 100,
        avgCost,
        currentVal,
        gainLossPct,
        livePrice,
        liveChange,
      };
    };

    return {
      sp500: computeAsset('sp500'),
      nasdaq: computeAsset('nasdaq'),
    };
  }, [transactions, accounts, marketPrices]);

  // Base de capital depositado detectado
  const baseInvestedCapital = useMemo(() => {
    return Math.round((assetStats.sp500.totalInvested + assetStats.nasdaq.totalInvested) * 100) / 100;
  }, [assetStats]);

  // Proyección independiente año a año
  const projectionData = useMemo(() => {
    return calculateInvestmentProjection(
      assetStats.sp500.currentVal,
      assetStats.nasdaq.currentVal,
      spMonthly,
      nasdaqMonthly,
      years,
      spRate,
      nasdaqRate,
      baseInvestedCapital
    );
  }, [assetStats, spMonthly, nasdaqMonthly, years, spRate, nasdaqRate, baseInvestedCapital]);

  const finalYearData = projectionData[projectionData.length - 1] || projectionData[0];
  const retirement = calculateRetirementPension(finalYearData.combinedValue, 4.0);

  const totalGrowthMultiplier =
    finalYearData.totalInvested > 0
      ? (finalYearData.combinedValue / finalYearData.totalInvested).toFixed(2)
      : '1.00';

  const interestPercentage =
    finalYearData.totalInvested > 0
      ? ((finalYearData.cumulativeInterest / finalYearData.totalInvested) * 100).toFixed(1)
      : '0.0';

  // Configuración del Gráfico con 4 líneas diferenciadas
  const chartData = {
    labels: projectionData.map((d) => (d.year === 0 ? 'Inicio' : `Año ${d.year}`)),
    datasets: [
      {
        label: 'Total Portafolio',
        data: projectionData.map((d) => d.combinedValue),
        borderColor: '#a855f7',
        backgroundColor: 'rgba(168, 85, 247, 0.12)',
        fill: true,
        tension: 0.35,
        borderWidth: 3,
        pointRadius: years > 20 ? 0 : 2,
        pointHoverRadius: 6,
      },
      {
        label: 'S&P 500',
        data: projectionData.map((d) => d.sp500Value),
        borderColor: '#10b981',
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.35,
        borderWidth: 2.2,
        pointRadius: 0,
        pointHoverRadius: 5,
      },
      {
        label: 'NASDAQ-100',
        data: projectionData.map((d) => d.nasdaqValue),
        borderColor: '#38bdf8',
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.35,
        borderWidth: 2.2,
        pointRadius: 0,
        pointHoverRadius: 5,
      },
      {
        label: 'Capital Depositado (Base)',
        data: projectionData.map((d) => d.totalInvested),
        borderColor: '#94a3b8',
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.1,
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        pointHoverRadius: 5,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(11, 15, 29, 0.96)',
        titleColor: '#ffffff',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        padding: 12,
        boxPadding: 6,
        usePointStyle: true,
        callbacks: {
          title: function (items: any[]) {
            const idx = items[0]?.dataIndex;
            return idx === 0 ? 'Inicio (Punto de partida)' : `Año ${idx}`;
          },
          label: function (context: any) {
            return ` ${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        ticks: {
          color: '#94a3b8',
          font: { size: 10 },
          maxRotation: 45,
          autoSkip: true,
          maxTicksLimit: 12,
        },
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: {
          color: '#94a3b8',
          font: { size: 10 },
          callback: function (value: any) {
            if (value >= 1000000) return '$' + (value / 1000000).toFixed(1) + 'M';
            if (value >= 1000) return '$' + (value / 1000).toFixed(0) + 'k';
            return '$' + value;
          },
        },
      },
    },
  };

  const horizonPresets = [1, 5, 10, 15, 20, 30, 40];

  return (
    <div className="w-full space-y-6 pb-12">
      {/* ENCABEZADO CON PRECIOS EN VIVO Y ACTUALIZAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white font-display tracking-tight">
              Simulador de Proyección & Libertad Financiera
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            Punto de partida calculado automáticamente de tus inversiones reales. Cotizaciones en vivo para cálculo exacto de portafolio y DCA.
          </p>
        </div>

        {/* Badges de tickers en vivo y botón actualizar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-emerald-500/30 text-xs font-semibold text-slate-200 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>VOO (S&P):</span>
            <span className="font-mono font-bold text-emerald-300">
              ${marketPrices.SP500?.price ? marketPrices.SP500.price.toFixed(2) : '708.01'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-cyan-500/30 text-xs font-semibold text-slate-200 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>QQQ (NAS):</span>
            <span className="font-mono font-bold text-cyan-300">
              ${marketPrices.Nasdaq?.price ? marketPrices.Nasdaq.price.toFixed(2) : '718.96'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleRefreshPrices}
            disabled={isRefreshingPrices}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 hover:text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            title="Actualizar cotizaciones en vivo"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingPrices ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* FILA SUPERIOR: SLIDER HORIZONTE DE TIEMPO + 4 TARJETAS KPI */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3.5">
        {/* HORIZONTE DE TIEMPO */}
        <div className="lg:col-span-2 p-4 sm:p-5 rounded-2xl bg-slate-900/70 border border-white/10 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              Horizonte de Tiempo:
            </label>
            <span className="px-3 py-1 rounded-xl text-xs font-black bg-blue-600 text-white shadow-sm">
              {years} Años
            </span>
          </div>

          <input
            type="range"
            min="1"
            max="40"
            step="1"
            value={years}
            onChange={(e) => {
              const val = Number(e.target.value);
              setYears(val);
              updateInvestmentSettings({ years: val });
            }}
            className="w-full accent-blue-500 cursor-pointer my-2"
          />

          <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold px-1">
            {horizonPresets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setYears(preset);
                  updateInvestmentSettings({ years: preset });
                }}
                className={`transition-colors hover:text-white px-1 py-0.5 rounded cursor-pointer ${
                  years === preset ? 'text-blue-400 font-black' : ''
                }`}
              >
                {preset}a
              </button>
            ))}
          </div>
        </div>

        {/* 1. Capital Depositado */}
        <motion.div
          whileHover={{ y: -2 }}
          className="p-4 rounded-2xl border border-white/10 relative overflow-hidden shadow-lg flex flex-col justify-between"
          style={{
            background: 'linear-gradient(145deg, rgba(25, 30, 48, 0.9) 0%, rgba(13, 17, 30, 0.95) 100%)',
          }}
        >
          <div className="flex items-center justify-between text-[11px] font-black uppercase text-slate-400">
            <span>Capital Depositado</span>
            <div className="p-1.5 rounded-lg bg-white/5 text-slate-300">
              <Wallet className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-1.5">
            <span className="text-xl sm:text-2xl font-black font-display text-white">
              {formatCurrency(finalYearData.totalInvested)}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            Tu propio dinero invertido
          </span>
        </motion.div>

        {/* 2. Ganancia Interés */}
        <motion.div
          whileHover={{ y: -2 }}
          className="p-4 rounded-2xl border border-emerald-500/25 relative overflow-hidden shadow-lg flex flex-col justify-between"
          style={{
            background: 'linear-gradient(145deg, rgba(6, 44, 33, 0.85) 0%, rgba(3, 25, 18, 0.95) 100%)',
          }}
        >
          <div className="flex items-center justify-between text-[11px] font-black uppercase text-emerald-300">
            <span>Ganancia Interés</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-1.5">
            <span className="text-xl sm:text-2xl font-black font-display text-emerald-300">
              {formatCurrency(finalYearData.cumulativeInterest)}
            </span>
          </div>
          <span className="text-[11px] text-emerald-400 font-bold">
            +{interestPercentage}% de ganancia
          </span>
        </motion.div>

        {/* 3. Valor Total Final */}
        <motion.div
          whileHover={{ y: -2 }}
          className="p-4 rounded-2xl border border-purple-500/30 relative overflow-hidden shadow-lg flex flex-col justify-between"
          style={{
            background: 'linear-gradient(145deg, rgba(45, 20, 80, 0.85) 0%, rgba(20, 10, 42, 0.95) 100%)',
          }}
        >
          <div className="flex items-center justify-between text-[11px] font-black uppercase text-purple-300">
            <span>Valor Total Final</span>
            <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300">
              <PiggyBank className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-1.5">
            <span className="text-xl sm:text-2xl font-black font-display text-white">
              {formatCurrency(finalYearData.combinedValue)}
            </span>
          </div>
          <span className="text-[11px] text-purple-200 font-medium">
            Capital + Rendimientos
          </span>
        </motion.div>

        {/* 4. Multiplicador */}
        <motion.div
          whileHover={{ y: -2 }}
          className="p-4 rounded-2xl border border-amber-500/30 relative overflow-hidden shadow-lg flex flex-col justify-between"
          style={{
            background: 'linear-gradient(145deg, rgba(65, 30, 5, 0.85) 0%, rgba(35, 14, 2, 0.95) 100%)',
          }}
        >
          <div className="flex items-center justify-between text-[11px] font-black uppercase text-amber-300">
            <span>Multiplicador</span>
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
              <Zap className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-1.5">
            <span className="text-xl sm:text-2xl font-black font-display text-amber-300">
              {totalGrowthMultiplier}x
            </span>
          </div>
          <span className="text-[11px] text-amber-200/80 font-medium">
            Crecimiento total
          </span>
        </motion.div>
      </div>

      {/* SECCIÓN PRINCIPAL: ENTRADAS POR ACTIVO (IZQUIERDA) + REGLA 4% Y GRÁFICA (DERECHA) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* COLUMNA IZQUIERDA: TARJETAS DCA INDEPENDIENTES (S&P 500 Y NASDAQ) */}
        <div className="lg:col-span-5 space-y-4">
          {/* TARJETA 1: S&P 500 (VOO) */}
          <div
            className="p-5 rounded-3xl border border-emerald-500/20 shadow-xl relative overflow-hidden space-y-4"
            style={{
              background: 'linear-gradient(160deg, #091a1a 0%, #0d2724 45%, #051413 100%)',
            }}
          >
            {/* Header tarjeta */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-black">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>S&P 500 (VOO)</span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium px-2 py-0.5 rounded-lg bg-white/5 border border-white/5">
                Primer aporte: {assetStats.sp500.firstDate} ({formatCurrency(assetStats.sp500.firstAmount)})
              </span>
            </div>

            {/* Recuadro de Tenencia Actual en Portafolio */}
            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Valor Actual en Portafolio
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  {assetStats.sp500.txCount} compras registradas
                </span>
              </div>
              <div className="text-2xl font-black font-display text-white">
                {formatCurrency(assetStats.sp500.currentVal)}
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
                <span className="text-slate-400">
                  Acciones: <span className="text-slate-200 font-bold">{assetStats.sp500.totalShares}</span>
                </span>
                <span className="text-slate-400">
                  Costo Prom: <span className="text-slate-200 font-bold">{formatCurrency(assetStats.sp500.avgCost)}</span>
                </span>
                <span className="text-emerald-400 font-bold">
                  +{assetStats.sp500.gainLossPct}%
                </span>
              </div>
            </div>

            {/* Input & Slider: Aporte Mensual Futuro */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  Aporte Mensual Futuro ($)
                </label>
                <span className="text-sm font-black text-emerald-400 font-display">
                  {formatCurrency(spMonthly)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="5000"
                  step="25"
                  value={spMonthly}
                  onChange={(e) => setSpMonthly(Math.max(0, Number(e.target.value)))}
                  className="w-24 px-2.5 py-1 rounded-xl bg-black/40 border border-white/10 text-white font-mono text-xs font-bold focus:outline-none focus:border-emerald-500"
                />
                <input
                  type="range"
                  min="0"
                  max="3000"
                  step="25"
                  value={spMonthly}
                  onChange={(e) => setSpMonthly(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Slider: Rendimiento Anual Estimado */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-emerald-400" />
                  Rendimiento Anual Estimado (%)
                </span>
                <span className="text-xs font-black text-emerald-400">
                  {spRate.toFixed(1)}%
                </span>
              </div>
              <input
                type="range"
                min="4"
                max="20"
                step="0.5"
                value={spRate}
                onChange={(e) => setSpRate(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                * Promedio histórico a largo plazo del S&P 500 es ~10.0% anual.
              </p>
            </div>
          </div>

          {/* TARJETA 2: NASDAQ-100 (QQQ) */}
          <div
            className="p-5 rounded-3xl border border-cyan-500/20 shadow-xl relative overflow-hidden space-y-4"
            style={{
              background: 'linear-gradient(160deg, #091724 0%, #0d2038 45%, #05111d 100%)',
            }}
          >
            {/* Header tarjeta */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-black">
                <Activity className="w-3.5 h-3.5" />
                <span>NASDAQ-100 (QQQ)</span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium px-2 py-0.5 rounded-lg bg-white/5 border border-white/5">
                Primer aporte: {assetStats.nasdaq.firstDate} ({formatCurrency(assetStats.nasdaq.firstAmount)})
              </span>
            </div>

            {/* Recuadro de Tenencia Actual en Portafolio */}
            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Valor Actual en Portafolio
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  {assetStats.nasdaq.txCount} compras registradas
                </span>
              </div>
              <div className="text-2xl font-black font-display text-white">
                {formatCurrency(assetStats.nasdaq.currentVal)}
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
                <span className="text-slate-400">
                  Acciones: <span className="text-slate-200 font-bold">{assetStats.nasdaq.totalShares}</span>
                </span>
                <span className="text-slate-400">
                  Costo Prom: <span className="text-slate-200 font-bold">{formatCurrency(assetStats.nasdaq.avgCost)}</span>
                </span>
                <span className="text-cyan-400 font-bold">
                  +{assetStats.nasdaq.gainLossPct}%
                </span>
              </div>
            </div>

            {/* Input & Slider: Aporte Mensual Futuro */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-cyan-400" />
                  Aporte Mensual Futuro ($)
                </label>
                <span className="text-sm font-black text-cyan-400 font-display">
                  {formatCurrency(nasdaqMonthly)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="5000"
                  step="25"
                  value={nasdaqMonthly}
                  onChange={(e) => setNasdaqMonthly(Math.max(0, Number(e.target.value)))}
                  className="w-24 px-2.5 py-1 rounded-xl bg-black/40 border border-white/10 text-white font-mono text-xs font-bold focus:outline-none focus:border-cyan-500"
                />
                <input
                  type="range"
                  min="0"
                  max="3000"
                  step="25"
                  value={nasdaqMonthly}
                  onChange={(e) => setNasdaqMonthly(Number(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Slider: Rendimiento Anual Estimado */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-cyan-400" />
                  Rendimiento Anual Estimado (%)
                </span>
                <span className="text-xs font-black text-cyan-400">
                  {nasdaqRate.toFixed(1)}%
                </span>
              </div>
              <input
                type="range"
                min="6"
                max="24"
                step="0.5"
                value={nasdaqRate}
                onChange={(e) => setNasdaqRate(Number(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                * Promedio histórico de 30 años del NASDAQ es ~12.9% anual.
              </p>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: BANNER REGLA DEL 4% + GRÁFICA MULTI-LÍNEA */}
        <div className="lg:col-span-7 space-y-4">
          {/* BANNER REGLA DEL 4% — SUELDO MENSUAL VITALICIO */}
          <div
            className="p-5 sm:p-6 rounded-3xl border border-emerald-500/30 shadow-xl relative overflow-hidden"
            style={{
              background: 'linear-gradient(150deg, #05231c 0%, #083b30 46%, #031713 100%)',
            }}
          >
            {/* Glow decorativo */}
            <div
              className="absolute -top-10 -right-10 w-36 h-36 rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, transparent 70%)',
              }}
            />

            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-2 max-w-md">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    🌴 Regla del 4%
                  </span>
                  <span className="text-xs font-bold text-slate-300">
                    Jubilación / Libertad Financiera
                  </span>
                </div>

                <div className="text-[11px] font-black uppercase tracking-wider text-emerald-200/90">
                  TU SUELDO MENSUAL VITALICIO ESTIMADO:
                </div>

                <div className="text-3xl sm:text-4xl font-black font-display text-emerald-300 tracking-tight">
                  {formatCurrency(retirement.monthlyIncome)} / mes
                </div>

                <p className="text-xs text-slate-300/90 leading-relaxed pt-1">
                  Si retiras el <span className="text-white font-bold">4% anual</span> de tu portafolio acumulado (dividido en 12 meses), puedes vivir de tus rendimientos <span className="text-white font-bold">sin agotar tu capital</span>, ya que la bolsa rinde más del 4% en promedio.
                </p>
              </div>

              {/* Métricas laterales regla del 4% */}
              <div className="flex flex-col gap-2.5 sm:min-w-[190px] pt-1 sm:pt-0">
                <div className="flex items-center justify-between text-xs py-1.5 px-3 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    Retiro Anual (4%):
                  </span>
                  <span className="text-white font-bold font-mono">
                    {formatCurrency(retirement.annualIncome)} / año
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs py-1.5 px-3 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                    Capital Intacto (96%):
                  </span>
                  <span className="text-white font-bold font-mono">
                    {formatCurrency(retirement.intactCapital)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs py-1.5 px-3 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    Horizonte:
                  </span>
                  <span className="text-white font-bold font-mono">
                    {years} Años
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* CONTENEDOR DE LA GRÁFICA INTERACTIVA CON LEYENDA */}
          <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/80 border border-white/10 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white font-display">
                  Proyección a {years} Años (Interés Compuesto)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  El interés compuesto se acelera exponencialmente con el tiempo.
                </p>
              </div>

              {/* Leyenda interactiva personalizada */}
              <div className="flex items-center gap-3 flex-wrap text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#a855f7]" />
                  <span className="text-slate-300 text-[11px] font-semibold">Total Portafolio</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                  <span className="text-slate-300 text-[11px] font-semibold">S&P 500</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#38bdf8]" />
                  <span className="text-slate-300 text-[11px] font-semibold">NASDAQ-100</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-[#94a3b8] inline-block border-t border-dashed border-[#94a3b8]" />
                  <span className="text-slate-400 text-[11px]">Capital Depositado (Base)</span>
                </div>
              </div>
            </div>

            {/* Canvas de Chart.js */}
            <div className="h-[340px] w-full relative">
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN EXPANDIBLE: DESGLOSE DETALLADO AÑO POR AÑO */}
      <div className="rounded-3xl bg-slate-900/80 border border-white/10 overflow-hidden shadow-xl">
        <button
          type="button"
          onClick={() => setShowTable(!showTable)}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <BarChart3 className="w-4 h-4" />
            </div>
            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-200">
              Ver Desglose Detallado Año por Año
            </span>
          </div>
          {showTable ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        <AnimatePresence initial={false}>
          {showTable && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-white/5"
            >
              <div className="overflow-x-auto max-h-[460px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-950/95 backdrop-blur-md border-b border-white/10 text-slate-400 text-[11px] font-black uppercase tracking-wider z-10">
                    <tr>
                      <th className="py-3 px-5">Año</th>
                      <th className="py-3 px-5 text-right">Capital Depositado</th>
                      <th className="py-3 px-5 text-right text-emerald-400">S&P 500</th>
                      <th className="py-3 px-5 text-right text-cyan-400">NASDAQ</th>
                      <th className="py-3 px-5 text-right text-purple-300">Total Portafolio</th>
                      <th className="py-3 px-5 text-right text-emerald-400">Sueldo 4% (Mes)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {projectionData
                      .filter((d) => d.year > 0)
                      .map((d) => {
                        const monthlyWithdrawal = (d.combinedValue * 0.04) / 12;
                        return (
                          <tr
                            key={d.year}
                            className="hover:bg-white/[0.03] transition-colors"
                          >
                            <td className="py-2.5 px-5 font-sans font-bold text-slate-300">
                              Año {d.year}
                            </td>
                            <td className="py-2.5 px-5 text-right text-slate-300">
                              {formatCurrency(d.totalInvested)}
                            </td>
                            <td className="py-2.5 px-5 text-right text-emerald-400 font-medium">
                              {formatCurrency(d.sp500Value)}
                            </td>
                            <td className="py-2.5 px-5 text-right text-cyan-400 font-medium">
                              {formatCurrency(d.nasdaqValue)}
                            </td>
                            <td className="py-2.5 px-5 text-right text-white font-bold">
                              {formatCurrency(d.combinedValue)}
                            </td>
                            <td className="py-2.5 px-5 text-right text-emerald-300 font-bold">
                              {formatCurrency(monthlyWithdrawal)} / mes
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
