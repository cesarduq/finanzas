import React, { useState } from 'react';
import { X, Upload, Download, Database, CheckCircle2, AlertCircle, FileJson } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { supabase, isSupabaseConfigured } from '../../config/supabase';
import { ModalShell } from '../ui/ModalShell';

interface BackupModalProps {
  onClose: () => void;
}

export function BackupModal({ onClose }: BackupModalProps) {
  const { user } = useAuth();
  const { accounts, transactions, debts, debtPayments, refreshData } = useFinance();
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Exportar respaldo completo actual
  const handleExportBackup = () => {
    const backupData = {
      version: '2.0',
      exported_at: new Date().toISOString(),
      user_email: user?.email || 'local',
      accounts,
      transactions,
      debts,
      debtPayments,
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Respaldo_Finanzas_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSuccessMsg('¡Respaldo descargado exitosamente!');
  };

  // Importar archivo JSON (soporta formato nuevo o el formato legado Respaldo_Finanzas_2025-12-21.json)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      await processImportData(parsed);
    } catch (err: any) {
      setErrorMsg('Error al procesar el archivo JSON: ' + (err?.message || 'Formato no válido'));
    } finally {
      setLoading(false);
    }
  };

  // Importar el respaldo del workspace directamente (Respaldo_Finanzas_2025-12-21.json)
  const handleImportWorkspaceBackup = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch('/Respaldo_Finanzas_2025-12-21.json');
      if (!response.ok) {
        throw new Error('No se encontró el archivo de respaldo en la raíz');
      }
      const data = await response.json();
      await processImportData(data);
    } catch (err: any) {
      setErrorMsg('Error al importar: ' + (err?.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const processImportData = async (data: any) => {
    if (!user && isSupabaseConfigured) {
      setErrorMsg('Debes iniciar sesión para guardar los datos en Supabase');
      return;
    }

    const userId = user?.id || 'local';

    // Caso 1: Archivo Legado (Array plano de transacciones [{id, date, type, account, amount, desc, person}...])
    if (Array.isArray(data)) {
      let importedTxCount = 0;
      let importedDebtsCount = 0;

      // Mapeo de nombres legados de cuentas a las cuentas actuales
      const accMap: Record<string, string> = {
        'pichincha': 'Banco Pichincha',
        'guayaquil': 'Banco Guayaquil',
        'peigo': 'Peigo',
        'produbanco': 'Produbanco',
        'binance': 'Binance',
        'uglycash': 'Ugly Cash',
        'ugly cash': 'Ugly Cash',
        'ugly': 'Ugly Cash',
        'airtm': 'Airtm',
        'efectivo': 'Efectivo',
        'morse': 'Morse',
        'hapi': 'Hapi (Broker)',
      };

      for (const item of data) {
        const rawAcc = (item.account || '').toLowerCase().trim();
        const matchedName = accMap[rawAcc] || item.account || 'Efectivo';
        const targetAcc = accounts.find((a) => a.name.toLowerCase().includes(matchedName.toLowerCase()));

        // Manejar préstamos / deudas
        if (item.type === 'loan_out' || item.type === 'loan_payment' || item.person) {
          const personName = item.person || 'Persona';
          const isAbono = item.type === 'loan_payment';

          if (isSupabaseConfigured && supabase && user) {
            // Buscar o crear deuda
            let { data: existingDebt } = await supabase
              .from('debts')
              .select('*')
              .eq('user_id', userId)
              .ilike('person_name', personName)
              .maybeSingle();

            if (!existingDebt) {
              const { data: newD } = await supabase
                .from('debts')
                .insert({
                  user_id: userId,
                  person_name: personName,
                  type: 'me_deben',
                  initial_amount: Number(item.amount),
                  current_balance: Number(item.amount),
                  status: 'active',
                })
                .select()
                .single();
              existingDebt = newD;
            }

            if (existingDebt) {
              await supabase.from('debt_payments').insert({
                user_id: userId,
                debt_id: existingDebt.id,
                amount: Number(item.amount),
                type: isAbono ? 'abono' : 'cargo',
                note: item.desc || '',
                date: item.date ? new Date(item.date).toISOString() : new Date().toISOString(),
              });
              importedDebtsCount++;
            }
          }
        } else {
          // Transacción normal
          let txType: 'ingreso' | 'gasto' | 'transferencia' | 'inversion' = 'gasto';
          if (item.type === 'ingreso' || item.type === 'trade_profit') txType = 'ingreso';
          if (item.type === 'gasto' || item.type === 'trade_loss') txType = 'gasto';

          if (isSupabaseConfigured && supabase && user) {
            await supabase.from('transactions').insert({
              user_id: userId,
              account_id: targetAcc?.id || accounts[0]?.id,
              type: txType,
              amount: Number(item.amount),
              category: item.type.includes('trade') ? 'Trading / Cripto' : 'General',
              note: item.desc || '',
              date: item.date ? new Date(item.date).toISOString() : new Date().toISOString(),
            });
            importedTxCount++;
          }
        }
      }

      await refreshData();
      setSuccessMsg(`¡Migración completada! Se procesaron ${importedTxCount} transacciones y ${importedDebtsCount} movimientos de deudas.`);
      return;
    }

    // Caso 2: Respaldo v2 estructurado
    if (data.transactions && Array.isArray(data.transactions)) {
      if (isSupabaseConfigured && supabase && user) {
        for (const tx of data.transactions) {
          await supabase.from('transactions').insert({
            user_id: userId,
            account_id: tx.account_id,
            destination_account_id: tx.destination_account_id,
            type: tx.type,
            amount: tx.amount,
            category: tx.category,
            note: tx.note,
            date: tx.date,
          });
        }
      }
      await refreshData();
      setSuccessMsg('¡Datos importados y sincronizados con éxito!');
    }
  };

  return (
    <ModalShell onClose={onClose} maxWidth="32rem">
      <div className="relative p-6 sm:p-7 text-white">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3.5 mb-2">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 border border-white/20 flex items-center justify-center text-white shadow-lg shadow-cyan-500/25">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black font-display tracking-tight text-white">
                Copias de Seguridad (JSON)
              </h2>
              <p className="text-xs text-slate-400">
                Guarda una copia de tus finanzas o restaura tus datos en cualquier momento.
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 my-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 p-3 my-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="space-y-4 mt-5">
            {/* Opción 1: Cargar / Importar archivo JSON */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-800/60 border border-white/10 hover:border-cyan-400/40 transition-all">
              <div className="flex items-center gap-2 mb-1.5">
                <Upload className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-bold text-white">
                  1. Cargar / Importar Respaldo (.JSON)
                </span>
              </div>
              <p className="text-xs text-slate-300/90 mb-3.5 leading-relaxed">
                Selecciona un archivo JSON previamente exportado para restaurar tus transacciones, saldos, cuentas y préstamos.
              </p>
              <label className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.02] active:scale-95">
                <Upload className="w-4 h-4 text-slate-950" />
                <span>{loading ? 'Procesando e Importando...' : 'Seleccionar y Cargar Archivo .JSON'}</span>
                <input
                  type="file"
                  accept=".json"
                  disabled={loading}
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Opción 2: Exportar / Descargar respaldo actual */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-800/60 border border-white/10 hover:border-emerald-400/40 transition-all">
              <div className="flex items-center gap-2 mb-1.5">
                <Download className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-bold text-white">
                  2. Exportar Copia de Seguridad Actual (.JSON)
                </span>
              </div>
              <p className="text-xs text-slate-300/90 mb-3.5 leading-relaxed">
                Genera y descarga un archivo JSON seguro con todos tus movimientos, cuentas y deudas actuales para guardarlo en tu computadora.
              </p>
              <button
                type="button"
                onClick={handleExportBackup}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 hover:text-white border border-emerald-500/40 text-xs font-black transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Descargar Copia de Seguridad Actual (.JSON)</span>
              </button>
            </div>
          </div>
      </div>
    </ModalShell>
  );
}
