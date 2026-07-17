import type { Address } from 'viem';

export const PREDICTION_GAME_ADDRESS: Address = '0x71Fe846b2A6b288399d10CE3b1F2EE0739d2153C';

export const STAKE_AMOUNT_ETH = '0.001';
export const MIN_WAIT_SECONDS = 8 * 60 * 60;

export const Direction = { Up: 0, Down: 1 } as const;

export const predictionGameAbi = [
  {
    name: 'makePrediction',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'direction', type: 'uint8' },
      { name: 'executor', type: 'address' },
      { name: 'ttl', type: 'uint256' },
      { name: 'url', type: 'string' },
      { name: 'symbol', type: 'string' },
    ],
    outputs: [{ name: 'predictionId', type: 'uint256' }],
  },
  {
    name: 'resolvePrediction',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'predictionId', type: 'uint256' },
      { name: 'executor', type: 'address' },
      { name: 'ttl', type: 'uint256' },
      { name: 'url', type: 'string' },
    ],
    outputs: [],
  },
  {
    name: 'predictions',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [
      { name: 'user', type: 'address' },
      { name: 'direction', type: 'uint8' },
      { name: 'baselinePrice', type: 'uint256' },
      { name: 'predictedAt', type: 'uint256' },
      { name: 'symbol', type: 'string' },
      { name: 'status', type: 'uint8' },
      { name: 'resolved', type: 'bool' },
    ],
  },
  {
    name: 'nextPredictionId',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'wins',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'losses',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'PredictionMade',
    type: 'event',
    inputs: [
      { name: 'id', type: 'uint256', indexed: true },
      { name: 'user', type: 'address', indexed: true },
      { name: 'direction', type: 'uint8', indexed: false },
      { name: 'baselinePrice', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'PredictionResolved',
    type: 'event',
    inputs: [
      { name: 'id', type: 'uint256', indexed: true },
      { name: 'user', type: 'address', indexed: true },
      { name: 'won', type: 'bool', indexed: false },
      { name: 'finalPrice', type: 'uint256', indexed: false },
      { name: 'payout', type: 'uint256', indexed: false },
    ],
  },
] as const;
