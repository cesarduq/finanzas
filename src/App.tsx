import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { FinanceProvider } from './context/FinanceContext';
import { BackgroundOrbs } from './components/layout/BackgroundOrbs';
import { Header } from './components/layout/Header';
import { BankCardsGrid } from './components/cards/BankCardsGrid';
import { TabsNav, ActiveTab } from './components/layout/TabsNav';
import { TransactionModal } from './components/transactions/TransactionModal';
import { TransactionHistory } from './components/transactions/TransactionHistory';
import { DebtsView } from './components/debts/DebtsView';
import { ProjectionView } from './components/projections/ProjectionView';
import { SummaryView } from './components/summary/SummaryView';

import { GuestBanner } from './components/layout/GuestBanner';
import { AuthModal } from './components/auth/AuthModal';

import { TransactionForm } from './components/transactions/TransactionForm';
import { Transaction } from './types/database';

function DashboardContent() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('history');
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showAuthRegisterModal, setShowAuthRegisterModal] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(undefined);
  const [historyAccountFilter, setHistoryAccountFilter] = useState<string>('all');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const handleSelectAccount = (accountId: string) => {
    setSelectedAccountId(accountId);
    setHistoryAccountFilter(accountId);
    setActiveTab('history');
  };

  const handleStartEdit = (tx: Transaction) => {
    setEditingTransaction(tx);
    if (activeTab === 'projections') setActiveTab('history');
    window.scrollTo({ top: 360, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingTransaction(null);
  };

  return (
    <div className="relative min-h-screen text-slate-100 p-3 sm:p-6 lg:p-8 flex flex-col items-center app-canvas">
      {/* Fondo Ambiental Glass con Orbes Neón */}
      <BackgroundOrbs />

      {/* Contenedor Principal Centrado con Ancho Máximo */}
      <div className="relative z-10 w-full max-w-[1780px] flex flex-col">
        {/* Header Superior */}
        <Header />

        {/* Banner informativo de Modo Local (solo si hay transacciones locales y no hay sesión) */}
        <GuestBanner onOpenRegister={() => setShowAuthRegisterModal(true)} />

        {/* Cuadrícula de 7x2 Tarjetas Bancarias (Holográficas con Hover) */}
        <BankCardsGrid activeAccountId={historyAccountFilter} onSelectAccount={handleSelectAccount} />

        {/* Layout Principal de 2 Columnas (Panel de Transacción a la Izquierda + Vistas a la Derecha) */}
        <div className="flex flex-col lg:flex-row items-start gap-6 w-full mt-2">
          {/* Columna Izquierda: Formulario Directo de Nueva / Editar Transacción (Oculto en Proyecciones) */}
          {activeTab !== 'projections' && (
            <aside className="w-full lg:w-95 xl:w-105 shrink-0 sticky top-6 self-start z-20">
              <TransactionForm
                defaultAccountId={selectedAccountId}
                editTransaction={editingTransaction || undefined}
                onCancelEdit={handleCancelEdit}
                onSuccess={() => setEditingTransaction(null)}
              />
            </aside>
          )}

          {/* Columna Derecha: Barra de Pestañas + Contenido Activo */}
          <section className="flex-1 min-w-0 w-full flex flex-col">
            <TabsNav
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onOpenNewTransaction={() => {
                setSelectedAccountId(undefined);
                setEditingTransaction(null);
                setShowTransactionModal(true);
              }}
            />

            {/* Contenido Dinámico de la Pestaña Activa */}
            <main className="w-full">
              {activeTab === 'history' && (
                <TransactionHistory
                  initialAccountFilter={historyAccountFilter}
                  onSelectAccountFilter={setHistoryAccountFilter}
                  onEditTransaction={handleStartEdit}
                />
              )}
              {activeTab === 'debts' && <DebtsView />}
              {activeTab === 'summary' && <SummaryView />}
              {activeTab === 'projections' && <ProjectionView />}
            </main>
          </section>
        </div>
      </div>

      {/* Modal de Nueva Transacción */}
      {showTransactionModal && (
        <TransactionModal
          defaultAccountId={selectedAccountId}
          onClose={() => {
            setShowTransactionModal(false);
            setSelectedAccountId(undefined);
          }}
        />
      )}

      {/* Modal de Registro con Migración Local */}
      {showAuthRegisterModal && (
        <AuthModal
          defaultTab="register"
          onClose={() => setShowAuthRegisterModal(false)}
        />
      )}
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <FinanceProvider>
        <DashboardContent />
      </FinanceProvider>
    </AuthProvider>
  );
}

export default App;
