// Scores mainnet addresses with the same rules and the same thresholds the enclave
// uses, from the same two sources, and prints the batch the oracle should hold.
import { readFileSync } from "node:fs";

const SUBGRAPH = "https://api.studio.thegraph.com/query/1760064/gantry-mainnet/v0.0.2";
const TRACES =
  "https://raw.githubusercontent.com/wildanrhmn/gantry/master/web/data/failed-attempts.json";
const LIMIT = Number(process.argv[2] ?? 400);

const params = JSON.parse(process.env.GANTRY_SCORING_PARAMS ?? "{}");
for (const k of [
  "extractorMinSandwiches", "suspectedMinSandwiches", "suspectedRoundTripsPerBlock",
  "cleanMinSwaps", "cleanMinBlockSpan", "sharedInfraMinOriginators",
  "suspectedMinFailedAttempts", "cleanMaxFailedAttempts",
]) {
  if (params[k] === undefined) throw new Error(`GANTRY_SCORING_PARAMS missing ${k}`);
}

const isShared = (f) => f.originators >= params.sharedInfraMinOriginators;

/** Identical to scoring.ts. Kept in step deliberately: the chain must agree with the enclave. */
const scoreAddress = (f) => {
  if (isShared(f)) return 1;
  if (f.sandwiches >= params.extractorMinSandwiches) return 3;
  if (f.sandwiches >= params.suspectedMinSandwiches) return 2;
  const perBlock = f.blocks === 0 ? 0 : f.roundTrips / f.blocks;
  if (perBlock >= params.suspectedRoundTripsPerBlock) return 2;
  if (f.failedAttempts >= params.suspectedMinFailedAttempts) return 2;
  const span = f.lastBlock - f.firstBlock;
  if (f.swaps >= params.cleanMinSwaps && span >= params.cleanMinBlockSpan && f.failedAttempts <= params.cleanMaxFailedAttempts) {
    return 0;
  }
  return 1;
};

const q = `query($n: Int!) {
  mainnetTraders(first: $n, orderBy: swaps, orderDirection: desc) {
    id swaps blocks sandwiches victims roundTrips originators firstBlock lastBlock
  }
}`;

const res = await fetch(SUBGRAPH, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ query: q, variables: { n: LIMIT } }),
});
const rows = (await res.json()).data.mainnetTraders;
const reverts = (await (await fetch(TRACES)).json()).perAddress ?? {};

const features = rows.map((t) => ({
  address: t.id,
  swaps: +t.swaps, blocks: +t.blocks, sandwiches: +t.sandwiches,
  victimsHarmed: +t.victims, roundTrips: +t.roundTrips, originators: +t.originators,
  firstBlock: +t.firstBlock, lastBlock: +t.lastBlock,
  failedAttempts: reverts[t.id] ?? 0,
}));

// A router is left out of the report entirely rather than published as neutral.
const publishable = features.filter((f) => !isShared(f)).map((f) => ({ address: f.address, tier: scoreAddress(f) }));

const byTier = [0, 1, 2, 3].map((t) => publishable.filter((p) => p.tier === t).length);
console.error(`read ${features.length} traders, ${features.length - publishable.length} were shared infrastructure`);
console.error(`publishable ${publishable.length}  clean=${byTier[0]} unknown=${byTier[1]} suspected=${byTier[2]} extractor=${byTier[3]}`);

// Writing "unknown" is a no-op: an unscored address already reads as unknown.
const worth = publishable.filter((p) => p.tier !== 1);
console.error(`worth writing (non-default): ${worth.length}`);
process.stdout.write(JSON.stringify(worth));
