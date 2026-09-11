import attempts from "@/data/failed-attempts.json";
import { traderInPool } from "@/lib/subgraph";
import {
  mainnetTrader,
  scanTotals,
  sharedInfrastructure as sharedQuery,
  worstOffenders as worstQuery,
  type MainnetTrader,
} from "@/lib/mainnet";
import { isAddress, type Lookup, type Observation, type Tier } from "@/lib/tiers";

/**
 * Transactions that reached the PoolManager and reverted, per address. This is the one
 * number on the page a subgraph cannot produce: event handlers only run on receipts of
 * successful transactions, so a reverted attempt emits nothing to index. It comes from
 * the Substreams module, which reads transaction traces and sees the failures too.
 */
const failed = new Map(Object.entries(attempts.perAddress as Record<string, number>));

const count = (n: number | string) => Number(n).toLocaleString("en-US");

export interface ScanWindow {
  fromBlock: number;
  toBlock: number;
  swaps: number;
  sandwiches: number;
  addresses: number;
  live: boolean;
}

/** Where the indexer has got to. Read per request, so the numbers move with the chain. */
export async function scanWindow(): Promise<ScanWindow> {
  const totals = await scanTotals();
  if (!totals) {
    return { fromBlock: 0, toBlock: 0, swaps: 0, sandwiches: 0, addresses: 0, live: false };
  }
  return {
    fromBlock: Number(totals.firstBlock),
    toBlock: totals.head,
    swaps: Number(totals.swaps),
    sandwiches: Number(totals.sandwiches),
    addresses: Number(totals.addresses),
    live: true,
  };
}

export const worstOffenders = (limit = 8) => worstQuery(limit);
export const sharedInfrastructure = (limit = 8) => sharedQuery(limit);

function observations(row: MainnetTrader, address: string): Observation[] {
  const reverted = failed.get(address.toLowerCase()) ?? 0;
  return [
    { label: "Swaps observed", value: count(row.swaps) },
    { label: "Blocks active", value: count(row.blocks) },
    {
      label: "Sandwich-shaped sequences",
      value: count(row.sandwiches),
      note: Number(row.sandwiches) > 0 ? "opened and closed around another trade" : undefined,
    },
    { label: "Same-block round trips", value: count(row.roundTrips) },
    {
      label: "Distinct originators",
      value: count(row.originators),
      note: row.sharedInfrastructure ? "many unrelated people trade through this address" : "one operator",
    },
    {
      label: "Reverted attempts",
      value: count(reverted),
      note: "from transaction traces; no subgraph can see these",
    },
    { label: "First seen", value: `block ${count(row.firstBlock)}` },
    { label: "Last seen", value: `block ${count(row.lastBlock)}` },
  ];
}

export async function lookup(address: string): Promise<Lookup | null> {
  if (!isAddress(address)) return null;

  const [row, pool, source] = await Promise.all([
    mainnetTrader(address),
    traderInPool(address.toLowerCase()),
    scanWindow(),
  ]);

  return {
    address,
    tier: (row?.tier ?? 1) as Tier,
    scored: Boolean(row),
    sharedInfrastructure: Boolean(row?.sharedInfrastructure),
    observations: row ? observations(row, address) : [],
    poolSwaps: pool?.trader ? Number(pool.trader.swaps) : null,
    source,
  };
}
