import { Tier, type AddressFeatures, type TierValue } from "./types.ts";

/**
 * The dials that decide a tier. These are the values that live as secrets inside the
 * enclave: publishing the algorithm is fine, publishing the thresholds would just tell
 * an extractor exactly how much to do without being noticed.
 */
/**
 * Above this many distinct originators an address is infrastructure that many
 * unrelated people trade through, not somebody's trading contract. Measured on
 * mainnet: Uniswap's Universal Router shows ~1300 originators across 3500 swaps,
 * while a dedicated bot contract shows exactly one.
 */
export const SHARED_INFRA_MIN_ORIGINATORS = 5;

export function isSharedInfrastructure(features: AddressFeatures): boolean {
  return features.originators >= SHARED_INFRA_MIN_ORIGINATORS;
}

export interface ScoringParams {
  extractorMinSandwiches: number;
  suspectedMinSandwiches: number;
  suspectedRoundTripsPerBlock: number;
  cleanMinSwaps: number;
  cleanMinBlockSpan: number;
  suspectedMinFailedAttempts: number;
  cleanMaxFailedAttempts: number;
}

export const DEFAULT_PARAMS: ScoringParams = {
  extractorMinSandwiches: 3,
  suspectedMinSandwiches: 1,
  suspectedRoundTripsPerBlock: 0.5,
  cleanMinSwaps: 20,
  cleanMinBlockSpan: 5_000,
  suspectedMinFailedAttempts: 20,
  cleanMaxFailedAttempts: 2,
};

export function scoreAddress(features: AddressFeatures, params: ScoringParams = DEFAULT_PARAMS): TierValue {
  // Pricing a shared router would charge every trader behind it for one bot's
  // behaviour. Those addresses stay neutral; the traders behind them can attest.
  if (isSharedInfrastructure(features)) return Tier.Unknown;

  if (features.sandwiches >= params.extractorMinSandwiches) return Tier.Extractor;
  if (features.sandwiches >= params.suspectedMinSandwiches) return Tier.Suspected;

  const perBlock = features.blocks === 0 ? 0 : features.roundTrips / features.blocks;
  if (perBlock >= params.suspectedRoundTripsPerBlock) return Tier.Suspected;

  // Repeatedly reverting inside the PoolManager is what a bot racing for a position
  // looks like when it loses. Only a trace-level pipeline can count those.
  if (features.failedAttempts >= params.suspectedMinFailedAttempts) return Tier.Suspected;

  const span = features.lastBlock - features.firstBlock;
  if (
    features.swaps >= params.cleanMinSwaps &&
    span >= params.cleanMinBlockSpan &&
    features.failedAttempts <= params.cleanMaxFailedAttempts
  ) {
    return Tier.Clean;
  }

  // Anything we have not seen enough of stays unknown. Never clean by default.
  return Tier.Unknown;
}

export function scoreAll(
  features: AddressFeatures[],
  params: ScoringParams = DEFAULT_PARAMS,
): Map<string, TierValue> {
  return new Map(features.map((f) => [f.address, scoreAddress(f, params)]));
}

/** Only addresses worth writing on chain: shared infrastructure is left out entirely. */
export function publishableTiers(
  features: AddressFeatures[],
  params: ScoringParams = DEFAULT_PARAMS,
): Map<string, TierValue> {
  return new Map(
    features.filter((f) => !isSharedInfrastructure(f)).map((f) => [f.address, scoreAddress(f, params)]),
  );
}
