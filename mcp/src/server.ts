#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { query, tierName, type TraderRecord } from "./graph.ts";

const ENDPOINT = process.env.GANTRY_SUBGRAPH;
if (!ENDPOINT) {
  console.error("set GANTRY_SUBGRAPH to a subgraph endpoint");
  process.exit(1);
}

const server = new McpServer({ name: "gantry", version: "0.1.0" });

function text(body: string) {
  return { content: [{ type: "text" as const, text: body }] };
}

server.tool(
  "lookup_address",
  "Why a given address pays what it pays in a Gantry pool.",
  { address: z.string().describe("0x-prefixed address") },
  async ({ address }) => {
    const data = await query<{ trader: TraderRecord | null }>(
      ENDPOINT!,
      `query($id: ID!) { trader(id: $id) { id tier scored swaps feePaidTotal firstSeen lastSeen } }`,
      { id: address.toLowerCase() },
    );
    const t = data.trader;
    if (!t) return text(`${address} has never traded here, so it would be priced as unknown.`);
    return text(
      [
        `${t.id}`,
        `tier      ${t.tier} (${tierName(t.tier)})${t.scored ? "" : " - never scored, this is the default"}`,
        `swaps     ${t.swaps}`,
        `first     ${new Date(Number(t.firstSeen) * 1000).toISOString()}`,
        `last      ${new Date(Number(t.lastSeen) * 1000).toISOString()}`,
      ].join("\n"),
    );
  },
);

server.tool(
  "recent_tolls",
  "The most recent swaps and what each was charged.",
  { limit: z.number().int().min(1).max(100).default(20) },
  async ({ limit }) => {
    const data = await query<{ tolls: { trader: { id: string }; tier: number; fee: number; blockNumber: string }[] }>(
      ENDPOINT!,
      `query($n: Int!) { tolls(first: $n, orderBy: blockNumber, orderDirection: desc) {
         trader { id } tier fee blockNumber } }`,
      { n: limit },
    );
    if (data.tolls.length === 0) return text("no tolls recorded yet");
    return text(
      data.tolls
        .map((t) => `block ${t.blockNumber}  ${t.trader.id}  ${tierName(t.tier)}  ${t.fee / 10_000}%`)
        .join("\n"),
    );
  },
);

server.tool("venue_stats", "Totals across the whole venue, including the tier mix.", {}, async () => {
  const data = await query<{ venues: { tolls: string; tradersSeen: string; tollsByTier: string[] }[] }>(
    ENDPOINT!,
    `{ venues(first: 1) { tolls tradersSeen tollsByTier } }`,
  );
  const v = data.venues[0];
  if (!v) return text("nothing indexed yet");
  const mix = v.tollsByTier.map((count, tier) => `  ${tierName(tier).padEnd(9)} ${count}`).join("\n");
  return text(`tolls ${v.tolls}\ntraders ${v.tradersSeen}\nby tier:\n${mix}`);
});

server.tool(
  "worst_offenders",
  "Addresses currently paying the highest tiers.",
  { limit: z.number().int().min(1).max(50).default(10) },
  async ({ limit }) => {
    const data = await query<{ traders: TraderRecord[] }>(
      ENDPOINT!,
      `query($n: Int!) { traders(first: $n, where: {tier_gte: 2}, orderBy: swaps, orderDirection: desc) {
         id tier scored swaps feePaidTotal firstSeen lastSeen } }`,
      { n: limit },
    );
    if (data.traders.length === 0) return text("no address is above the unknown tier yet");
    return text(data.traders.map((t) => `${t.id}  ${tierName(t.tier)}  swaps ${t.swaps}`).join("\n"));
  },
);

await server.connect(new StdioServerTransport());
