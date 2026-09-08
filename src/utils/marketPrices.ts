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

const LIVE_PRICES_KEY = 'finanzas_live_prices_v2';

const DEFAULT_PRICES: LiveMarketPrices = {
  SP500: { price: 546.50, change: 0.45, ticker: 'VOO', name: 'Vanguard S&P 500 ETF' },
  Nasdaq: { price: 494.30, change: 0.68, ticker: 'QQQ', name: 'Invesco QQQ (NASDAQ-100)' },
  lastUpdated: null,
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

export async function fetchLiveMarketPrices(): Promise<LiveMarketPrices> {
  const current = getCachedMarketPrices();
  const symbols = [
    { key: 'SP500' as const, ticker: 'VOO', fallback: 546.50 },
    { key: 'Nasdaq' as const, ticker: 'QQQ', fallback: 494.30 },
  ];

  let updated = { ...current };

  for (const item of symbols) {
    try {
      const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${item.ticker}?interval=1d`;
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const resp = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const json = await resp.json();
        const meta = json?.chart?.result?.[0]?.meta;
        if (meta && meta.regularMarketPrice) {
          const currentPrice = meta.regularMarketPrice;
          const prevClose = meta.chartPreviousClose || meta.previousClose || currentPrice;
          const changePct = prevClose > 0 ? ((currentPrice - prevClose) / prevClose) * 100 : 0;

          updated[item.key] = {
            ...updated[item.key],
            price: Math.round(currentPrice * 100) / 100,
            change: Math.round(changePct * 100) / 100,
          };
        }
      }
    } catch (err) {
      console.warn(`No se pudo obtener precio para ${item.ticker}, usando precio en caché.`);
    }
  }

  updated.lastUpdated = new Date().toISOString();
  localStorage.setItem(LIVE_PRICES_KEY, JSON.stringify(updated));
  return updated;
}
