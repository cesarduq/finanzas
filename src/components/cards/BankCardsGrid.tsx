import React, { useMemo } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { BankCard } from './BankCard';
import { getCachedMarketPrices } from '../../utils/marketPrices';

interface BankCardsGridProps {
  onSelectAccount?: (accountId: string) => void;
  activeAccountId?: string;
}

export function BankCardsGrid({ onSelectAccount, activeAccountId }: BankCardsGridProps) {
  const { accounts, netWorth, debts, transactions } = useFinance();

  // Saldo neto activo de préstamos y deudas (Me deben - Debo)
  const netDebtBalance = debts
    .filter((d) => d.status === 'active')
    .reduce((sum, d) => {
      const bal = Number(d.current_balance) || 0;
      return d.type === 'me_deben' ? sum + bal : sum - bal;
    }, 0);

  // Métricas dinámicas en tiempo real del portafolio en Hapi
  const hapiInvestmentStats = useMemo(() => {
    const hapiAcc = accounts.find((a) => a.code === 'hapi' || a.name.toLowerCase().includes('hapi'));
    if (!hapiAcc) return null;

    const marketPrices = getCachedMarketPrices();

    const computeAsset = (assetKey: 'sp500' | 'nasdaq') => {
      const isSp = assetKey === 'sp500';
      const livePrice = isSp ? marketPrices.SP500?.price : marketPrices.Nasdaq?.price;

      const assetTxs = transactions.filter((t) => {
        const isMatch =
          (t.metadata?.investment_asset === assetKey ||
            (assetKey === 'sp500' && (t.note || '').toLowerCase().includes('s&p 500')) ||
            (assetKey === 'nasdaq' && (t.note || '').toLowerCase().includes('nasdaq'))) &&
          (t.metadata?.shares !== undefined || (t.note || '').toLowerCase().startsWith('compra'));
        return isMatch;
      });

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

      const currentVal =
        livePrice && totalShares > 0
          ? Math.round(totalShares * livePrice * 100) / 100
          : totalInvested;

      const gainLoss = Math.round((currentVal - totalInvested) * 100) / 100;
      const returnPct = totalInvested > 0 ? Math.round((gainLoss / totalInvested) * 1000) / 10 : 0;

      return {
        totalInvested,
        totalShares,
        currentVal,
        gainLoss,
        returnPct,
      };
    };

    const sp500 = computeAsset('sp500');
    const nasdaq = computeAsset('nasdaq');

    const totalInvested = Math.round((sp500.totalInvested + nasdaq.totalInvested) * 100) / 100;
    const totalCurrentVal = Math.round((sp500.currentVal + nasdaq.currentVal) * 100) / 100;
    const totalGainLoss = Math.round((totalCurrentVal - totalInvested) * 100) / 100;
    const totalReturnPct = totalInvested > 0 ? Math.round((totalGainLoss / totalInvested) * 1000) / 10 : 0;

    return {
      sp500_balance: sp500.totalInvested,
      sp500_return: sp500.returnPct,
      sp500_gain_loss: sp500.gainLoss,
      sp500_current_val: sp500.currentVal,

      nasdaq_balance: nasdaq.totalInvested,
      nasdaq_return: nasdaq.returnPct,
      nasdaq_gain_loss: nasdaq.gainLoss,
      nasdaq_current_val: nasdaq.currentVal,

      total_balance: totalInvested,
      total_return: totalReturnPct,
      total_gain_loss: totalGainLoss,
      total_current_val: totalCurrentVal,
    };
  }, [accounts, transactions]);

  // Ordenar cuentas visibles según display_order
  const visibleAccounts = accounts
    .filter((a) => !a.is_archived)
    .sort((a, b) => a.display_order - b.display_order);

  return (
    <section className="w-full mb-6">
      {/* Grid: 7 columnas en desktop (lg:grid-cols-7), adaptativo en móvil */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-3.5">
        {/* 1. Tarjeta Especial: Patrimonio Neto */}
        <BankCard
          title="Patrimonio Neto"
          amount={netWorth}
          color="#10b981"
          isNetWorth={true}
          className="col-span-1"
          isSelected={!activeAccountId || activeAccountId === 'all'}
          onClick={() => onSelectAccount && onSelectAccount('all')}
        />

        {/* 2 al 14. Cuentas y Bancos individuales visibles */}
        {visibleAccounts.map((acc) => {
          const isLoanAccount = acc.code === 'por_cobrar' || acc.name.toLowerCase().includes('cobrar') || acc.type === 'deuda';
          const displayTitle = isLoanAccount ? 'Préstamos' : acc.name;
          const displayAmount = isLoanAccount ? netDebtBalance : (Number(acc.current_balance) || 0);
          const isHapi = acc.code === 'hapi' || acc.name.toLowerCase().includes('hapi');
          const mergedMetadata = isHapi && hapiInvestmentStats
            ? { ...acc.metadata, ...hapiInvestmentStats }
            : acc.metadata;

          return (
            <BankCard
              key={acc.id}
              id={acc.id}
              title={displayTitle}
              amount={displayAmount}
              color={acc.color}
              iconUrl={acc.icon_url}
              code={acc.code}
              metadata={mergedMetadata}
              className={isHapi ? 'col-span-2 sm:col-span-2 md:col-span-2 lg:col-span-2' : 'col-span-1'}
              isSelected={activeAccountId === acc.id || (isHapi && (activeAccountId === 'sp500' || activeAccountId === 'nasdaq' || activeAccountId === 'all_stocks'))}
              onClick={() => onSelectAccount && onSelectAccount(acc.id)}
              onSelectSubAsset={(subAsset) => onSelectAccount && onSelectAccount(subAsset)}
            />
          );
        })}
      </div>
    </section>
  );
}
