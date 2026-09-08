import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Transaction } from '../../types/database';
import { TransactionForm } from './TransactionForm';

interface TransactionModalProps {
  onClose: () => void;
  defaultAccountId?: string;
  editTransaction?: Transaction;
}

export function TransactionModal({ onClose, defaultAccountId, editTransaction }: TransactionModalProps) {
  React.useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg my-auto rounded-3xl overflow-hidden shadow-2xl"
        >
          {/* Botón Cerrar */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <TransactionForm
            defaultAccountId={defaultAccountId}
            editTransaction={editTransaction}
            onSuccess={onClose}
            isCompact={true}
          />
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

