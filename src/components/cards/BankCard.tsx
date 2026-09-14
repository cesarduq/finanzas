import React from 'react';
import { motion } from 'framer-motion';
import { Scale, TrendingUp, TrendingDown, HandCoins } from 'lucide-react';
import { formatCurrency, formatPercentage } from '../../utils/formatters';

export interface BankCardProps {
  id?: string;
  title: string;
  amount: number;
  color: string;
  iconUrl?: string | null;
  isNetWorth?: boolean;
  code?: string;
  metadata?: {
    sp500_balance?: number;
    nasdaq_balance?: number;
    sp500_return?: number;
    nasdaq_return?: number;
    sp500_gain_loss?: number;
    nasdaq_gain_loss?: number;
    total_balance?: number;
    total_gain_loss?: number;
    total_return?: number;
    [key: string]: any;
  };
  onClick?: () => void;
  onSelectSubAsset?: (asset: 'sp500' | 'nasdaq' | 'all_stocks') => void;
  className?: string;
  isSelected?: boolean;
}

function formatGainLossBadge(balance?: number, gainLoss?: number, returnPct?: number): string {
  const pct = returnPct ?? 0;
  const gl = gainLoss !== undefined ? gainLoss : balance !== undefined ? Math.round(((balance * pct) / 100) * 100) / 100 : 0;
  const glSign = gl > 0 ? '+' : gl < 0 ? '-' : '';
  const glFormatted = `${glSign}$${Math.abs(gl).toFixed(2)}`;
  const pctSign = pct > 0 ? '+' : '';
  const pctFormatted = `(${pctSign}${pct.toFixed(1)}%)`;
  return `${glFormatted} ${pctFormatted}`;
}

interface BrandPalette {
  gradient: string;
  glow: string;
  accent: string;
}

/**
 * Paleta armónica ajustada con precisión a las directrices de diseño y colores de logotipos
 */
