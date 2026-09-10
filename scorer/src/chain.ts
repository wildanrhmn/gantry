import type { Swap } from "./types.ts";

/** keccak256("Swap(bytes32,address,int128,int128,uint160,uint128,int24,uint24)") */
export const SWAP_TOPIC = "0x40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f";

export interface RawLog {
  topics: string[];
  data: string;
  blockNumber: string;
  logIndex: string;
}

function word(data: string, i: number): bigint {
  const body = data.startsWith("0x") ? data.slice(2) : data;
  return BigInt("0x" + body.slice(i * 64, (i + 1) * 64));
}

/** Reads a 32-byte word that holds a sign-extended signed integer. */
function signed(value: bigint): bigint {
  return value >= 1n << 255n ? value - (1n << 256n) : value;
}

/**
 * v4 emits the swapper's own balance delta, so a negative token0 amount means they
 * paid token0 in. `sender` is the PoolManager's caller, which is the same address
 * the hook prices.
 */
export function decodeSwapLog(log: RawLog): Swap {
  const amount0 = signed(word(log.data, 0));
  const amount1 = signed(word(log.data, 1));
  const zeroForOne = amount0 < 0n;

  return {
    blockNumber: Number(BigInt(log.blockNumber)),
    index: Number(BigInt(log.logIndex)),
    poolId: log.topics[1],
    sender: "0x" + log.topics[2].slice(-40),
    zeroForOne,
    amountIn: zeroForOne ? -amount0 : -amount1,
    amountOut: zeroForOne ? amount1 : amount0,
  };
}

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = (await res.json()) as { result?: T; error?: { message: string } };
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return body.result as T;
}

export interface FetchOptions {
  rpcUrl: string;
  poolManager: string;
  fromBlock: number;
  toBlock: number | "latest";
  poolId?: string;
  chunkSize?: number;
}

/** Pulls Swap logs in chunks, because public RPCs cap the range they will scan. */
export async function fetchSwaps(options: FetchOptions): Promise<Swap[]> {
  const { rpcUrl, poolManager, fromBlock, poolId, chunkSize = 2_000 } = options;

  const head =
    options.toBlock === "latest"
      ? Number(BigInt(await rpc<string>(rpcUrl, "eth_blockNumber", [])))
      : options.toBlock;

  const topics: (string | null)[] = [SWAP_TOPIC];
  if (poolId) topics.push(poolId);

  const swaps: Swap[] = [];
  for (let start = fromBlock; start <= head; start += chunkSize) {
    const end = Math.min(start + chunkSize - 1, head);
    const logs = await rpc<RawLog[]>(rpcUrl, "eth_getLogs", [
      {
        address: poolManager,
        fromBlock: "0x" + start.toString(16),
        toBlock: "0x" + end.toString(16),
        topics,
      },
    ]);
    for (const log of logs) swaps.push(decodeSwapLog(log));
  }

  return swaps;
}
