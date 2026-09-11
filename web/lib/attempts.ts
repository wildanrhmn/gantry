import snapshot from "@/data/failed-attempts.json";

/**
 * Transactions that reached the v4 PoolManager and reverted, per address.
 *
 * A reverted transaction emits no logs, so no subgraph can count one. These come from the
 * gantry Substreams package reading transaction traces, streamed continuously from The
 * Graph Market into Postgres by `substreams sink postgres` and served over HTTP.
 *
 * The committed snapshot stays as a fallback. If the sink is unreachable the number goes
 * stale rather than the page breaking, and `live` says which one answered.
 */
const API = process.env.GANTRY_ATTEMPTS_API;
const frozen = new Map(Object.entries(snapshot.perAddress as Record<string, number>));

async function ask<T>(path: string): Promise<T | null> {
  if (!API) return null;
  try {
    const res = await fetch(`${API}${path}`, {
      // A sink that has stalled must not hold a page render open.
      signal: AbortSignal.timeout(2500),
      next: { revalidate: 10 },
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export async function revertedFor(address: string): Promise<number> {
  const key = address.toLowerCase();
  const hit = await ask<{ reverted: number }>(`/attempts?address=${key}`);
  return typeof hit?.reverted === "number" ? hit.reverted : (frozen.get(key) ?? 0);
}

export interface RevertedTotals {
  total: number;
  addresses: number;
  toBlock: number;
  live: boolean;
}

export async function revertedTotals(): Promise<RevertedTotals> {
  const hit = await ask<{ total: number; addresses: number; toBlock: number }>("/attempts");
  if (typeof hit?.total === "number") {
    return { total: hit.total, addresses: hit.addresses, toBlock: hit.toBlock, live: true };
  }
  return {
    total: Number(snapshot.total ?? 0),
    addresses: Object.keys(snapshot.perAddress ?? {}).length,
    toBlock: Number(snapshot.toBlock ?? 0),
    live: false,
  };
}
