// src/utils/marketPrices.ts

export interface MarketPriceInfo {
  price: number;
  change: number;
  ticker: string;
  name: string;
}

export interface LiveMarketPrices {
  SP500: MarketPriceInfo;
  Nasdaq: MarketPriceInfo;
  lastUpdated: string | null;
}

// Bumped to v4 para limpiar el cache viejo con precios pre-split de QQQ
const LIVE_PRICES_KEY = 'finanzas_live_prices_v4';

// Precios de referencia actualizados (Sep 2026 — ajustados post-split QQQ)
const DEFAULT_PRICES: LiveMarketPrices = {
  SP500: { price: 705.00, change: 0.0, ticker: 'VOO', name: 'Vanguard S&P 500 ETF' },
  Nasdaq: { price: 295.00, change: 0.0, ticker: 'QQQ', name: 'Invesco QQQ (NASDAQ-100)' },
  lastUpdated: null,
};

// Rangos de precio razonables para validar que la API no devuelva datos basura
const PRICE_SANITY = {
  VOO: { min: 400, max: 1200 },
  QQQ: { min: 150, max: 700 },
};

export function getCachedMarketPrices(): LiveMarketPrices {
  const cached = localStorage.getItem(LIVE_PRICES_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed.SP500 && parsed.Nasdaq) {
        return parsed;
      }
    } catch {}
  }
  return DEFAULT_PRICES;
}

/**
 * Intenta obtener el precio desde múltiples fuentes en cascada:
 * 1. Yahoo Finance v8 (proxy allorigins)
 * 2. Yahoo Finance v7 quote (proxy corsproxy.io)
 * 3. Precio en caché
 */
async function fetchTickerPrice(ticker: string): Promise<number | null> {
  const proxies = [
    // Fuente 1: Yahoo Finance v8 vía allorigins
    async () => {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      try {
        const resp = await fetch(proxyUrl, { signal: ctrl.signal });
        clearTimeout(t);
        if (!resp.ok) return null;
        const json = await resp.json();
        const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
        return typeof price === 'number' && price > 0 ? price : null;
      } catch { clearTimeout(t); return null; }
    },

    // Fuente 2: Yahoo Finance v7 quote vía corsproxy.io
    async () => {
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${ticker}`;
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      try {
        const resp = await fetch(proxyUrl, { signal: ctrl.signal });
        clearTimeout(t);
        if (!resp.ok) return null;
        const json = await resp.json();
        const price = json?.quoteResponse?.result?.[0]?.regularMarketPrice;
        return typeof price === 'number' && price > 0 ? price : null;
      } catch { clearTimeout(t); return null; }
    },

    // Fuente 3: Yahoo Finance v8 vía corsproxy.io
    async () => {
      const url = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d`;
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      try {
        const resp = await fetch(proxyUrl, { signal: ctrl.signal });
        clearTimeout(t);
        if (!resp.ok) return null;
        const json = await resp.json();
        const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
        return typeof price === 'number' && price > 0 ? price : null;
      } catch { clearTimeout(t); return null; }
    },
  ];

  const sanity = ticker === 'VOO' ? PRICE_SANITY.VOO : PRICE_SANITY.QQQ;

  for (const source of proxies) {
    try {
      const price = await source();
      if (price !== null) {
        // Validar que el precio esté en rango razonable
        if (price >= sanity.min && price <= sanity.max) {
          return Math.round(price * 100) / 100;
        } else {
          console.warn(`Precio fuera de rango para ${ticker}: $${price} (esperado ${sanity.min}-${sanity.max}), ignorando.`);
        }
      }
    } catch {}
  }

  return null;
}

export async function fetchLiveMarketPrices(): Promise<LiveMarketPrices> {
  const current = getCachedMarketPrices();
  const symbols: Array<{ key: keyof Omit<LiveMarketPrices, 'lastUpdated'>; ticker: string; fallback: number }> = [
    { key: 'SP500', ticker: 'VOO', fallback: current.SP500.price },
    { key: 'Nasdaq', ticker: 'QQQ', fallback: current.Nasdaq.price },
  ];

  const updated = { ...current };

  await Promise.all(
    symbols.map(async (item) => {
      const price = await fetchTickerPrice(item.ticker);
      if (price !== null) {
        const prevClose = updated[item.key].price || item.fallback;
        const changePct = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
        updated[item.key] = {
          ...updated[item.key],
          price,
          change: Math.round(changePct * 100) / 100,
        };
        console.log(`✅ ${item.ticker}: $${price}`);
      } else {
        console.warn(`⚠️ No se pudo obtener precio fresco para ${item.ticker}, usando $${item.fallback}`);
      }
    })
  );

  updated.lastUpdated = new Date().toISOString();
  localStorage.setItem(LIVE_PRICES_KEY, JSON.stringify(updated));
  return updated;
}
