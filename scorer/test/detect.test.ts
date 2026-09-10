import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFeatures, detectSandwiches } from "../src/detect.ts";
import type { Swap } from "../src/types.ts";

const POOL = "0xpool";
const BOT = "0xBot";
const VICTIM = "0xVictim";
const TRADER = "0xTrader";

function swap(partial: Partial<Swap> & Pick<Swap, "index" | "sender" | "zeroForOne">): Swap {
  return {
    blockNumber: 100,
    poolId: POOL,
    amountIn: 1_000n,
    amountOut: 1_000n,
    ...partial,
  };
}

test("detects a textbook sandwich", () => {
  const swaps: Swap[] = [
    swap({ index: 0, sender: BOT, zeroForOne: true, amountIn: 1_000n, amountOut: 990n }),
    swap({ index: 1, sender: VICTIM, zeroForOne: true }),
    swap({ index: 2, sender: BOT, zeroForOne: false, amountIn: 990n, amountOut: 1_050n }),
  ];

  const found = detectSandwiches(swaps);
  assert.equal(found.length, 1);
  assert.equal(found[0].attacker, BOT);
  assert.deepEqual(found[0].victims, [VICTIM]);
});

test("a round trip with nobody in between is not a sandwich", () => {
  const swaps: Swap[] = [
    swap({ index: 0, sender: BOT, zeroForOne: true, amountIn: 1_000n, amountOut: 990n }),
    swap({ index: 1, sender: BOT, zeroForOne: false, amountIn: 990n, amountOut: 1_010n }),
  ];
  assert.equal(detectSandwiches(swaps).length, 0);
});

test("a victim trading the other way is not being sandwiched", () => {
  const swaps: Swap[] = [
    swap({ index: 0, sender: BOT, zeroForOne: true, amountIn: 1_000n, amountOut: 990n }),
    swap({ index: 1, sender: VICTIM, zeroForOne: false }),
    swap({ index: 2, sender: BOT, zeroForOne: false, amountIn: 990n, amountOut: 1_050n }),
  ];
  assert.equal(detectSandwiches(swaps).length, 0);
});

test("legs that do not offset each other are left alone", () => {
  const swaps: Swap[] = [
    swap({ index: 0, sender: TRADER, zeroForOne: true, amountIn: 1_000n, amountOut: 990n }),
    swap({ index: 1, sender: VICTIM, zeroForOne: true }),
    swap({ index: 2, sender: TRADER, zeroForOne: false, amountIn: 5n, amountOut: 5n }),
  ];
  assert.equal(detectSandwiches(swaps).length, 0);
});

test("the same shape in a different block is not a sandwich", () => {
  const swaps: Swap[] = [
    swap({ index: 0, sender: BOT, zeroForOne: true, amountIn: 1_000n, amountOut: 990n }),
    swap({ index: 1, sender: VICTIM, zeroForOne: true }),
    swap({ blockNumber: 101, index: 0, sender: BOT, zeroForOne: false, amountIn: 990n, amountOut: 1_050n }),
  ];
  assert.equal(detectSandwiches(swaps).length, 0);
});

test("counts every victim caught in one sandwich", () => {
  const swaps: Swap[] = [
    swap({ index: 0, sender: BOT, zeroForOne: true, amountIn: 1_000n, amountOut: 990n }),
    swap({ index: 1, sender: VICTIM, zeroForOne: true }),
    swap({ index: 2, sender: TRADER, zeroForOne: true }),
    swap({ index: 3, sender: BOT, zeroForOne: false, amountIn: 990n, amountOut: 1_100n }),
  ];
  const found = detectSandwiches(swaps);
  assert.equal(found.length, 1);
  assert.equal(found[0].victims.length, 2);
});

test("features attribute sandwiches to the attacker only", () => {
  const swaps: Swap[] = [
    swap({ index: 0, sender: BOT, zeroForOne: true, amountIn: 1_000n, amountOut: 990n }),
    swap({ index: 1, sender: VICTIM, zeroForOne: true }),
    swap({ index: 2, sender: BOT, zeroForOne: false, amountIn: 990n, amountOut: 1_050n }),
  ];

  const features = buildFeatures(swaps);
  const bot = features.find((f) => f.address === BOT.toLowerCase());
  const victim = features.find((f) => f.address === VICTIM.toLowerCase());

  assert.equal(bot?.sandwiches, 1);
  assert.equal(bot?.victimsHarmed, 1);
  assert.equal(victim?.sandwiches, 0);
});
