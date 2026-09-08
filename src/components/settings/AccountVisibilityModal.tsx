import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Eye, EyeOff, SlidersHorizontal, Check, CheckCheck, Ban, Sparkles } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { Account } from '../../types/database';
import { ModalShell } from '../ui/ModalShell';

interface AccountVisibilityModalProps {
  onClose: () => void;
}

export function AccountVisibilityModal({ onClose }: AccountVisibilityModalProps) {
  const { accounts, updateMultipleAccountsVisibility } = useFinance();

  // Mapa local de visibilidad: accountId -> isVisible (boolean)
  const [visibilityMap, setVisibilityMap] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    accounts.forEach((acc) => {
      map[acc.id] = !acc.is_archived;
    });
    return map;
  });

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const toggleAccount = (id: string) => {
    setVisibilityMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleSelectAll = (visible: boolean) => {
    const next: Record<string, boolean> = {};
    accounts.forEach((acc) => {
      next[acc.id] = visible;
    });
    setVisibilityMap(next);
  };

  const handleSave = async () => {
    setSaving(true);
    await updateMultipleAccountsVisibility(visibilityMap);
    setSaving(false);
    setSavedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 400);
  };

  const visibleCount = Object.values(visibilityMap).filter(Boolean).length;
  const totalCount = accounts.length;

  return (
    <ModalShell onClose={onClose} maxWidth="38rem" maxHeight="90vh">
      {/* Modal Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 15 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative w-full rounded-3xl overflow-hidden z-10 flex flex-col" style={{ maxHeight: '88vh' }}
      >
          {/* Header */}
          <div className="flex items-center justify-between p-5 sm:p-6 pb-4 border-b border-white/10">
            <div className="flex items-center gap-3.5">
              <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 shadow-lg shadow-emerald-500/25">
                <SlidersHorizontal className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-white font-display flex items-center gap-2">
                  Visibilidad de Cuentas
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Marca las cuentas y tarjetas que deseas <strong className="text-emerald-400">MOSTRAR</strong> en tu panel principal.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Actions & Counter */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 bg-white/[0.03] border-b border-white/5">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>{visibleCount} de {totalCount} cuentas visibles</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSelectAll(true)}
                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/20 transition-all flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="w-3 h-3" />
                Mostrar Todas
              </button>
              <button
                type="button"
                onClick={() => handleSelectAll(false)}
                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-white/10 transition-all flex items-center gap-1 cursor-pointer"
              >
                <Ban className="w-3 h-3" />
                Ocultar Todas
              </button>
            </div>
          </div>

          {/* Accounts List (Scrollable) */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-2.5 flex-1 custom-scrollbar">
            {accounts.map((acc) => {
              const isVisible = !!visibilityMap[acc.id];
              return (
                <div
                  key={acc.id}
                  onClick={() => toggleAccount(acc.id)}
                  className={`flex items-center justify-between p-3 sm:px-4 rounded-2xl cursor-pointer transition-all duration-200 border ${
                    isVisible
                      ? 'bg-slate-800/60 hover:bg-slate-800/90 border-white/15 shadow-sm'
                      : 'bg-slate-900/30 hover:bg-slate-900/60 border-white/5 opacity-50'
                  }`}
                >
                  {/* Left: Icon & Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.08] p-1.5 flex items-center justify-center shrink-0 border border-white/10">
                      {acc.icon_url ? (
                        <img src={acc.icon_url} alt={acc.name} className="w-full h-full object-contain" />
                      ) : (
                        <div
                          className="w-full h-full rounded-lg flex items-center justify-center text-white text-xs font-black"
                          style={{ backgroundColor: acc.color }}
                        >
                          {acc.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold truncate ${isVisible ? 'text-white' : 'text-slate-400 line-through'}`}>
                          {acc.name}
                        </span>
                        <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-white/10 text-slate-300">
                          {acc.type}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 font-medium">
                        {isVisible ? 'Visible en tarjetas y formularios' : 'Oculta del panel y menús'}
                      </span>
                    </div>
                  </div>

                  {/* Right: Toggle Switch */}
                  <div className="flex items-center gap-2.5 shrink-0 pl-3">
                    <div
                      className={`w-12 h-6 rounded-full transition-colors duration-200 flex items-center p-0.5 cursor-pointer ${
                        isVisible ? 'bg-emerald-500' : 'bg-slate-700'
                      }`}
                    >
                      <motion.div
                        layout
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className={`w-5 h-5 rounded-full bg-white shadow-md flex items-center justify-center ${
                          isVisible ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      >
                        {isVisible ? (
                          <Eye className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <EyeOff className="w-3 h-3 text-slate-400" />
                        )}
                      </motion.div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between gap-3 p-4 sm:p-5 border-t border-white/10 bg-white/[0.02]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 transition-all cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-lg shadow-emerald-500/25 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>¡Cambios Guardados!</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{saving ? 'Guardando...' : 'Aplicar Visibilidad'}</span>
                </>
              )}
            </button>
          </div>
      </motion.div>
    </ModalShell>
  );
}
