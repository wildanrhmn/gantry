#!/usr/bin/env node
/**
 * Regenerates web/data/failed-attempts.json from the gantry Substreams package.
 *
 * Reverted transactions emit no logs, so no subgraph can count them | a Substreams module
 * reading transaction traces is the only way to see one. Substreams is a streaming engine
 * rather than a queryable API, and Subgraph Studio no longer accepts substreams-powered
 * subgraphs on EVM chains, so the counts reach the site as this generated artifact.
 *
 * The scan window is taken from the mainnet subgraph's own indexed head, so the reverted
 * counts and the behaviour counts always describe exactly the same range of blocks.
 *
 *   SUBSTREAMS_API_TOKEN   required, a JWT from thegraph.market
 *   ATTEMPTS_FROM_BLOCK    optional, defaults to the subgraph's start block
 *   ATTEMPTS_OUT           optional, defaults to web/data/failed-attempts.json
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const OUT = process.env.ATTEMPTS_OUT ?? resolve(ROOT, "web/data/failed-attempts.json");
const PKG = resolve(ROOT, "substreams/gantry-v0.1.0.spkg");

const FROM = Number(process.env.ATTEMPTS_FROM_BLOCK ?? 25940000);
const ENDPOINT = process.env.SUBSTREAMS_ENDPOINT ?? "mainnet.eth.streamingfast.io:443";
const SUBGRAPH =
  process.env.NEXT_PUBLIC_GANTRY_MAINNET_SUBGRAPH ??
  "https://api.studio.thegraph.com/query/1760064/gantry-mainnet/v0.0.2";

/** Scan to wherever the behaviour subgraph has reached, so the two windows match. */
async function indexedHead() {
  const res = await fetch(SUBGRAPH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: "{ _meta { block { number } } }" }),
  });
  if (!res.ok) throw new Error(`subgraph ${res.status}`);
  const body = await res.json();
  const head = body?.data?._meta?.block?.number;
  if (!Number.isFinite(head)) throw new Error("subgraph returned no head block");
  return Number(head);
}

function run(to) {
  return new Promise((ok, fail) => {
    const child = spawn(
      "substreams",
      [
        "run", PKG, "map_attempts",
        "-e", ENDPOINT,
        "--start-block", String(FROM),
        "--stop-block", String(to),
        // The CLI guards against runaway ranges at 10k blocks. Ours is deliberate and
        // known, so raise the guard to exactly it rather than switching it off.
        "--limit-processed-blocks", String(to - FROM + 1),
        "-o", "jsonl",
      ],
      { stdio: ["ignore", "pipe", "inherit"] },
    );

    const perAddress = new Map();
    const byStatus = new Map();
    let total = 0;
    let firstBlock = null;
    let lastBlock = null;

    const lines = createInterface({ input: child.stdout });
    lines.on("line", (line) => {
      if (!line.startsWith("{")) return;
      let parsed;
      try {
        parsed = JSON.parse(line);
      } catch {
        return;
      }
      for (const a of parsed?.["@data"]?.attempts ?? []) {
        const address = String(a.contract).toLowerCase();
        const block = Number(a.blockNumber);
        perAddress.set(address, (perAddress.get(address) ?? 0) + 1);
        byStatus.set(a.status, (byStatus.get(a.status) ?? 0) + 1);
        if (firstBlock === null || block < firstBlock) firstBlock = block;
        if (lastBlock === null || block > lastBlock) lastBlock = block;
        total += 1;
      }
    });

    child.on("error", fail);
    child.on("close", (code) =>
      code === 0
        ? ok({ perAddress, byStatus, total, firstBlock, lastBlock })
        : fail(new Error(`substreams exited ${code}`)),
    );
  });
}

if (!process.env.SUBSTREAMS_API_TOKEN) {
  console.error("SUBSTREAMS_API_TOKEN is not set");
  process.exit(1);
}

const to = await indexedHead();
if (to <= FROM) {
  console.error(`nothing to scan: head ${to} is not past ${FROM}`);
  process.exit(1);
}
console.error(`scanning ${FROM} to ${to} (${(to - FROM).toLocaleString()} blocks)`);

const { perAddress, byStatus, total, firstBlock, lastBlock } = await run(to);

// Biggest offender first, so the file reads as a ranking rather than a hash dump.
const ranked = Object.fromEntries([...perAddress.entries()].sort((a, b) => b[1] - a[1]));

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  `${JSON.stringify(
    {
      source: "substreams:map_attempts",
      note: "Transactions that reached the v4 PoolManager and did not succeed. Derived from transaction traces, which is why no subgraph can reproduce this.",
      scannedFrom: FROM,
      scannedTo: to,
      fromBlock: firstBlock ?? FROM,
      toBlock: lastBlock ?? to,
      total,
      byStatus: Object.fromEntries(byStatus),
      perAddress: ranked,
    },
    null,
    2,
  )}\n`,
);

console.error(`wrote ${total.toLocaleString()} attempts across ${perAddress.size} addresses`);
