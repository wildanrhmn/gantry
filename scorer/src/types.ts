/** One swap as observed on chain, ordered within its block by `index`. */
export interface Swap {
  blockNumber: number;
  index: number;
  poolId: string;
  sender: string;
  zeroForOne: boolean;
  amountIn: bigint;
  amountOut: bigint;
  /** Transaction originator. Substreams provides this; eth_getLogs cannot. */
  txFrom?: string;
}

export interface Sandwich {
  poolId: string;
  blockNumber: number;
  attacker: string;
  victims: string[];
  frontrunIndex: number;
  backrunIndex: number;
}

export interface AddressFeatures {
  address: string;
  swaps: number;
  blocks: number;
  sandwiches: number;
  victimsHarmed: number;
  roundTrips: number;
  firstBlock: number;
  lastBlock: number;
  /** How many distinct EOAs traded through this address. */
  originators: number;
  /** Transactions that reached the PoolManager and reverted. Trace-level, never logged. */
  failedAttempts: number;
}

export const Tier = {
  Clean: 0,
  Unknown: 1,
  Suspected: 2,
  Extractor: 3,
} as const;

export type TierValue = (typeof Tier)[keyof typeof Tier];
