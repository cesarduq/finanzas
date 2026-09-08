import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { Transaction, Account } from '../../types/database';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface DeleteConfirmModalProps {
  transaction: Transaction;
  accounts: Account[];
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteConfirmModal({
  transaction,
  accounts,
  onClose,
  onConfirm,
}: DeleteConfirmModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  React.useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const getAccountName = (accId?: string | null) => {
    if (!accId) return 'Cuenta';
    return accounts.find((a) => a.id === accId)?.name || 'Cuenta';
  };

  const amount = Number(transaction.amount) || 0;
  const commission = Number(transaction.metadata?.commission) || 0;
  const sourceName = getAccountName(transaction.account_id);
  const destName = getAccountName(transaction.destination_account_id);

  let explanation = '';
  if (['transfer', 'transferencia', 'transfer_in', 'transfer_out'].includes(transaction.type)) {
    explanation = `Se cancelará la transferencia: se devolverán ${formatCurrency(amount)} a ${sourceName} y se debitarán ${formatCurrency(amount - commission)} de ${destName}.`;
  } else if (transaction.type === 'gasto' || transaction.type === 'trade_loss') {
    explanation = `Se reembolsarán ${formatCurrency(amount)} a tu saldo de ${sourceName}.`;
  } else if (transaction.type === 'ingreso' || transaction.type === 'trade_profit') {
    explanation = `Se descontarán ${formatCurrency(amount)} de tu saldo de ${sourceName}.`;
  } else if (transaction.type === 'invest' || transaction.type === 'inversion') {
    const asset = transaction.metadata?.investment_asset?.toUpperCase() || 'BROKER';
    explanation = `Se reembolsarán ${formatCurrency(amount)} a ${sourceName} y se revertirá la tenencia de ${asset} en Hapi.`;
  } else if (['loan_out', 'loan_payment', 'debt_in', 'debt_service_in', 'debt_payment'].includes(transaction.type)) {
    const person = transaction.metadata?.person || 'la persona';
    explanation = `Se reajustará el saldo de la deuda asociada con ${person} y los saldos bancarios vinculados.`;
  } else {
    explanation = `Se revertirá el impacto financiero de este movimiento en ${sourceName}.`;
  }

  const handleConfirm = async () => {
    setIsDeleting(true);
    await onConfirm();
    setIsDeleting(false);
  };

  const modal = (
    <AnimatePresence>
      {/* Backdrop: porta al body para centrar en toda la página sin importar el stacking context */}
      <motion.div
        key="delete-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          background: 'rgba(4, 6, 18, 0.45)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Modal con gradiente triple en tonos rojos */}
        <motion.div
          key="delete-modal"
          initial={{ opacity: 0, scale: 0.92, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 24 }}
          transition={{ type: 'spring', damping: 24, stiffness: 340 }}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '26rem',
            borderRadius: '1.5rem',
            padding: '1.5rem',
            overflow: 'hidden',
            background: 'linear-gradient(160deg, #2d0a0a 0%, #4a1212 42%, #1e0505 100%)',
            border: '1px solid rgba(239, 68, 68, 0.22)',
            boxShadow:
              '0 40px 80px -20px rgba(0,0,0,0.9), 0 0 0 1px rgba(239,68,68,0.10), inset 0 1px 0 rgba(255,255,255,0.07)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Glow ambiental superior derecho */}
          <div
            style={{
              position: 'absolute',
              top: '-3rem',
              right: '-3rem',
              width: '10rem',
              height: '10rem',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(239,68,68,0.15) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />
          {/* Glow ambiental inferior izquierdo */}
          <div
            style={{
              position: 'absolute',
              bottom: '-2.5rem',
              left: '-2.5rem',
              width: '8rem',
              height: '8rem',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(153,27,27,0.12) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          {/* Botón Cerrar */}
          <button
            type="button"
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              width: '2rem',
              height: '2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              cursor: 'pointer',
              color: '#cbd5e1',
              zIndex: 50,
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.18)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
              e.currentTarget.style.color = '#cbd5e1';
            }}
            title="Cerrar modal"
          >
            <X style={{ width: '1.1rem', height: '1.1rem' }} />
          </button>

          {/* Icono y Título */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', position: 'relative', zIndex: 10, paddingRight: '2.5rem' }}>
            <div
              style={{
                width: '2.75rem',
                height: '2.75rem',
                borderRadius: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                background: 'rgba(239,68,68,0.16)',
                border: '1px solid rgba(239,68,68,0.32)',
              }}
            >
              <AlertTriangle style={{ width: '1.5rem', height: '1.5rem', color: '#f87171' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#fff', fontFamily: 'var(--font-display)', margin: 0 }}>
                ¿Eliminar esta transacción?
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'rgba(252,165,165,0.7)', marginTop: '0.125rem', margin: 0 }}>
                Esta acción revertirá los saldos afectados
              </p>
            </div>
          </div>

          {/* Tarjeta Resumen */}
          <div
            style={{
              padding: '0.875rem',
              borderRadius: '1rem',
              background: 'rgba(0,0,0,0.28)',
              border: '1px solid rgba(255,255,255,0.07)',
              marginBottom: '1rem',
              position: 'relative',
              zIndex: 10,
            }}
          >
            {[
              { label: 'Detalle:', value: transaction.note || 'Movimiento sin nota', bold: true },
              { label: 'Monto:', value: formatCurrency(amount), bold: true, large: true },
              { label: 'Fecha:', value: formatDate(transaction.date, true), bold: false },
            ].map(({ label, value, bold, large }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', fontSize: '0.75rem', marginBottom: '0.375rem' }}>
                <span style={{ color: '#94a3b8', flexShrink: 0 }}>{label}</span>
                <span style={{ color: '#fff', fontWeight: bold ? 700 : 400, fontSize: large ? '0.875rem' : '0.75rem', textAlign: 'right', lineHeight: '1.35' }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Explicación */}
          <div
            style={{
              padding: '0.75rem',
              borderRadius: '0.75rem',
              background: 'rgba(185,28,28,0.20)',
              border: '1px solid rgba(239,68,68,0.18)',
              fontSize: '0.75rem',
              color: 'rgba(252,165,165,0.88)',
              lineHeight: 1.6,
              marginBottom: '1.25rem',
              position: 'relative',
              zIndex: 10,
            }}
          >
            {explanation}
          </div>

          {/* Botones */}
          <div style={{ display: 'flex', gap: '0.75rem', position: 'relative', zIndex: 10 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              style={{
                flex: 1,
                padding: '0.625rem 1rem',
                borderRadius: '0.75rem',
                fontWeight: 700,
                fontSize: '0.75rem',
                color: '#cbd5e1',
                background: 'rgba(255,255,255,0.07)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#fff'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#cbd5e1'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)'; }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isDeleting}
              style={{
                flex: 1,
                padding: '0.625rem 1rem',
                borderRadius: '0.75rem',
                fontWeight: 700,
                fontSize: '0.75rem',
                color: '#fff',
                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 20px rgba(220,38,38,0.32)',
                transition: 'all 0.15s',
              }}
            >
              {isDeleting ? (
                <div style={{ width: '1rem', height: '1rem', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              ) : (
                <>
                  <Trash2 style={{ width: '1rem', height: '1rem' }} />
                  <span>Eliminar</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  // Render via portal al body — garantiza centrado en toda la página
  return ReactDOM.createPortal(modal, document.body);
}
