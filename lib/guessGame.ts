import type { Address } from 'viem';

export const GUESS_GAME_ADDRESS: Address = '0x4d7fCe14c51cbfD5218fBfe30Aa08Bc115AfCF6B';

export const STAKE_AMOUNT_ETH = '0.001';
export const MIN_WAIT_SECONDS = 30 * 60;
export const RESOLVE_GRACE_SECONDS = 20 * 60; // extra time after MIN_WAIT before we consider a guess "stale"

export const Direction = { Up: 0, Down: 1 } as const;

export const guessGameAbi = [
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
    outputs: [],
  },
  {
    name: 'stake',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'knownPrice', type: 'uint256' },
      { name: 'direction', type: 'uint8' },
      { name: 'symbol', type: 'string' },
    ],
    outputs: [{ name: 'guessId', type: 'uint256' }],
  },
  {
    name: 'resolve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'guessId', type: 'uint256' },
      { name: 'knownFinalPrice', type: 'uint256' },
      { name: 'finalSymbol', type: 'string' },
    ],
    outputs: [],
  },
  {
    name: 'nextGuessId',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'guesses',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [
      { name: 'user', type: 'address' },
      { name: 'direction', type: 'uint8' },
      { name: 'baselinePrice', type: 'uint256' },
      { name: 'guessedAt', type: 'uint256' },
      { name: 'status', type: 'uint8' },
      { name: 'resolved', type: 'bool' },
      { name: 'symbol', type: 'string' },
    ],
  },
  {
    name: 'GuessStaked',
    type: 'event',
    inputs: [
      { name: 'id', type: 'uint256', indexed: true },
      { name: 'user', type: 'address', indexed: true },
      { name: 'direction', type: 'uint8', indexed: false },
      { name: 'baselinePrice', type: 'uint256', indexed: false },
      { name: 'symbol', type: 'string', indexed: false },
    ],
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
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'rewardPool',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'houseFunds',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'gameFeeBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'fundGameFees',
    type: 'function',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'fundRewardPool',
    type: 'function',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'withdrawHouseFunds',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'adminRefund',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'guessId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'GuessResolved',
    type: 'event',
    inputs: [
      { name: 'id', type: 'uint256', indexed: true },
      { name: 'user', type: 'address', indexed: true },
      { name: 'won', type: 'bool', indexed: false },
      { name: 'finalPrice', type: 'uint256', indexed: false },
      { name: 'payout', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'RewardPoolFunded',
    type: 'event',
    inputs: [
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'newTotal', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'HouseFundsWithdrawn',
    type: 'event',
    inputs: [{ name: 'amount', type: 'uint256', indexed: false }],
  },
  {
    name: 'GuessRefunded',
    type: 'event',
    inputs: [
      { name: 'id', type: 'uint256', indexed: true },
      { name: 'user', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;
