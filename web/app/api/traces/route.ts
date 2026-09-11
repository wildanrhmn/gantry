import { NextResponse } from "next/server";
import snapshot from "@/data/failed-attempts.json";

export const revalidate = 30;

/**
 * Reverted-attempt counts, in the shape the published snapshot uses.
 *
 * The CRE workflow fetches this from inside the enclave rather than holding a database
 * connection, and it needs TLS, which a bare sink on an IP does not have. So the sink is
 * read here and served over the site's certificate.
 *
 * If the sink is unreachable this falls back to the committed snapshot, so a workflow run
 * scores slightly stale trace counts rather than failing outright.
 */
export async function GET() {
  const api = process.env.GANTRY_ATTEMPTS_API;
  if (api) {
    try {
      const res = await fetch(`${api}/attempts/all`, {
        signal: AbortSignal.timeout(4000),
        next: { revalidate: 30 },
      });
      if (res.ok) {
        const body = await res.json();
        if (body?.perAddress) return NextResponse.json(body);
      }
    } catch {
      // fall through to the snapshot
    }
  }
  return NextResponse.json({ ...snapshot, live: false });
}
