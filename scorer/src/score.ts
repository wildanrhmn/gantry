import { Tier, type AddressFeatures, type TierValue } from "./types.ts";

/**
 * The dials that decide a tier. These are the values that live as secrets inside the
 * enclave: publishing the algorithm is fine, publishing the thresholds would just tell
 * an extractor exactly how much to do without being noticed.
 */
export interface ScoringParams {
  extractorMinSandwiches: number;
  suspectedMinSandwiches: number;
  suspectedRoundTripsPerBlock: number;
  cleanMinSwaps: number;
  cleanMinBlockSpan: number;
}

export const DEFAULT_PARAMS: ScoringParams = {
  extractorMinSandwiches: 3,
  suspectedMinSandwiches: 1,
  suspectedRoundTripsPerBlock: 0.5,
  cleanMinSwaps: 20,
  cleanMinBlockSpan: 5_000,
};

export function scoreAddress(features: AddressFeatures, params: ScoringParams = DEFAULT_PARAMS): TierValue {
  if (features.sandwiches >= params.extractorMinSandwiches) return Tier.Extractor;
  if (features.sandwiches >= params.suspectedMinSandwiches) return Tier.Suspected;

  const perBlock = features.blocks === 0 ? 0 : features.roundTrips / features.blocks;
  if (perBlock >= params.suspectedRoundTripsPerBlock) return Tier.Suspected;

  const span = features.lastBlock - features.firstBlock;
  if (features.swaps >= params.cleanMinSwaps && span >= params.cleanMinBlockSpan) return Tier.Clean;

  // Anything we have not seen enough of stays unknown. Never clean by default.
  return Tier.Unknown;
}

export function scoreAll(
  features: AddressFeatures[],
  params: ScoringParams = DEFAULT_PARAMS,
): Map<string, TierValue> {
  return new Map(features.map((f) => [f.address, scoreAddress(f, params)]));
}
