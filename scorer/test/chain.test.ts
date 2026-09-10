import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeSwapLog, type RawLog } from "../src/chain.ts";

function encodeWord(value: bigint): string {
  const masked = value < 0n ? (1n << 256n) + value : value;
  return masked.toString(16).padStart(64, "0");
}

function log(amount0: bigint, amount1: bigint, sender: string): RawLog {
  return {
    topics: [
      "0x40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f",
      "0x" + "11".repeat(32),
      "0x" + "0".repeat(24) + sender.slice(2),
    ],
    data: "0x" + encodeWord(amount0) + encodeWord(amount1) + encodeWord(0n).repeat(4),
    blockNumber: "0x64",
    logIndex: "0x2",
  };
}

test("a negative token0 delta means the swapper sold token0", () => {
  const swap = decodeSwapLog(log(-1_000n, 990n, "0xAbCdEf0000000000000000000000000000000001"));
  assert.equal(swap.zeroForOne, true);
  assert.equal(swap.amountIn, 1_000n);
  assert.equal(swap.amountOut, 990n);
});

test("the mirror case is decoded the other way round", () => {
  const swap = decodeSwapLog(log(990n, -1_000n, "0xAbCdEf0000000000000000000000000000000001"));
  assert.equal(swap.zeroForOne, false);
  assert.equal(swap.amountIn, 1_000n);
  assert.equal(swap.amountOut, 990n);
});

test("sender comes out of the indexed topic", () => {
  const swap = decodeSwapLog(log(-1n, 1n, "0xAbCdEf0000000000000000000000000000000001"));
  assert.equal(swap.sender.toLowerCase(), "0xabcdef0000000000000000000000000000000001");
  assert.equal(swap.blockNumber, 100);
  assert.equal(swap.index, 2);
});
