export interface Coin {
  id: string;
  symbol: string;
}

export const COINS: Coin[] = [
  { id: 'bitcoin', symbol: 'BTC' },
  { id: 'ethereum', symbol: 'ETH' },
  { id: 'solana', symbol: 'SOL' },
];

export function priceUrl(coinId: string): string {
  return `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`;
}
