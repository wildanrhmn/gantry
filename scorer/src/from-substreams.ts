import type { Swap } from "./types.ts";

/** Shape emitted by `substreams run map_swaps -o json`. */
interface RawSwap {
  blockNumber: string;
  logIndex: number;
  poolId: string;
  sender: string;
  zeroForOne?: boolean;
  amountIn: string;
  amountOut: string;
  txFrom?: string;
}

/** Substreams streams one JSON object per block, concatenated. */
export function parseSubstreamsOutput(text: string): Swap[] {
  const swaps: Swap[] = [];
  let buffer = "";
  let depth = 0;

  for (const char of text) {
    buffer += char;
    if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth !== 0) continue;
      try {
        const message = JSON.parse(buffer) as { "@data"?: { swaps?: RawSwap[] } };
        for (const raw of message["@data"]?.swaps ?? []) {
          swaps.push({
            blockNumber: Number(raw.blockNumber),
            index: raw.logIndex,
            poolId: raw.poolId,
            sender: raw.sender,
            // protobuf omits false, so an absent flag means one-for-zero
            zeroForOne: raw.zeroForOne === true,
            amountIn: BigInt(raw.amountIn || "0"),
            amountOut: BigInt(raw.amountOut || "0"),
            txFrom: raw.txFrom,
          });
        }
      } catch {
        // partial or non-data frame, skip it
      }
      buffer = "";
    }
  }

  return swaps;
}
