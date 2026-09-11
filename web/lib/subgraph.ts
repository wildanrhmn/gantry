const ENDPOINT =
  process.env.NEXT_PUBLIC_GANTRY_SUBGRAPH ??
  "https://api.studio.thegraph.com/query/1760064/gantry/v0.0.3";

export async function querySubgraph<T>(
  document: string,
  variables: Record<string, unknown> = {},
): Promise<T | null> {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: document, variables }),
      next: { revalidate: 10 },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: T; errors?: unknown[] };
    return body.errors?.length ? null : (body.data ?? null);
  } catch {
    // The readout degrades to what it already knows rather than failing the page.
    return null;
  }
}

export interface TollRow {
  id: string;
  tier: number;
  fee: number;
  blockNumber: string;
  timestamp: string;
  transactionHash: string;
  trader: { id: string };
}

export interface VenueRow {
  tolls: string;
  tradersSeen: string;
  tollsByTier: string[];
}

export const recentTolls = (first = 12) =>
  querySubgraph<{ tolls: TollRow[] }>(
    `query($n: Int!) { tolls(first: $n, orderBy: blockNumber, orderDirection: desc) {
       id tier fee blockNumber timestamp transactionHash trader { id } } }`,
    { n: first },
  );

/** Every toll one address has been charged, newest first. */
export const tollsFor = (id: string, first = 6) =>
  querySubgraph<{ tolls: TollRow[] }>(
    `query($id: String!, $n: Int!) {
       tolls(where: { trader: $id }, first: $n, orderBy: blockNumber, orderDirection: desc) {
         id tier fee blockNumber timestamp transactionHash trader { id } } }`,
    { id: id.toLowerCase(), n: first },
  );

export const venue = () =>
  querySubgraph<{ venues: VenueRow[] }>(`{ venues(first: 1) { tolls tradersSeen tollsByTier } }`);

export const traderInPool = (id: string) =>
  querySubgraph<{ trader: { id: string; tier: number; scored: boolean; swaps: string } | null }>(
    `query($id: ID!) { trader(id: $id) { id tier scored swaps } }`,
    { id: id.toLowerCase() },
  );
