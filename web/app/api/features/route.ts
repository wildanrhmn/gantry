import { NextResponse } from "next/server";
import attempts from "@/data/failed-attempts.json";
import { allTraders, scanTotals, type MainnetTrader } from "@/lib/mainnet";

const failed = attempts.perAddress as Record<string, number>;

/**
 * Behaviour features for every address seen on mainnet, in the shape the CRE workflow
 * reads. Pulled from the subgraph on each request, so the enclave scores whatever the
 * indexer has reached rather than a file someone checked in.
 *
 * failedAttempts is the exception and comes from the Substreams module: a reverted
 * transaction emits no logs, so no subgraph can report one.
 */
const shape = (t: MainnetTrader) => ({
  id: t.id,
  swaps: Number(t.swaps),
  blocks: Number(t.blocks),
  sandwiches: Number(t.sandwiches),
  victimsHarmed: Number(t.victims),
  roundTrips: Number(t.roundTrips),
  originators: Number(t.originators),
  firstBlock: Number(t.firstBlock),
  lastBlock: Number(t.lastBlock),
  failedAttempts: failed[t.id] ?? 0,
});

async function traders(limit: number) {
  const rows = await allTraders(limit);
  return rows.map(shape);
}

/** What the enclave calls. It sends a GraphQL document; only the limit is honoured. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { variables?: { n?: number } };
  const limit = Math.min(Math.max(body.variables?.n ?? 50, 1), 1000);
  return NextResponse.json({ data: { traders: await traders(limit) } });
}

export async function GET() {
  const [rows, totals] = await Promise.all([traders(1000), scanTotals()]);
  if (!totals) return NextResponse.json({ error: "indexer unreachable" }, { status: 503 });
  return NextResponse.json(
    {
      chain: "ethereum-mainnet",
      fromBlock: Number(totals.firstBlock),
      toBlock: totals.head,
      traders: rows,
    },
    { headers: { "cache-control": "public, max-age=60" } },
  );
}
