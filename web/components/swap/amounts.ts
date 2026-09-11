import { formatUnits, type Hex } from "viem";
import { ADDRESSES, publicClient, TOKENS } from "@/lib/chain";

const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const ICONS: Record<string, string> = {
  gUSD: "/tokens/usdc.svg",
  gETH: "/tokens/eth.svg",
};

// Log addresses come back lowercased, so the token map is keyed that way too.
const META: Record<string, { symbol: string; icon: string }> = Object.fromEntries(
  Object.entries(TOKENS).map(([address, token]) => [
    address.toLowerCase(),
    { symbol: token.symbol, icon: ICONS[token.symbol] ?? "/tokens/eth.svg" },
  ]),
);

export interface Leg {
  symbol: string;
  icon: string;
  amount: number;
}

export interface Amounts {
  paid: Leg | null;
  got: Leg | null;
}

const pool = new Set([ADDRESSES.token0.toLowerCase(), ADDRESSES.token1.toLowerCase()]);
const topicAddress = (topic: Hex) => `0x${topic.slice(26)}`.toLowerCase();

const leg = (token: string, raw: bigint): Leg => {
  const meta = META[token.toLowerCase()] ?? { symbol: "token", icon: "/tokens/eth.svg" };
  return { ...meta, amount: Number(formatUnits(raw, 18)) };
};

/**
 * The subgraph records what a swap was charged, not what it moved, so the two sides come
 * from the receipt: the token this address sent, and the token it was sent back.
 */
export async function swapAmounts(hash: Hex, trader: string): Promise<Amounts> {
  const who = trader.toLowerCase();
  const receipt = await publicClient.getTransactionReceipt({ hash });

  let paid: Leg | null = null;
  let got: Leg | null = null;

  for (const log of receipt.logs) {
    const token = log.address.toLowerCase();
    if (!pool.has(token) || log.topics[0] !== TRANSFER || log.topics.length < 3) continue;
    const from = topicAddress(log.topics[1] as Hex);
    const to = topicAddress(log.topics[2] as Hex);
    const value = BigInt(log.data);
    // A router pulls from the trader and the pool pays the trader back.
    if (from === who && !paid) paid = leg(log.address, value);
    if (to === who && !got) got = leg(log.address, value);
  }

  return { paid, got };
}