function getHarmoniousCardPalette(code?: string, title?: string, baseColor: string = '#3b82f6', isNetWorth?: boolean): BrandPalette {
  if (isNetWorth) {
    return {
      gradient: 'linear-gradient(135deg, #065f46 0%, #059669 45%, #10b981 80%, #34d399 100%)',
      glow: '#10b981',
      accent: '#34d399',
    };
  }

  const c = (code || '').toLowerCase();
  const t = (title || '').toLowerCase();
  const col = (baseColor || '').toLowerCase();

  // 1. Hapi (Broker): Púrpura / Morado real vibrante (prioridad alta para evitar colisiones)
  if (c === 'hapi' || c === 'sp500' || c === 'nasdaq' || t.includes('hapi') || t.includes('broker')) {
    return {
      gradient: 'linear-gradient(135deg, #1c0936 0%, #380d6b 45%, #6118a8 80%, #8b5cf6 100%)',
      glow: '#9333ea',
      accent: '#c084fc',
    };
  }

  // 2. Banco Pichincha: 2 tonos cercanos de azul marino puro del interior del logo (#0F265C) - SIN amarillo en el fondo
  if (c === 'pichincha' || t.includes('pichincha')) {
    return {
      gradient: 'linear-gradient(135deg, #071530 0%, #0b1f48 50%, #0f2b60 100%)',
      glow: '#2563eb',
      accent: '#3b82f6',
    };
  }

  // 3. Deuna!: Color verde menta/turquesa claro (#2fd9a9) degradado a verde profundo armonioso
  if (c === 'deuna' || t.includes('deuna')) {
    return {
      gradient: 'linear-gradient(135deg, #0b4f3f 0%, #10755d 45%, #1ba684 80%, #2fd9a9 100%)',
      glow: '#2fd9a9',
      accent: '#5eead4',
    };
  }

  // 4. Banco Guayaquil: Magenta / Fucsia (#d2006e) degradado a frambuesa profundo
  if (c === 'guayaquil' || t.includes('guayaquil')) {
    return {
      gradient: 'linear-gradient(135deg, #59002f 0%, #800043 45%, #a80058 80%, #d2006e 100%)',
      glow: '#d2006e',
      accent: '#f472b6',
    };
  }

  // 5. Peigo: Aqua / Cyan vivo (#70f2ee) degradado a turquesa marino
  if (c === 'peigo' || t.includes('peigo')) {
    return {
      gradient: 'linear-gradient(135deg, #08545e 0%, #0e7786 45%, #1bb5cc 80%, #70f2ee 100%)',
      glow: '#70f2ee',
      accent: '#a5f3fc',
    };
  }

  // 6. Produbanco: Azul Promerica elegante
  if (c === 'produbanco' || t.includes('produbanco')) {
    return {
      gradient: 'linear-gradient(135deg, #041c2e 0%, #073557 45%, #035b8c 80%, #0284c7 100%)',
      glow: '#0284c7',
      accent: '#38bdf8',
    };
  }

  // 7. Binance: Amarillo oro puro (#ffdd00) degradado a dorado brillante
  if (c === 'binance' || t.includes('binance')) {
    return {
      gradient: 'linear-gradient(135deg, #805c00 0%, #b38300 45%, #e0aa00 80%, #ffdd00 100%)',
      glow: '#ffdd00',
      accent: '#fff066',
    };
  }

  // 8. Ugly Cash: Pizarra / Slate moderno
  if (c === 'ugly' || c === 'ugly_cash' || t.includes('ugly')) {
    return {
      gradient: 'linear-gradient(135deg, #0b1120 0%, #172033 45%, #243048 85%, #334155 100%)',
      glow: '#64748b',
      accent: '#94a3b8',
    };
  }

  // 9. Airtm: Azul eléctrico vibrante
  if (c === 'airtm' || t.includes('airtm')) {
    return {
      gradient: 'linear-gradient(135deg, #0f1d44 0%, #1e3a8a 45%, #2563eb 85%, #3b82f6 100%)',
      glow: '#2563eb',
      accent: '#60a5fa',
    };
  }

  // 10. Efectivo: Verde billete fresco (#39c988) degradado a esmeralda profundo
  if (c === 'efectivo' || t.includes('efectivo')) {
    return {
      gradient: 'linear-gradient(135deg, #0c4f31 0%, #147347 45%, #219e62 80%, #39c988 100%)',
      glow: '#39c988',
      accent: '#6ee7b7',
    };
  }

  // 11. Morse: Naranja cálido brillante (#fe3b00) degradado a bermellón intenso
  if (c === 'morse' || t.includes('morse')) {
    return {
      gradient: 'linear-gradient(135deg, #801d00 0%, #aa2700 45%, #d93200 80%, #fe3b00 100%)',
      glow: '#fe3b00',
      accent: '#fdba74',
    };
  }

  // 12. Por Cobrar: Indigo eléctrico
  if (c === 'por_cobrar' || t.includes('cobrar')) {
    return {
      gradient: 'linear-gradient(135deg, #131138 0%, #252268 45%, #3730a3 80%, #4f46e5 100%)',
      glow: '#6366f1',
      accent: '#818cf8',
    };
  }

  // Fallback seguro usando baseColor
  return {
    gradient: `linear-gradient(135deg, color-mix(in srgb, ${baseColor} 30%, #000000 70%) 0%, color-mix(in srgb, ${baseColor} 65%, #000000 35%) 45%, ${baseColor} 100%)`,
    glow: baseColor,
    accent: baseColor,
  };
}

