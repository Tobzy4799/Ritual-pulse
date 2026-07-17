'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePublicClient } from 'wagmi';
import type { Address } from 'viem';
import { PREDICTION_GAME_ADDRESS, predictionGameAbi } from './predictionGame';

export interface PredictionRecord {
  id: bigint;
  user: Address;
  direction: number; // 0 = Up, 1 = Down
  baselinePrice: bigint;
  predictedAt: bigint;
  symbol: string;
  status: number; // 0 = Open, 1 = Won, 2 = Lost
  resolved: boolean;
}

export function usePredictions(user: Address | undefined) {
  const publicClient = usePublicClient();
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || !publicClient) return;
    setLoading(true);
    try {
      const nextId = await publicClient.readContract({
        address: PREDICTION_GAME_ADDRESS,
        abi: predictionGameAbi,
        functionName: 'nextPredictionId',
      });

      const results: PredictionRecord[] = [];
      for (let id = 0n; id < nextId; id++) {
        const p = await publicClient.readContract({
          address: PREDICTION_GAME_ADDRESS,
          abi: predictionGameAbi,
          functionName: 'predictions',
          args: [id],
        });
        const [pUser, direction, baselinePrice, predictedAt, symbol, status, resolved] = p;
        if (pUser.toLowerCase() === user.toLowerCase()) {
          results.push({ id, user: pUser, direction, baselinePrice, predictedAt, symbol, status, resolved });
        }
      }
      setPredictions(results.reverse());
    } finally {
      setLoading(false);
    }
  }, [user, publicClient]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { predictions, loading, refresh };
}
