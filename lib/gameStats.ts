import type { PublicClient } from 'viem';
import { GUESS_GAME_ADDRESS, guessGameAbi, STAKE_AMOUNT_ETH } from './guessGame';

export interface GameStats {
  totalGuesses: number;
  totalStakedEth: number;
}

export async function fetchGameStats(publicClient: PublicClient): Promise<GameStats> {
  const nextGuessId = await publicClient.readContract({
    address: GUESS_GAME_ADDRESS,
    abi: guessGameAbi,
    functionName: 'nextGuessId',
  });

  const totalGuesses = Number(nextGuessId);
  const totalStakedEth = totalGuesses * parseFloat(STAKE_AMOUNT_ETH);

  return { totalGuesses, totalStakedEth };
}