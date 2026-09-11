import { NextResponse } from "next/server";
import { revertedFor } from "@/lib/attempts";
import { scanWindow } from "@/lib/lookup";
import { mainnetTrader } from "@/lib/mainnet";
import { traderInPool } from "@/lib/subgraph";
import { isAddress } from "@/lib/tiers";

export const revalidate = 30;

/**
 * A lookup reads three independent sources, so each is served on its own and the page can
 * show them landing as they land rather than pretending one request is three.
 *
 *   behaviour  the mainnet subgraph, which is what the tier is scored from
 *   attempts   the Substreams trace scan, the only source that sees reverted transactions
 *   pool       the Gantry pool subgraph on Sepolia
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address") ?? "";
  const part = searchParams.get("part");

  if (!isAddress(address)) {
    return NextResponse.json({ error: "not an address" }, { status: 400 });
  }

  if (part === "behaviour") {
    const [row, source] = await Promise.all([mainnetTrader(address), scanWindow()]);
    return NextResponse.json({ row, source });
  }

  if (part === "attempts") {
    return NextResponse.json({ reverted: await revertedFor(address) });
  }

  if (part === "pool") {
    const pool = await traderInPool(address.toLowerCase());
    return NextResponse.json({ swaps: pool?.trader ? Number(pool.trader.swaps) : null });
  }

  return NextResponse.json({ error: "unknown part" }, { status: 400 });
}
