import { writeFileSync } from "node:fs";
import { fetchSwaps } from "./chain.ts";
import { buildFeatures, detectSandwiches } from "./detect.ts";
import { DEFAULT_PARAMS, scoreAll, type ScoringParams } from "./score.ts";
import { Tier } from "./types.ts";

const TIER_NAME = ["clean", "unknown", "suspected", "extractor"];

function arg(name: string, fallback?: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  const value = hit ? hit.slice(name.length + 3) : process.env[name.toUpperCase().replace(/-/g, "_")];
  if (value === undefined) {
    if (fallback !== undefined) return fallback;
    throw new Error(`missing --${name}`);
  }
  return value;
}

async function main() {
  const rpcUrl = arg("rpc", "http://127.0.0.1:8545");
  const poolManager = arg("manager");
  const fromBlock = Number(arg("from", "0"));
  const toBlockRaw = arg("to", "latest");
  const out = arg("out", "tiers.json");

  // Thresholds are overridable so the enclave can hold real ones without changing code.
  const params: ScoringParams = {
    ...DEFAULT_PARAMS,
    ...(process.env.SCORING_PARAMS ? (JSON.parse(process.env.SCORING_PARAMS) as Partial<ScoringParams>) : {}),
  };

  const swaps = await fetchSwaps({
    rpcUrl,
    poolManager,
    fromBlock,
    toBlock: toBlockRaw === "latest" ? "latest" : Number(toBlockRaw),
    poolId: process.env.POOL_ID,
  });

  const sandwiches = detectSandwiches(swaps);
  const features = buildFeatures(swaps, sandwiches);
  const tiers = scoreAll(features, params);

  console.log(`swaps ${swaps.length}  addresses ${features.length}  sandwiches ${sandwiches.length}`);
  for (const f of features.sort((a, b) => b.sandwiches - a.sandwiches || b.swaps - a.swaps)) {
    const tier = tiers.get(f.address) ?? Tier.Unknown;
    console.log(
      `${f.address}  ${TIER_NAME[tier].padEnd(9)} swaps=${f.swaps} blocks=${f.blocks} sandwiches=${f.sandwiches} victims=${f.victimsHarmed}`,
    );
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    fromBlock,
    toBlock: toBlockRaw,
    addresses: [...tiers.entries()].map(([address, tier]) => ({ address, tier })),
  };
  writeFileSync(out, JSON.stringify(payload, null, 2));
  console.log(`\nwrote ${out}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
