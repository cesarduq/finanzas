// src/components/ui/ModalShell.tsx
// Componente compartido para todos los modales (excepto eliminación).
// Renderiza via portal directamente en document.body para garantizar
// centrado real en toda la página, independientemente del stacking context.

import React from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface ModalShellProps {
  /** Si el modal debe mostrarse */
  open?: boolean;
  /** Callback al cerrar (clic en backdrop) */
  onClose?: () => void;
  /** Ancho máximo del modal (default 'max-w-md') */
  maxWidth?: string;
  /** Altura máxima (default 'auto') */
  maxHeight?: string;
  children: React.ReactNode;
  /** Clases extra para el contenedor del modal */
  className?: string;
}

export function ModalShell({
  open = true,
  onClose,
  maxWidth = '28rem',
  maxHeight = '92vh',
  children,
  className = '',
}: ModalShellProps) {
  React.useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  const modal = (
    <AnimatePresence>
      {/* Backdrop: cubre toda la pantalla, siempre centrado */}
      <motion.div
        key="modal-shell-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99990,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // Padding vertical generoso: el scroll del viewport maneja modales muy altos
          padding: '1.5rem 1rem',
          overflowY: 'auto',
          background: 'rgba(4, 6, 20, 0.48)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && onClose) onClose();
        }}
      >
        {/* Contenedor del modal con triple gradiente azul */}
        <motion.div
          key="modal-shell-container"
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: 'spring', damping: 24, stiffness: 340 }}
          className={className}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth,
            // Sin maxHeight fijo ni overflowY en el shell:
            // el contenido dicta la altura real, el backdrop permite scroll si excede viewport
            overflow: 'hidden',
            borderRadius: '1.5rem',
            // Triple gradiente azul: oscuro → medio → oscuro
            background: 'linear-gradient(160deg, #0d1d3b 0%, #162e5c 44%, #080f1e 100%)',
            border: '1px solid rgba(56, 189, 248, 0.18)',
            boxShadow:
              '0 40px 80px -20px rgba(0,0,0,0.85), 0 0 0 1px rgba(56,189,248,0.08), inset 0 1px 0 rgba(255,255,255,0.07)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Glow ambiental superior derecho */}
          <div
            style={{
              position: 'absolute',
              top: '-3rem',
              right: '-3rem',
              width: '12rem',
              height: '12rem',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(56,189,248,0.10) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />
          {/* Glow ambiental inferior izquierdo */}
          <div
            style={{
              position: 'absolute',
              bottom: '-2.5rem',
              left: '-2.5rem',
              width: '9rem',
              height: '9rem',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return ReactDOM.createPortal(modal, document.body);
}