export function BankCard({
  id,
  title,
  amount,
  color,
  iconUrl,
  isNetWorth = false,
  code,
  metadata,
  onClick,
  onSelectSubAsset,
  className = '',
  isSelected = false,
}: BankCardProps) {
  const baseColor = isNetWorth ? '#10b981' : (color || '#3b82f6');
  const palette = getHarmoniousCardPalette(code, title, baseColor, isNetWorth);
  const isHapi = (code === 'hapi') || title.toLowerCase().includes('hapi');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: isSelected ? 1.025 : 1,
      }}
      whileHover={{ y: isSelected ? -1 : -2.5, scale: isSelected ? 1.035 : 1.01 }}
      transition={{ duration: 0.18 }}
      onClick={onClick}
      className={`relative group flex flex-col justify-between px-4 py-3.5 sm:px-4.5 sm:py-4 rounded-2xl overflow-hidden transition-all duration-200 ease-out min-h-23 sm:min-h-24 select-none ${onClick ? 'cursor-pointer' : ''
        } ${isSelected
          ? 'border-[1.5px] z-20'
          : 'border-0'
        } ${className}`}
      style={{
        background: palette.gradient,
        borderColor: isSelected ? palette.accent : 'transparent',
        boxShadow: isSelected
          ? `0 0 20px ${palette.glow}88, 0 0 6px ${palette.glow}55`
          : '0 6px 18px -4px rgba(0, 0, 0, 0.45), 0 2px 6px -1px rgba(0, 0, 0, 0.25)',
      }}
    >
      {/* Resplandor radial suave en la esquina derecha acorde al logo */}
      <div
        className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full blur-xl pointer-events-none opacity-45 group-hover:opacity-75 transition-opacity duration-300"
        style={{ background: palette.glow }}
      />

      {/* RENDERIZADO ESPECIAL PARA HAPI (BROKER - 2 COLUMNAS) */}
      {isHapi ? (
        <div className="flex items-center justify-between gap-3 h-full relative z-20">
          {/* Lado Izquierdo: Título HAPI arriba + Monto abajo */}
          <div className="flex flex-col justify-between h-full min-w-0 py-0.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-200 truncate">
              {title}
            </span>
            <div className="text-lg sm:text-xl font-black tracking-tight font-display text-white drop-shadow-sm truncate">
              {formatCurrency(amount)}
            </div>
          </div>

          {/* Lado Derecho: Micro-widgets para S&P 500, NASDAQ y TOTAL + Logo */}
          <div className="flex items-center gap-2 sm:gap-2.5 my-auto">
            {metadata && (
              <div className="flex flex-col gap-1 text-[10px]">
                {/* S&P 500 */}
                {metadata.sp500_balance !== undefined && (
                  <div
                    onClick={(e) => {
                      if (onSelectSubAsset) {
                        e.stopPropagation();
                        onSelectSubAsset('sp500');
                      }
                    }}
                    title={`S&P 500 (VOO) — Invertido: ${formatCurrency(metadata.sp500_balance)} | Rendimiento: ${formatGainLossBadge(metadata.sp500_balance, metadata.sp500_gain_loss, metadata.sp500_return)}`}
                    className="flex items-center justify-between gap-1.5 px-2 py-0.5 rounded-lg bg-black/35 hover:bg-black/60 backdrop-blur-md border border-white/10 hover:border-emerald-400/50 shadow-sm transition-all hover:scale-[1.02] cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-300 font-semibold text-[9px] uppercase tracking-wider">S&P 500</span>
                      <span className="font-bold text-white text-[10px]">{formatCurrency(metadata.sp500_balance)}</span>
                    </div>
                    <span className={`text-[9px] font-bold px-1 py-0.2 rounded ml-1 flex items-center gap-0.5 ${(metadata.sp500_gain_loss ?? metadata.sp500_return ?? 0) < 0 ? 'text-rose-400 bg-rose-500/20' : 'text-emerald-400 bg-emerald-500/20'}`}>
                      {(metadata.sp500_gain_loss ?? metadata.sp500_return ?? 0) < 0 ? <TrendingDown className="w-2.5 h-2.5 shrink-0" /> : <TrendingUp className="w-2.5 h-2.5 shrink-0" />}
                      <span>{formatGainLossBadge(metadata.sp500_balance, metadata.sp500_gain_loss, metadata.sp500_return)}</span>
                    </span>
                  </div>
                )}

                {/* NASDAQ */}
                {metadata.nasdaq_balance !== undefined && (
                  <div
                    onClick={(e) => {
                      if (onSelectSubAsset) {
                        e.stopPropagation();
                        onSelectSubAsset('nasdaq');
                      }
                    }}
                    title={`NASDAQ-100 (QQQM) — Invertido: ${formatCurrency(metadata.nasdaq_balance)} | Rendimiento: ${formatGainLossBadge(metadata.nasdaq_balance, metadata.nasdaq_gain_loss, metadata.nasdaq_return)}`}
                    className="flex items-center justify-between gap-1.5 px-2 py-0.5 rounded-lg bg-black/35 hover:bg-black/60 backdrop-blur-md border border-white/10 hover:border-cyan-400/50 shadow-sm transition-all hover:scale-[1.02] cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-300 font-semibold text-[9px] uppercase tracking-wider">NASDAQ</span>
                      <span className="font-bold text-white text-[10px]">{formatCurrency(metadata.nasdaq_balance)}</span>
                    </div>
                    <span className={`text-[9px] font-bold px-1 py-0.2 rounded ml-1 flex items-center gap-0.5 ${(metadata.nasdaq_gain_loss ?? metadata.nasdaq_return ?? 0) < 0 ? 'text-rose-400 bg-rose-500/20' : 'text-cyan-400 bg-cyan-500/20'}`}>
                      {(metadata.nasdaq_gain_loss ?? metadata.nasdaq_return ?? 0) < 0 ? <TrendingDown className="w-2.5 h-2.5 shrink-0" /> : <TrendingUp className="w-2.5 h-2.5 shrink-0" />}
                      <span>{formatGainLossBadge(metadata.nasdaq_balance, metadata.nasdaq_gain_loss, metadata.nasdaq_return)}</span>
                    </span>
                  </div>
                )}

                {/* TOTAL */}
                {metadata.total_balance !== undefined && (
                  <div
                    onClick={(e) => {
                      if (onSelectSubAsset) {
                        e.stopPropagation();
                        onSelectSubAsset('all_stocks');
                      }
                    }}
                    title={`Total Portafolio Acciones — Invertido: ${formatCurrency(metadata.total_balance)} | Rendimiento: ${formatGainLossBadge(metadata.total_balance, metadata.total_gain_loss, metadata.total_return)}`}
                    className="flex items-center justify-between gap-1.5 px-2 py-0.5 rounded-lg bg-black/35 hover:bg-black/60 backdrop-blur-md border border-white/10 hover:border-purple-400/50 shadow-sm transition-all hover:scale-[1.02] cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-300 font-semibold text-[9px] uppercase tracking-wider">TOTAL</span>
                      <span className="font-bold text-white text-[10px]">{formatCurrency(metadata.total_balance)}</span>
                    </div>
                    <span className={`text-[9px] font-bold px-1 py-0.2 rounded ml-1 flex items-center gap-0.5 ${(metadata.total_gain_loss ?? metadata.total_return ?? 0) < 0 ? 'text-rose-400 bg-rose-500/20' : 'text-purple-300 bg-purple-500/20'}`}>
                      {(metadata.total_gain_loss ?? metadata.total_return ?? 0) < 0 ? <TrendingDown className="w-2.5 h-2.5 shrink-0" /> : <TrendingUp className="w-2.5 h-2.5 shrink-0" />}
                      <span>{formatGainLossBadge(metadata.total_balance, metadata.total_gain_loss, metadata.total_return)}</span>
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Logo de Hapi grande (w-10 h-10) */}
            <div className="w-10 h-10 shrink-0 flex items-center justify-center">
              <img src={iconUrl || '/assets/hapi.svg'} alt={title} className="w-full h-full object-contain drop-shadow-md" />
            </div>
          </div>
        </div>
      ) : (
        /* RENDERIZADO PARA TARJETAS REGULARES (1 COLUMNA, ~90px DE ALTO) */
        <div className="flex items-center justify-between gap-2.5 h-full relative z-20">
          <div className="flex flex-col justify-between h-full min-w-0 py-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-200 truncate">
                {title}
              </span>
              {amount < 0 && (
                <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-rose-500/30 text-rose-300 border border-rose-500/50 shrink-0">
                  Negativo
                </span>
              )}
            </div>

            <div className={`text-lg sm:text-xl font-black tracking-tight font-display drop-shadow-sm truncate ${amount < 0 ? 'text-rose-300' : 'text-white'}`}>
              {formatCurrency(amount)}
            </div>
          </div>

          {/* Lado Derecho: Logo grande centrado verticalmente en el medio de las 2 filas (w-11 h-11) */}
          <div className="w-11 h-11 shrink-0 flex items-center justify-center my-auto">
            {isNetWorth ? (
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center text-white shadow-sm">
                <Scale className="w-5.5 h-5.5" />
              </div>
            ) : code === 'por_cobrar' ? (
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center text-white shadow-sm">
                <HandCoins className="w-5.5 h-5.5 text-white" />
              </div>
            ) : iconUrl ? (
              <img src={iconUrl} alt={title} className="w-full h-full object-contain drop-shadow-md" />
            ) : (
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-xs font-black shadow-md"
                style={{ background: palette.glow }}
              >
                {title.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}




