/**
 * The mainnet behaviour subgraph: Uniswap v4's PoolManager on Ethereum, indexed live.
 * Every number the readout shows about an address comes from here, queried per request.
 */
const ENDPOINT =
  process.env.NEXT_PUBLIC_GANTRY_MAINNET_SUBGRAPH ??
  "https://api.studio.thegraph.com/query/1760064/gantry-mainnet/v0.0.2";

export interface MainnetTrader {
  id: string;
  swaps: string;
  blocks: string;
  sandwiches: string;
  victims: string;
  roundTrips: string;
  originators: string;
  firstBlock: string;
  lastBlock: string;
  tier: number;
  sharedInfrastructure: boolean;
}

export interface ScanTotals {
  swaps: string;
  sandwiches: string;
  addresses: string;
  firstBlock: string;
  lastBlock: string;
}

const TRADER_FIELDS =
  "id swaps blocks sandwiches victims roundTrips originators firstBlock lastBlock tier sharedInfrastructure";

async function query<T>(document: string, variables: Record<string, unknown> = {}): Promise<T | null> {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: document, variables }),
      next: { revalidate: 15 },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: T; errors?: unknown[] };
    return body.errors?.length ? null : (body.data ?? null);
  } catch {
    return null;
  }
}

export async function mainnetTrader(address: string): Promise<MainnetTrader | null> {
  const data = await query<{ mainnetTrader: MainnetTrader | null }>(
    `query($id: ID!) { mainnetTrader(id: $id) { ${TRADER_FIELDS} } }`,
    { id: address.toLowerCase() },
  );
  return data?.mainnetTrader ?? null;
}

/** The scan window, as far as the indexer has actually got. */
export async function scanTotals(): Promise<(ScanTotals & { head: number }) | null> {
  const data = await query<{ scan: ScanTotals | null; _meta: { block: { number: number } } }>(
    `{ scan(id: "0x67616e747279") { swaps sandwiches addresses firstBlock lastBlock }
       _meta { block { number } } }`,
  );
  if (!data?.scan) return null;
  return { ...data.scan, head: data._meta.block.number };
}

export async function worstOffenders(first = 8): Promise<MainnetTrader[]> {
  const data = await query<{ mainnetTraders: MainnetTrader[] }>(
    `query($n: Int!) { mainnetTraders(first: $n, where: { sharedInfrastructure: false, sandwiches_gt: 0 },
       orderBy: sandwiches, orderDirection: desc) { ${TRADER_FIELDS} } }`,
    { n: first },
  );
  return data?.mainnetTraders ?? [];
}

export async function sharedInfrastructure(first = 8): Promise<MainnetTrader[]> {
  const data = await query<{ mainnetTraders: MainnetTrader[] }>(
    `query($n: Int!) { mainnetTraders(first: $n, where: { sharedInfrastructure: true },
       orderBy: originators, orderDirection: desc) { ${TRADER_FIELDS} } }`,
    { n: first },
  );
  return data?.mainnetTraders ?? [];
}

/** Every address the indexer has seen, paged out for the CRE features endpoint. */
export async function allTraders(max = 1000): Promise<MainnetTrader[]> {
  const out: MainnetTrader[] = [];
  let cursor = "";
  while (out.length < max) {
    const data = await query<{ mainnetTraders: MainnetTrader[] }>(
      `query($after: ID!) { mainnetTraders(first: 500, where: { id_gt: $after }, orderBy: id) { ${TRADER_FIELDS} } }`,
      { after: cursor },
    );
    const page = data?.mainnetTraders ?? [];
    out.push(...page);
    if (page.length < 500) break;
    cursor = page[page.length - 1].id;
  }
  return out;
}
