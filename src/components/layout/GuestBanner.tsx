import React, { useState, useEffect } from 'react';
import { CloudUpload, Trash2, AlertTriangle, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { getGuestTransactions, clearGuestData } from '../../utils/localGuestStorage';
import { ModalShell } from '../ui/ModalShell';

interface GuestBannerProps {
  onOpenRegister: () => void;
}

export function GuestBanner({ onOpenRegister }: GuestBannerProps) {
  const { user } = useAuth();
  const { refreshData } = useFinance();
  const [guestTxCount, setGuestTxCount] = useState(0);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  useEffect(() => {
    if (!user) {
      const txs = getGuestTransactions();
      setGuestTxCount(txs.length);
    } else {
      setGuestTxCount(0);
    }
  }, [user]);

  if (user || guestTxCount === 0) return null;

  const handleClearLocalData = async () => {
    clearGuestData();
    setShowConfirmReset(false);
    setGuestTxCount(0);
    await refreshData();
  };

  return (
    <>
      <div className="w-full mb-4 p-3.5 sm:px-5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs sm:text-sm font-bold text-amber-200">
              Estás en Modo Local: Hay {guestTxCount} transacciones guardadas solo en esta máquina.
            </p>
            <p className="text-[11px] text-amber-300/80">
              Si borras el historial del navegador o cambias de PC, estos datos no se conservarán.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <button
            onClick={() => setShowConfirmReset(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 hover:bg-black/60 text-slate-300 hover:text-white text-xs font-semibold border border-white/10 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Empezar de Cero</span>
          </button>

          <button
            onClick={onOpenRegister}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold shadow-md shadow-amber-500/25 transition-all hover:scale-105"
          >
            <CloudUpload className="w-3.5 h-3.5" />
            <span>Pasar a la Nube</span>
          </button>
        </div>
      </div>

      {showConfirmReset && (
        <ModalShell onClose={() => setShowConfirmReset(false)} maxWidth="24rem">
          <div className="relative p-6 text-white text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 mx-auto mb-3 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black font-display mb-2">
              ¿Eliminar datos locales?
            </h3>
            <p className="text-xs text-slate-300 mb-5 leading-relaxed">
              Esta acción borrará permanentemente las {guestTxCount} transacciones guardadas en este navegador y la app volverá a estar limpia desde cero.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowConfirmReset(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleClearLocalData}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-black text-xs shadow-lg shadow-rose-500/25 cursor-pointer"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </>
  );
}
