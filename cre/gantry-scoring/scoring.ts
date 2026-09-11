import { encodeAbiParameters, parseAbiParameters } from "viem";

/**
 * Tier rules, kept free of any SDK import so they can be tested on their own and
 * read by anyone. The rules are public on purpose; the thresholds are not.
 */
/** Everything the scorer needs about one address, as served by the indexer. */
export type AddressFeatures = {
  address: string;
  swaps: number;
  blocks: number;
  sandwiches: number;
  victimsHarmed: number;
  roundTrips: number;
  originators: number;
  firstBlock: number;
  lastBlock: number;
  /**
   * Transactions that reached the PoolManager and reverted. Read from transaction
   * traces, so it exists only because the pipeline is Substreams: a reverted
   * transaction writes no logs, and an event indexer never sees it happen.
   */
  failedAttempts: number;
};

/**
 * The dials that decide a tier. These arrive as a secret and are never written
 * anywhere the chain can see. The rules below are public; the numbers are not,
 * because a published threshold is one an extractor can sit just underneath.
 */
export type ScoringParams = {
  extractorMinSandwiches: number;
  suspectedMinSandwiches: number;
  suspectedRoundTripsPerBlock: number;
  cleanMinSwaps: number;
  cleanMinBlockSpan: number;
  sharedInfraMinOriginators: number;
  suspectedMinFailedAttempts: number;
  cleanMaxFailedAttempts: number;
};

export const TIER_CLEAN = 0;
export const TIER_UNKNOWN = 1;
export const TIER_SUSPECTED = 2;
export const TIER_EXTRACTOR = 3;

export const isSharedInfrastructure = (f: AddressFeatures, p: ScoringParams): boolean =>
  f.originators >= p.sharedInfraMinOriginators;

export const scoreAddress = (f: AddressFeatures, p: ScoringParams): number => {
  // Pricing a shared router charges every trader behind it, so it stays neutral.
  if (isSharedInfrastructure(f, p)) return TIER_UNKNOWN;

  if (f.sandwiches >= p.extractorMinSandwiches) return TIER_EXTRACTOR;
  if (f.sandwiches >= p.suspectedMinSandwiches) return TIER_SUSPECTED;

  const perBlock = f.blocks === 0 ? 0 : f.roundTrips / f.blocks;
  if (perBlock >= p.suspectedRoundTripsPerBlock) return TIER_SUSPECTED;

  // Repeatedly reverting inside the PoolManager is what a bot racing for a position
  // looks like when it loses. Only a trace-level pipeline can count those.
  if (f.failedAttempts >= p.suspectedMinFailedAttempts) return TIER_SUSPECTED;

  const span = f.lastBlock - f.firstBlock;
  if (
    f.swaps >= p.cleanMinSwaps &&
    span >= p.cleanMinBlockSpan &&
    f.failedAttempts <= p.cleanMaxFailedAttempts
  ) {
    return TIER_CLEAN;
  }

  return TIER_UNKNOWN;
};

export const encodeTierReport = (rows: { address: string; tier: number }[]): `0x${string}` =>
  encodeAbiParameters(parseAbiParameters("address[], uint8[]"), [
    rows.map((r) => r.address as `0x${string}`),
    rows.map((r) => r.tier),
  ]);
