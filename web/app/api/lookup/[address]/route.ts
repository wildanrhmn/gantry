import { NextResponse } from "next/server";
import dataset from "@/data/mainnet-features.json";
import { traderInPool } from "@/lib/subgraph";
import { isAddress, type Lookup, type Observation, type Tier } from "@/lib/tiers";

interface Row {
  address: string;
  swaps: number;
  blocks: number;
  sandwiches: number;
  victimsHarmed: number;
  roundTrips: number;
  originators: number;
  firstBlock: number;
  lastBlock: number;
  tier: number;
  sharedInfrastructure: boolean;
}

const rows = dataset.addresses as Row[];
const index = new Map(rows.map((r) => [r.address.toLowerCase(), r]));
const count = (n: number) => n.toLocaleString("en-US");

export async function GET(_: Request, ctx: { params: Promise<{ address: string }> }) {
  const { address } = await ctx.params;

  if (!isAddress(address)) {
    return NextResponse.json({ error: "That is not an address." }, { status: 400 });
  }

  const key = address.toLowerCase();
  const row = index.get(key);
  const pool = await traderInPool(key);
  const poolSwaps = pool?.trader ? Number(pool.trader.swaps) : null;

  const observations: Observation[] = row
    ? [
        { label: "Swaps observed", value: count(row.swaps) },
        { label: "Blocks active", value: count(row.blocks) },
        {
          label: "Sandwich-shaped sequences",
          value: count(row.sandwiches),
          note: row.sandwiches > 0 ? "opened and closed around another trade" : undefined,
        },
        { label: "Same-block round trips", value: count(row.roundTrips) },
        {
          label: "Distinct originators",
          value: count(row.originators),
          note: row.sharedInfrastructure
            ? "many unrelated people trade through this address"
            : "one operator",
        },
        { label: "First seen", value: `block ${count(row.firstBlock)}` },
        { label: "Last seen", value: `block ${count(row.lastBlock)}` },
      ]
    : [];

  const body: Lookup = {
    address,
    tier: (row?.tier ?? 1) as Tier,
    scored: Boolean(row),
    sharedInfrastructure: Boolean(row?.sharedInfrastructure),
    observations,
    poolSwaps,
    source: {
      fromBlock: dataset.fromBlock as number,
      toBlock: dataset.toBlock as number,
      scannedAt: dataset.scannedAt as string,
    },
  };

  return NextResponse.json(body);
}
