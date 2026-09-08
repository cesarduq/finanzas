import React, { useState } from 'react';
import { Wallet, Cloud, CloudOff, RefreshCw, Key, LogOut, LogIn, Database, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { ChangePasswordModal } from '../auth/ChangePasswordModal';
import { AuthModal } from '../auth/AuthModal';
import { BackupModal } from '../settings/BackupModal';
import { AccountVisibilityModal } from '../settings/AccountVisibilityModal';

export function Header() {
  const { user, signOut, isConfigured } = useAuth();
  const { refreshData, loading } = useFinance();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showVisibilityModal, setShowVisibilityModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <>
      <header className="relative z-10 w-full mb-5 px-1 py-1">
        {/* Cabecera Flotante Directa en el Fondo (Sin contenedor rectangular) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Lado Izquierdo: Icono + Título + Estado de Nube */}
          <div className="flex items-center gap-3.5">
            <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 shadow-lg shadow-cyan-500/25 border border-white/20">
              <Wallet className="w-6 h-6 text-white drop-shadow-sm" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white font-display flex items-center gap-2">
                Mi Dashboard
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                {isConfigured && user ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/25 backdrop-blur-sm">
                    <Cloud className="w-3.5 h-3.5" />
                    Modo Nube (Sincronizado)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-500/25 backdrop-blur-sm">
                    <CloudOff className="w-3.5 h-3.5" />
                    {isConfigured ? 'Sesión Local' : 'Modo Demo (Sin .env)'}
                  </span>
                )}
                {user?.email && (
                  <span className="text-xs text-slate-300/80 hidden md:inline font-medium">
                    • {user.email}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Lado Derecho: Botones de Acción Flotantes en Cristal Esmerilado */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            {/* Botón Refrescar */}
            <button
              onClick={handleRefresh}
              disabled={loading || isRefreshing}
              title="Sincronizar datos"
              className="p-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-slate-200 hover:text-white border border-white/10 backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing || loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>

            {/* Botón Visibilidad de Cuentas */}
            <button
              onClick={() => setShowVisibilityModal(true)}
              title="Configurar qué cuentas mostrar en el panel"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-slate-200 hover:text-white border border-white/10 backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95 text-xs font-bold cursor-pointer shadow-sm"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Visibilidad</span>
            </button>

            {/* Botón Respaldos */}
            <button
              onClick={() => setShowBackupModal(true)}
              title="Descargar o cargar copias de seguridad JSON"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-slate-200 hover:text-white border border-white/10 backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95 text-xs font-bold cursor-pointer shadow-sm"
            >
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Respaldos</span>
            </button>

            {user ? (
              <>
                {/* Botón Cambiar Contraseña */}
                <button
                  onClick={() => setShowPasswordModal(true)}
                  title="Cambiar contraseña"
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-slate-200 hover:text-white border border-white/10 backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95 text-xs font-bold cursor-pointer shadow-sm"
                >
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Seguridad</span>
                </button>

                {/* Botón Salir */}
                <button
                  onClick={() => signOut()}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95 text-xs font-bold cursor-pointer shadow-sm"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Salir</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-xs shadow-lg shadow-cyan-500/25 transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Ingresar / Registro</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {showVisibilityModal && (
        <AccountVisibilityModal onClose={() => setShowVisibilityModal(false)} />
      )}

      {showPasswordModal && (
        <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
      )}

      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}

      {showBackupModal && (
        <BackupModal onClose={() => setShowBackupModal(false)} />
      )}
    </>
  );
}
