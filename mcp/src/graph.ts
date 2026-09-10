const TIER_NAME = ["clean", "unknown", "suspected", "extractor"];

export function tierName(tier: number): string {
  return TIER_NAME[tier] ?? `tier ${tier}`;
}

export interface TraderRecord {
  id: string;
  tier: number;
  scored: boolean;
  swaps: string;
  feePaidTotal: string;
  firstSeen: string;
  lastSeen: string;
}

/** Queries whichever subgraph endpoint the server was pointed at. */
export async function query<T>(endpoint: string, document: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: document, variables }),
  });
  if (!res.ok) throw new Error(`subgraph responded ${res.status}`);
  const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join("; "));
  if (!body.data) throw new Error("subgraph returned no data");
  return body.data;
}
