/**
 * Generador de resplandores holográficos multicromáticos adaptados por banco / color base
 * Inspirado en el sistema de diseño de MetricCard con 5-6 tonos nítidos RGBA
 */
export function getTailoredHoloGradient(color?: string): string {
  if (!color) {
    return 'linear-gradient(90deg, transparent 0%, rgba(6, 182, 212, 0.15) 15%, rgba(139, 92, 246, 0.55) 35%, rgba(16, 185, 129, 0.55) 60%, rgba(6, 182, 212, 0.45) 80%, rgba(56, 189, 248, 0.35) 92%, transparent 100%)';
  }

  const c = color.toLowerCase();

  // 1. Paleta Amarilla / Dorada (Pichincha, Binance: #f59e0b, #eab308, #fbbf24)
  if (c.includes('f59e0b') || c.includes('eab308') || c.includes('fbbf24') || c.includes('yellow') || c.includes('gold')) {
    return 'linear-gradient(90deg, transparent 0%, rgba(245,158,11,0.15) 15%, rgba(251,191,36,0.60) 35%, rgba(249,115,22,0.55) 55%, rgba(234,179,8,0.50) 75%, rgba(253,224,71,0.35) 90%, transparent 100%)';
  }

  // 2. Paleta Esmeralda / Verde Neón (Deuna!, Efectivo: #10b981, #16a34a, #059669)
  if (c.includes('10b981') || c.includes('16a34a') || c.includes('059669') || c.includes('green') || c.includes('emerald')) {
    return 'linear-gradient(90deg, transparent 0%, rgba(16,185,129,0.15) 15%, rgba(45,212,191,0.60) 35%, rgba(52,211,153,0.55) 55%, rgba(132,204,22,0.45) 75%, rgba(16,185,129,0.35) 90%, transparent 100%)';
  }

  // 3. Paleta Magenta / Carmesí (Banco Guayaquil: #e11d48, #ef4444, #f43f5e)
  if (c.includes('e11d48') || c.includes('ef4444') || c.includes('f43f5e') || c.includes('red') || c.includes('rose') || c.includes('pink')) {
    return 'linear-gradient(90deg, transparent 0%, rgba(225,29,72,0.15) 15%, rgba(244,63,94,0.60) 35%, rgba(249,115,22,0.50) 55%, rgba(217,70,239,0.50) 75%, rgba(225,29,72,0.35) 90%, transparent 100%)';
  }

  // 4. Paleta Cyan / Aqua (Peigo, Ugly Cash: #06b6d4, #38bdf8, #009bb1)
  if (c.includes('06b6d4') || c.includes('38bdf8') || c.includes('009bb1') || c.includes('cyan') || c.includes('teal')) {
    return 'linear-gradient(90deg, transparent 0%, rgba(6,182,212,0.15) 15%, rgba(56,189,248,0.60) 35%, rgba(20,184,166,0.55) 55%, rgba(16,185,129,0.45) 75%, rgba(6,182,212,0.35) 90%, transparent 100%)';
  }

  // 5. Paleta Azul Real / Indigo (Produbanco, Airtm: #0284c7, #2563eb, #3b82f6)
  if (c.includes('0284c7') || c.includes('2563eb') || c.includes('3b82f6') || c.includes('blue') || c.includes('indigo')) {
    return 'linear-gradient(90deg, transparent 0%, rgba(37,99,235,0.15) 15%, rgba(96,165,250,0.60) 35%, rgba(14,165,233,0.55) 55%, rgba(99,102,241,0.50) 75%, rgba(56,189,248,0.35) 90%, transparent 100%)';
  }

  // 6. Paleta Naranja Fuego (Morse: #f97316, #ea580c)
  if (c.includes('f97316') || c.includes('ea580c') || c.includes('orange')) {
    return 'linear-gradient(90deg, transparent 0%, rgba(249,115,22,0.15) 15%, rgba(251,146,60,0.60) 35%, rgba(234,88,12,0.55) 55%, rgba(245,158,11,0.50) 75%, rgba(251,191,36,0.35) 90%, transparent 100%)';
  }

  // 7. Paleta Púrpura / Violeta Eléctrico (Hapi, Por Cobrar, Patrimonio: #8b5cf6, #a855f7, #7c3aed)
  if (c.includes('8b5cf6') || c.includes('a855f7') || c.includes('7c3aed') || c.includes('purple') || c.includes('violet')) {
    return 'linear-gradient(90deg, transparent 0%, rgba(124,58,237,0.15) 15%, rgba(139,92,246,0.60) 35%, rgba(168,85,247,0.65) 55%, rgba(217,70,239,0.50) 75%, rgba(244,114,182,0.35) 90%, transparent 100%)';
  }

  // Default
  return 'linear-gradient(90deg, transparent 0%, rgba(6, 182, 212, 0.15) 15%, rgba(139, 92, 246, 0.55) 35%, rgba(16, 185, 129, 0.55) 60%, rgba(6, 182, 212, 0.45) 80%, rgba(56, 189, 248, 0.35) 92%, transparent 100%)';
}
