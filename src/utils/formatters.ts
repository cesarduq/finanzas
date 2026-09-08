/**
 * Formatea valores numéricos a moneda ($ USD)
 */
export function formatCurrency(value: number, decimals: number = 2): string {
  if (isNaN(value) || value === null || value === undefined) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Formatea valores a porcentaje (+12.5% o -4.2%)
 */
export function formatPercentage(value: number, includeSign: boolean = true): string {
  if (isNaN(value) || value === null || value === undefined) return '0.0%';
  const formatted = value.toFixed(1) + '%';
  if (includeSign && value > 0) {
    return '+' + formatted;
  }
  return formatted;
}

/**
 * Retorna la fecha de hoy en formato YYYY-MM-DD según la zona horaria local del navegador/Ecuador
 */
export function getLocalTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Convierte un string YYYY-MM-DD a ISO UTC preservando el día exacto
 */
export function dateStringToIso(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  if (dateStr.includes('T')) return new Date(dateStr).toISOString();
  const date = new Date(`${dateStr}T12:00:00`);
  return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

/**
 * Formatea fechas a formato legible en español
 */
export function formatDate(dateString: string, includeTime: boolean = false): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  const options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  };

  return new Intl.DateTimeFormat('es-EC', options).format(date);
}

export function formatTime(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-EC', { hour: '2-digit', minute: '2-digit' }).format(date);
}


