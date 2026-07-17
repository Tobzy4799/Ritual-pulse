import type { Address } from 'viem';

export const PREDICTION_GAME_V2_ADDRESS: Address = '0xbCd730B2bD07CC0A0d2Ab3Ff3005D14e3e1B3496';

export const STAKE_AMOUNT_ETH = '0.001';
export const MIN_WAIT_SECONDS = 8 * 60 * 60;

export const Direction = { Up: 0, Down: 1 } as const;

export const predictionGameV2Abi = [
  {
    name: 'fetchPrice',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'executor', type: 'address' },
      { name: 'ttl', type: 'uint256' },
      { name: 'url', type: 'string' },
      { name: 'symbol', type: 'string' },
    ],
    outputs: [
      { name: 'priceId', type: 'uint256' },
      { name: 'price', type: 'uint256' },
    ],
  },
  {
    name: 'stake',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'baselinePriceId', type: 'uint256' },
      { name: 'direction', type: 'uint8' },
    ],
    outputs: [{ name: 'predictionId', type: 'uint256' }],
  },
  {
    name: 'resolve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'predictionId', type: 'uint256' },
      { name: 'finalPriceId', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'prices',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [
      { name: 'user', type: 'address' },
      { name: 'price', type: 'uint256' },
      { name: 'timestamp', type: 'uint256' },
      { name: 'symbol', type: 'string' },
    ],
  },
  {
    name: 'predictions',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [
      { name: 'user', type: 'address' },
      { name: 'direction', type: 'uint8' },
      { name: 'baselinePriceId', type: 'uint256' },
      { name: 'predictedAt', type: 'uint256' },
      { name: 'status', type: 'uint8' },
      { name: 'resolved', type: 'bool' },
    ],
  },
  {
    name: 'nextPriceId',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
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
] as const;
