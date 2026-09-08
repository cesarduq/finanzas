import React from 'react';
import { useFinance } from '../../context/FinanceContext';
import { BankCard } from './BankCard';

interface BankCardsGridProps {
  onSelectAccount?: (accountId: string) => void;
  activeAccountId?: string;
}

export function BankCardsGrid({ onSelectAccount, activeAccountId }: BankCardsGridProps) {
  const { accounts, netWorth } = useFinance();

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
        {visibleAccounts.map((acc) => (
          <BankCard
            key={acc.id}
            id={acc.id}
            title={acc.name}
            amount={Number(acc.current_balance) || 0}
            color={acc.color}
            iconUrl={acc.icon_url}
            code={acc.code}
            metadata={acc.metadata}
            className={(acc.code === 'hapi' || acc.name.toLowerCase().includes('hapi')) ? 'col-span-2 sm:col-span-2 md:col-span-2 lg:col-span-2' : 'col-span-1'}
            isSelected={activeAccountId === acc.id || (acc.code === 'hapi' && (activeAccountId === 'sp500' || activeAccountId === 'nasdaq'))}
            onClick={() => onSelectAccount && onSelectAccount(acc.id)}
            onSelectSubAsset={(subAsset) => onSelectAccount && onSelectAccount(subAsset)}
          />
        ))}
      </div>
    </section>
  );
}
