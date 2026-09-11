import attempts from "@/data/failed-attempts.json";
import { traderInPool } from "@/lib/subgraph";
import {
  mainnetTrader,
  scanTotals,
  sharedInfrastructure as sharedQuery,
  worstOffenders as worstQuery,
  type MainnetTrader,
} from "@/lib/mainnet";
import { ADDRESSES, oracleAbi, publicClient } from "@/lib/chain";
import { buildObservations } from "@/lib/observations";
import { isAddress, type Lookup, type Tier } from "@/lib/tiers";

/**
 * Transactions that reached the PoolManager and reverted, per address. This is the one
 * number on the page a subgraph cannot produce: event handlers only run on receipts of
 * successful transactions, so a reverted attempt emits nothing to index. It comes from
 * the Substreams module, which reads transaction traces and sees the failures too.
 */
const failed = new Map(Object.entries(attempts.perAddress as Record<string, number>));

/** How many of this address's transactions reached the PoolManager and reverted. */
export const revertedFor = (address: string) => failed.get(address.toLowerCase()) ?? 0;

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


export async function lookup(address: string): Promise<Lookup | null> {
  if (!isAddress(address)) return null;

  const [row, pool, source, onChain] = await Promise.all([
    mainnetTrader(address),
    traderInPool(address.toLowerCase()),
    scanWindow(),
    // The oracle is what the hook reads at swap time, so it is the answer.
    publicClient
      .readContract({
        address: ADDRESSES.oracle,
        abi: oracleAbi,
        functionName: "tierOf",
        args: [address as `0x${string}`],
      })
      .then((t) => Number(t))
      .catch(() => null),
  ]);

  return {
    address,
    tier: (onChain ?? row?.tier ?? 1) as Tier,
    scored: Boolean(row),
    sharedInfrastructure: Boolean(row?.sharedInfrastructure),
    observations: row ? buildObservations(row, revertedFor(address)) : [],
    poolSwaps: pool?.trader ? Number(pool.trader.swaps) : null,
    source,
  };
}
