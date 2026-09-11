import { traderInPool } from "@/lib/subgraph";
import {
  mainnetTrader,
  scanTotals,
  sharedInfrastructure as sharedQuery,
  worstOffenders as worstQuery,
  type MainnetTrader,
} from "@/lib/mainnet";
import { ADDRESSES, oracleAbi, publicClient } from "@/lib/chain";
import { revertedFor, revertedTotals } from "@/lib/attempts";
import { buildObservations } from "@/lib/observations";
import { isAddress, type Lookup, type Tier } from "@/lib/tiers";


export interface ScanWindow {
  fromBlock: number;
  toBlock: number;
  swaps: number;
  sandwiches: number;
  addresses: number;
  reverted: number;
  live: boolean;
}

/** Where the indexer has got to. Read per request, so the numbers move with the chain. */
export async function scanWindow(): Promise<ScanWindow> {
  const [totals, reverted] = await Promise.all([scanTotals(), revertedTotals()]);
  if (!totals) {
    return {
      fromBlock: 0, toBlock: 0, swaps: 0, sandwiches: 0,
      addresses: 0, reverted: reverted.total, live: false,
    };
  }
  return {
    fromBlock: Number(totals.firstBlock),
    toBlock: totals.head,
    swaps: Number(totals.swaps),
    sandwiches: Number(totals.sandwiches),
    addresses: Number(totals.addresses),
    reverted: reverted.total,
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
    observations: row ? buildObservations(row, await revertedFor(address)) : [],
    poolSwaps: pool?.trader ? Number(pool.trader.swaps) : null,
    source,
  };
}
