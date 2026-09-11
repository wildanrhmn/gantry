import { readFileSync, writeFileSync } from "node:fs";
import { parseSubstreamsOutput } from "./from-substreams.ts";
import { buildFeatures, detectSandwiches } from "./detect.ts";
import { DEFAULT_PARAMS, isSharedInfrastructure, scoreAddress } from "./score.ts";

const input = process.argv[2];
const output = process.argv[3] ?? "features.json";
if (!input) {
  console.error("usage: node src/build-dataset.ts <substreams-output.json> [out.json]");
  process.exit(1);
}

const swaps = parseSubstreamsOutput(readFileSync(input, "utf8"));
const sandwiches = detectSandwiches(swaps);
const features = buildFeatures(swaps, sandwiches);

const blocks = swaps.map((s) => s.blockNumber);
const dataset = {
  chain: "ethereum-mainnet",
  scannedAt: new Date().toISOString(),
  fromBlock: Math.min(...blocks),
  toBlock: Math.max(...blocks),
  swaps: swaps.length,
  sandwiches: sandwiches.length,
  addresses: features
    .map((f) => ({
      ...f,
      tier: scoreAddress(f, DEFAULT_PARAMS),
      sharedInfrastructure: isSharedInfrastructure(f),
    }))
    .sort((a, b) => b.sandwiches - a.sandwiches || b.swaps - a.swaps),
};

writeFileSync(output, JSON.stringify(dataset, null, 2));
console.log(
  `${dataset.swaps} swaps, ${dataset.sandwiches} sandwiches, ${dataset.addresses.length} addresses -> ${output}`,
);
