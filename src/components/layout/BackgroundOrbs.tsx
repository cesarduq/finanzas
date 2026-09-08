import React from 'react';

export function BackgroundOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none">
      {/* 1. Gran Mancha Orgánica Lado Derecho / Inferior - Azul Real & Zafiro Intenso */}
      <div 
        className="absolute -bottom-[120px] -right-[150px] w-[980px] h-[880px] opacity-60 blur-[130px] -rotate-12"
        style={{
          borderRadius: '42% 58% 70% 30% / 45% 45% 55% 55%',
          background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 40%, #1e3a8a 75%, #0f172a 100%)',
        }}
      />

      {/* 2. Mancha Orgánica Superior Izquierda - Cyan Eléctrico & Azul Cielo Luminoso */}
      <div 
        className="absolute -top-[160px] -left-[140px] w-[800px] h-[700px] opacity-50 blur-[140px] rotate-45"
        style={{
          borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%',
          background: 'radial-gradient(ellipse at center, #00d4ff 0%, #0284c7 45%, #1e40af 80%, transparent 100%)',
        }}
      />

      {/* 3. Mancha Irregular Central Superior - Azul Índigo / Violeta Neón Suave */}
      <div 
        className="absolute top-[10%] left-[30%] w-[750px] h-[600px] opacity-45 blur-[150px] -rotate-45"
        style={{
          borderRadius: '30% 70% 70% 30% / 30% 30% 70% 70%',
          background: 'radial-gradient(circle, #6366f1 0%, #4f46e5 45%, #1e1b4b 80%, transparent 100%)',
        }}
      />

      {/* 4. Mancha Orgánica Centro-Derecha - Azul Cobalto / Cerúleo Brillante */}
      <div 
        className="absolute top-[38%] right-[8%] w-[720px] h-[720px] opacity-55 blur-[130px] rotate-12"
        style={{
          borderRadius: '50% 50% 30% 70% / 50% 30% 70% 60%',
          background: 'linear-gradient(160deg, #38bdf8 0%, #2563eb 50%, #172554 90%)',
        }}
      />

      {/* 5. Mancha Irregular Inferior Izquierda - Azul Real & Océano Zafiro */}
      <div 
        className="absolute bottom-[2%] left-[4%] w-[780px] h-[650px] opacity-45 blur-[140px] rotate-45"
        style={{
          borderRadius: '70% 30% 50% 50% / 30% 60% 40% 70%',
          background: 'radial-gradient(ellipse, #1d4ed8 0%, #1e3a8a 45%, #0f172a 85%, transparent 100%)',
        }}
      />

      {/* 6. Destello de Luz Cristalina / Hielo en el Centro para dar más claridad */}
      <div 
        className="absolute top-[28%] left-[45%] w-[550px] h-[450px] opacity-35 blur-[120px]"
        style={{
          borderRadius: '45% 55% 60% 40% / 50% 60% 40% 50%',
          background: 'radial-gradient(circle, #93c5fd 0%, #38bdf8 40%, #1d4ed8 75%, transparent 100%)',
        }}
      />

      {/* Sutil textura de cuadrícula tecnológica */}
      <div 
        className="absolute inset-0 opacity-[0.035] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.15) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />
    </div>
  );
}

