import type { AddressFeatures, Sandwich, Swap } from "./types.ts";

/**
 * How closely a backrun must reverse its own frontrun to count as a sandwich.
 * Kept tight on purpose: missing a sandwich costs nothing, mispricing an honest
 * trader costs them money.
 */
const DEFAULT_OFFSET_TOLERANCE = 0.2;

function ratioWithin(a: bigint, b: bigint, tolerance: number): boolean {
  if (a === 0n || b === 0n) return false;
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return Number(hi - lo) / Number(hi) <= tolerance;
}

function groupKey(swap: Swap): string {
  return `${swap.blockNumber}:${swap.poolId}`;
}

/**
 * A sandwich is one address opening and closing a position around someone else's
 * trade, inside a single block and pool. Detection looks for that exact shape:
 * a swap, at least one other party trading the same way behind it, then the same
 * address unwinding roughly the amount it just acquired.
 */
export function detectSandwiches(swaps: Swap[], tolerance = DEFAULT_OFFSET_TOLERANCE): Sandwich[] {
  const groups = new Map<string, Swap[]>();
  for (const swap of swaps) {
    const key = groupKey(swap);
    const bucket = groups.get(key);
    if (bucket) bucket.push(swap);
    else groups.set(key, [swap]);
  }

  const found: Sandwich[] = [];

  for (const bucket of groups.values()) {
    const ordered = [...bucket].sort((a, b) => a.index - b.index);

    const byAddress = new Map<string, Swap[]>();
    for (const swap of ordered) {
      const key = swap.sender.toLowerCase();
      const list = byAddress.get(key);
      if (list) list.push(swap);
      else byAddress.set(key, [swap]);
    }

    for (const [address, own] of byAddress) {
      if (own.length < 2) continue;

      const consumed = new Set<number>();

      for (let i = 0; i < own.length; i++) {
        const front = own[i];
        if (consumed.has(front.index)) continue;

        for (let k = i + 1; k < own.length; k++) {
          const back = own[k];
          if (consumed.has(back.index) || back.zeroForOne === front.zeroForOne) continue;

          // Both legs must come from the same originator where we know it. Without this
          // a shared router is indistinguishable from a sandwich, because unrelated users
          // trading through it in one block produce exactly the same shape.
          if (front.txFrom && back.txFrom && front.txFrom.toLowerCase() !== back.txFrom.toLowerCase()) {
            continue;
          }

          // The unwind should return roughly what the opening leg acquired.
          if (!ratioWithin(front.amountOut, back.amountIn, tolerance)) continue;

          const victims = ordered
            .filter((s) => {
              if (s.index <= front.index || s.index >= back.index) return false;
              if (s.zeroForOne !== front.zeroForOne) return false;
              if (front.txFrom && s.txFrom) return s.txFrom.toLowerCase() !== front.txFrom.toLowerCase();
              return s.sender.toLowerCase() !== address;
            })
            .map((s) => s.sender);

          if (victims.length === 0) continue;

          found.push({
            poolId: front.poolId,
            blockNumber: front.blockNumber,
            attacker: front.sender,
            victims,
            frontrunIndex: front.index,
            backrunIndex: back.index,
          });

          consumed.add(front.index);
          consumed.add(back.index);
          break;
        }
      }
    }
  }

  return found.sort((a, b) => a.blockNumber - b.blockNumber || a.frontrunIndex - b.frontrunIndex);
}

/** Counts opposite-direction round trips inside one block, sandwich or not. */
function countRoundTrips(swaps: Swap[]): Map<string, number> {
  const counts = new Map<string, number>();
  const groups = new Map<string, Swap[]>();

  for (const swap of swaps) {
    const key = `${groupKey(swap)}:${swap.sender.toLowerCase()}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(swap);
    else groups.set(key, [swap]);
  }

  for (const bucket of groups.values()) {
    const forward = bucket.filter((s) => s.zeroForOne).length;
    const backward = bucket.length - forward;
    const trips = Math.min(forward, backward);
    if (trips === 0) continue;
    const address = bucket[0].sender.toLowerCase();
    counts.set(address, (counts.get(address) ?? 0) + trips);
  }

  return counts;
}

export function buildFeatures(
  swaps: Swap[],
  sandwiches = detectSandwiches(swaps),
  /** Reverted PoolManager transactions per address, which only traces can supply. */
  failedAttempts: Map<string, number> = new Map(),
): AddressFeatures[] {
  const roundTrips = countRoundTrips(swaps);
  const acc = new Map<string, AddressFeatures & { blockSet: Set<number>; originatorSet: Set<string> }>();

  for (const swap of swaps) {
    const address = swap.sender.toLowerCase();
    let entry = acc.get(address);
    if (!entry) {
      entry = {
        address,
        originators: 0,
        failedAttempts: 0,
        swaps: 0,
        blocks: 0,
        sandwiches: 0,
        victimsHarmed: 0,
        roundTrips: roundTrips.get(address) ?? 0,
        firstBlock: swap.blockNumber,
        lastBlock: swap.blockNumber,
        blockSet: new Set<number>(),
        originatorSet: new Set<string>(),
      };
      acc.set(address, entry);
    }
    entry.swaps++;
    entry.blockSet.add(swap.blockNumber);
    if (swap.txFrom) entry.originatorSet.add(swap.txFrom.toLowerCase());
    if (swap.blockNumber < entry.firstBlock) entry.firstBlock = swap.blockNumber;
    if (swap.blockNumber > entry.lastBlock) entry.lastBlock = swap.blockNumber;
  }

  for (const sandwich of sandwiches) {
    const entry = acc.get(sandwich.attacker.toLowerCase());
    if (!entry) continue;
    entry.sandwiches++;
    entry.victimsHarmed += sandwich.victims.length;
  }

  return [...acc.values()].map(({ blockSet, originatorSet, ...rest }) => ({
    ...rest,
    blocks: blockSet.size,
    originators: originatorSet.size,
    failedAttempts: failedAttempts.get(rest.address) ?? 0,
  }));
}
