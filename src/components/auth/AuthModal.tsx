import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { X, Lock, Mail, User, CheckCircle2, AlertCircle, LogIn, UserPlus, CloudUpload, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { getGuestTransactions, clearGuestData, migrateLocalGuestDataToSupabase } from '../../utils/localGuestStorage';
import { ModalShell } from '../ui/ModalShell';

interface AuthModalProps {
  onClose: () => void;
  defaultTab?: 'login' | 'register';
}

export function AuthModal({ onClose, defaultTab = 'login' }: AuthModalProps) {
  const { signIn, signUp, isConfigured } = useAuth();
  const { refreshData } = useFinance();
  const [tab, setTab] = useState<'login' | 'register'>(defaultTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Estados para el flujo de migración de datos locales al registrarse
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [showMigrationPrompt, setShowMigrationPrompt] = useState(false);
  const [showDiscardWarning, setShowDiscardWarning] = useState(false);

  const localTxCount = getGuestTransactions().length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!email.trim() || !password) {
      setError('Por favor completa todos los campos requeridos');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);

    if (tab === 'login') {
      const res = await signIn(email, password);
      setLoading(false);
      if (res.error) {
        setError(res.error);
      } else {
        await refreshData();
        onClose();
      }
    } else {
      // Flujo de Registro
      const res = await signUp(email, password, fullName);
      setLoading(false);

      if (res.error) {
        setError(res.error);
        return;
      }

      // Si hay datos locales guardados, preguntar antes de continuar
      if (localTxCount > 0) {
        setShowMigrationPrompt(true);
      } else {
        setSuccessMsg('¡Cuenta creada exitosamente! Has iniciado sesión.');
        await refreshData();
        setTimeout(() => onClose(), 1200);
      }
    }
  };

  // Opción 1: El usuario decide MIGRAR sus datos locales a su nueva cuenta
  const handleConfirmMigrateLocalData = async () => {
    setLoading(true);
    // Obtener sesión actual
    const currentLocalUser = JSON.parse(localStorage.getItem('sb-izzpzsglprvpldkustqn-auth-token') || '{}');
    const userId = currentLocalUser?.user?.id;

    if (userId) {
      await migrateLocalGuestDataToSupabase(userId);
    } else {
      clearGuestData();
    }

    await refreshData();
    setLoading(false);
    setShowMigrationPrompt(false);
    setSuccessMsg('¡Tus datos locales han sido migrados a tu cuenta en la nube con éxito!');
    setTimeout(() => onClose(), 1500);
  };

  // Opción 2: El usuario decide EMPEZAR DE CERO
  const handleConfirmDiscardLocalData = async () => {
    clearGuestData();
    await refreshData();
    setShowDiscardWarning(false);
    setShowMigrationPrompt(false);
    setSuccessMsg('Tu cuenta ha iniciado limpia desde cero.');
    setTimeout(() => onClose(), 1200);
  };

  return (
    <ModalShell onClose={onClose} maxWidth="28rem">
      <div className="relative p-6 sm:p-7 text-white overflow-hidden">
        {/* Botón Cerrar */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

          {/* PASO 1: Formulario Normal de Login / Register */}
          {!showMigrationPrompt && !showDiscardWarning && (
            <>
              <h2 className="text-xl sm:text-2xl font-black font-display tracking-tight text-white mb-1">
                {tab === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
              </h2>
              <p className="text-xs text-slate-400 mb-5">
                {isConfigured
                  ? 'Acceso directo a tu base de datos en la nube (PostgreSQL)'
                  : 'Modo Demo (agrega tus credenciales en el archivo .env)'}
              </p>

              {/* Pestañas Login / Register */}
              <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-black/40 border border-white/10 mb-5">
                <button
                  type="button"
                  onClick={() => { setTab('login'); setError(null); }}
                  className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${tab === 'login'
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25'
                      : 'text-slate-400 hover:text-white'
                    }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Iniciar Sesión</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setTab('register'); setError(null); }}
                  className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${tab === 'register'
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25'
                      : 'text-slate-400 hover:text-white'
                    }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Crear Cuenta</span>
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {tab === 'register' && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Nombre Completo
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        placeholder="Tu Nombre"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/15 rounded-xl text-sm text-white outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Correo Electrónico
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      placeholder="tu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/15 rounded-xl text-sm text-white outline-none focus:border-cyan-400"
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/15 rounded-xl text-sm text-white outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 rounded-2xl bg-linear-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold text-sm shadow-xl shadow-cyan-500/25 transition-all duration-200 hover:scale-[1.02] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span>{loading ? 'Procesando...' : tab === 'login' ? 'Iniciar Sesión' : 'Registrarse'}</span>
                </button>
              </form>
            </>
          )}

          {/* PASO 2: Pregunta de Migración de Datos Locales (Solo en Registro) */}
          {showMigrationPrompt && !showDiscardWarning && (
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 mx-auto flex items-center justify-center">
                <CloudUpload className="w-6 h-6" />
              </div>

              <div className="text-center">
                <h3 className="text-lg font-black font-display mb-1 text-white">
                  ¿Pasar datos locales a tu nueva cuenta?
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Detectamos <span className="font-bold text-cyan-400">{localTxCount} transacciones</span> registradas en esta máquina. ¿Deseas subirlas a tu cuenta de Supabase en la nube o empezar desde cero?
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={handleConfirmMigrateLocalData}
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-linear-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold text-xs shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 transition-all hover:scale-105"
                >
                  <CloudUpload className="w-4 h-4" />
                  <span>{loading ? 'Migrando datos...' : 'Sí, migrar mis datos locales'}</span>
                </button>

                <button
                  onClick={() => setShowDiscardWarning(true)}
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-bold text-xs border border-white/10 transition-all"
                >
                  No, empezar desde cero
                </button>
              </div>
            </div>
          )}

          {/* PASO 3: Advertencia de Confirmación si elige NO migrar */}
          {showDiscardWarning && (
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 mx-auto flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <div className="text-center">
                <h3 className="text-lg font-black font-display mb-1 text-white">
                  ¿Estás seguro de descartar los datos locales?
                </h3>
                <p className="text-xs text-amber-300/90 leading-relaxed">
                  ⚠️ Se perderán permanentemente las {localTxCount} transacciones guardadas en esta máquina y tu nueva cuenta empezará completamente en blanco.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setShowDiscardWarning(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs"
                >
                  Volver Atrás
                </button>
                <button
                  onClick={handleConfirmDiscardLocalData}
                  className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-black text-xs shadow-lg shadow-rose-500/25"
                >
                  Confirmar y Empezar de Cero
                </button>
              </div>
            </div>
          )}
      </div>
    </ModalShell>
  );
}
