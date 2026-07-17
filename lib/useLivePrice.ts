'use client';

import { useEffect, useState } from 'react';
import { COINS } from './coins';

interface CoinPrice {
  usd: number;
  change24h: number;
}

// Read-only, no wallet involved — plain fetches straight to CoinGecko for
// display purposes. The real on-chain price (used for the actual guess) is
// still fetched via the precompile when the user commits.
export function useLivePrice() {
  const [prices, setPrices] = useState<Record<string, CoinPrice>>({});

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const ids = COINS.map((c) => c.id).join(',');
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
        const res = await fetch(url);
        const data = await res.json();
        if (!cancelled) {
          const next: Record<string, CoinPrice> = {};
          for (const c of COINS) {
            if (data[c.id]) {
              next[c.id] = { usd: data[c.id].usd, change24h: data[c.id].usd_24h_change ?? 0 };
            }
          }
          setPrices(next);
        }
      } catch {
        // Silent — this is a cosmetic display feature, not critical path.
      }
    }

    poll();
    const interval = setInterval(poll, 15_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { prices };
}