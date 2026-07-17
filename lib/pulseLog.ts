import type { Address } from 'viem';

export const PULSE_LOG_ADDRESS: Address = '0x61eF430B6DFB586b8Df4001A6738c0a38206D21A';

export const pulseLogAbi = [
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
      { name: 'statusCode', type: 'uint16' },
      { name: 'body', type: 'bytes' },
    ],
  },
  {
    name: 'totalFetches',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'FetchLogged',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
      { name: 'symbol', type: 'string', indexed: false },
    ],
  },
] as const;
