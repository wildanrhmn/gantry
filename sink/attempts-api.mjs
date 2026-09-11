/**
 * Serves the reverted-attempt counts the Substreams sink writes into Postgres.
 *
 * Reverted transactions emit no logs, so no subgraph can produce these numbers. The sink
 * streams map_attempts from The Graph Market continuously; this only reads what it wrote.
 */
import { createServer } from "node:http";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.PGDSN, max: 4 });
const PORT = Number(process.env.PORT ?? 8787);
const TTL = 10_000;

// Optional. Unset means open, which is how this runs until both sides carry the key.
const KEY = process.env.GANTRY_API_KEY || null;

// The data is public; the thing worth protecting is the box it runs next to.
const RATE = { windowMs: 60_000, max: 120 };
const hits = new Map();
function allowed(ip) {
  const now = Date.now();
  const seen = hits.get(ip);
  if (!seen || now - seen.start > RATE.windowMs) {
    hits.set(ip, { start: now, n: 1 });
    return true;
  }
  seen.n += 1;
  return seen.n <= RATE.max;
}
// Callers stop arriving; their counters should not outlive them.
setInterval(() => {
  const cutoff = Date.now() - RATE.windowMs;
  for (const [ip, seen] of hits) if (seen.start < cutoff) hits.delete(ip);
}, RATE.windowMs).unref();

const cache = new Map();
async function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}

const totals = () =>
  cached("totals", async () => {
    const [counts, range] = await Promise.all([
      pool.query("SELECT status, count(*)::int AS n FROM public.attempt GROUP BY status"),
      pool.query(
        "SELECT min(_block_number_)::int AS lo, max(_block_number_)::int AS hi, count(DISTINCT contract)::int AS addresses FROM public.attempt",
      ),
    ]);
    const byStatus = Object.fromEntries(counts.rows.map((r) => [r.status, r.n]));
    const total = counts.rows.reduce((a, r) => a + r.n, 0);
    const { lo, hi, addresses } = range.rows[0] ?? {};
    return { source: "substreams:map_attempts", live: true, total, byStatus, addresses: addresses ?? 0, fromBlock: lo ?? 0, toBlock: hi ?? 0 };
  });

/** The whole map, in the shape the published snapshot uses, so anything reading that file
 *  can read this instead without changing how it parses. */
const everything = () =>
  cached("all", async () => {
    const base = await totals();
    const { rows } = await pool.query(
      "SELECT contract, count(*)::int AS n FROM public.attempt GROUP BY contract ORDER BY 2 DESC",
    );
    return {
      ...base,
      note: "Transactions that reached the v4 PoolManager and did not succeed. Derived from transaction traces, which is why no subgraph can reproduce this.",
      perAddress: Object.fromEntries(rows.map((r) => [r.contract, r.n])),
    };
  });

const forAddress = (address) =>
  cached(`a:${address}`, async () => {
    const { rows } = await pool.query(
      "SELECT count(*)::int AS n FROM public.attempt WHERE contract = $1",
      [address],
    );
    return { address, reverted: rows[0]?.n ?? 0 };
  });

createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const send = (code, body) => {
    res.writeHead(code, { "content-type": "application/json", "cache-control": "public, max-age=10" });
    res.end(JSON.stringify(body));
  };
  const ip = (req.headers["x-forwarded-for"] ?? "").split(",")[0].trim() || req.socket.remoteAddress || "?";
  try {
    if (url.pathname === "/health") return send(200, { ok: true });
    if (!allowed(ip)) return send(429, { error: "slow down" });
    // A wrong key looks the same as a wrong path, so scanning learns nothing.
    if (KEY && req.headers["x-gantry-key"] !== KEY) return send(404, { error: "not found" });
    if (url.pathname === "/attempts/all") return send(200, await everything());
    if (url.pathname === "/attempts") {
      const a = url.searchParams.get("address");
      return send(200, a ? await forAddress(a.toLowerCase()) : await totals());
    }
    send(404, { error: "not found" });
  } catch (e) {
    send(500, { error: String(e).slice(0, 120) });
  }
}).listen(PORT, "0.0.0.0", () => console.log(`attempts api on ${PORT}${KEY ? " (key required)" : ""}`));
