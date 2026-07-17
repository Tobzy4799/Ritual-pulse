import type { PublicClient } from 'viem';
import { GUESS_GAME_ADDRESS, guessGameAbi } from './guessGame';

export interface LeaderboardEntry {
  address: `0x${string}`;
  wins: number;
  losses: number;
}

export async function fetchLeaderboard(publicClient: PublicClient, limit = 10): Promise<LeaderboardEntry[]> {
  const latest = await publicClient.getBlockNumber();
  // Look back far enough to cover this contract's whole lifetime so far.
  const lookback = 90_000n;
  const fromBlock = latest > lookback ? latest - lookback : 0n;

  const logs = await publicClient.getContractEvents({
    address: GUESS_GAME_ADDRESS,
    abi: guessGameAbi,
    eventName: 'GuessResolved',
    fromBlock,
    toBlock: latest,
  });

  const tally = new Map<string, { wins: number; losses: number }>();
  for (const log of logs) {
    const args = log.args as { user?: string; won?: boolean };
    if (!args.user) continue;
    const entry = tally.get(args.user) ?? { wins: 0, losses: 0 };
    if (args.won) entry.wins++;
    else entry.losses++;
    tally.set(args.user, entry);
  }

  return Array.from(tally.entries())
    .map(([address, { wins, losses }]) => ({ address: address as `0x${string}`, wins, losses }))
    .sort((a, b) => b.wins - a.wins)
    .slice(0, limit);
}
