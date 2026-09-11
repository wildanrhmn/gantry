import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TIER_CLEAN,
  TIER_EXTRACTOR,
  TIER_SUSPECTED,
  TIER_UNKNOWN,
  encodeTierReport,
  isSharedInfrastructure,
  scoreAddress,
  type AddressFeatures,
  type ScoringParams,
} from "./scoring.ts";

const PARAMS: ScoringParams = {
  extractorMinSandwiches: 3,
  suspectedMinSandwiches: 1,
  suspectedRoundTripsPerBlock: 0.5,
  cleanMinSwaps: 20,
  cleanMinBlockSpan: 5_000,
  sharedInfraMinOriginators: 5,
  suspectedMinFailedAttempts: 20,
  cleanMaxFailedAttempts: 2,
};

function features(partial: Partial<AddressFeatures> = {}): AddressFeatures {
  return {
    address: "0x0000000000000000000000000000000000000001",
    swaps: 0,
    blocks: 0,
    sandwiches: 0,
    victimsHarmed: 0,
    roundTrips: 0,
    originators: 1,
    failedAttempts: 0,
    firstBlock: 0,
    lastBlock: 0,
    ...partial,
  };
}

test("an unseen address is unknown, never clean", () => {
  assert.equal(scoreAddress(features(), PARAMS), TIER_UNKNOWN);
});

test("repeat sandwiching reaches the extractor tier", () => {
  assert.equal(scoreAddress(features({ sandwiches: 3 }), PARAMS), TIER_EXTRACTOR);
});

test("one sandwich is suspected", () => {
  assert.equal(scoreAddress(features({ sandwiches: 1 }), PARAMS), TIER_SUSPECTED);
});

test("clean needs both volume and history", () => {
  assert.equal(scoreAddress(features({ swaps: 50, blocks: 50, lastBlock: 10_000 }), PARAMS), TIER_CLEAN);
  assert.equal(scoreAddress(features({ swaps: 50, blocks: 50, lastBlock: 10 }), PARAMS), TIER_UNKNOWN);
});

// Real numbers from a mainnet scan of blocks 25940000-25941500.
test("uniswap's universal router is treated as shared infrastructure", () => {
  const router = features({ originators: 1319, swaps: 3580, sandwiches: 23 });
  assert.ok(isSharedInfrastructure(router, PARAMS));
  assert.equal(scoreAddress(router, PARAMS), TIER_UNKNOWN, "charging a router charges everyone behind it");
});

test("a dedicated bot contract is scored on its own behaviour", () => {
  const bot = features({ originators: 1, swaps: 680, sandwiches: 11 });
  assert.equal(isSharedInfrastructure(bot, PARAMS), false);
  assert.equal(scoreAddress(bot, PARAMS), TIER_EXTRACTOR);
});

test("changing a secret threshold changes the verdict", () => {
  const f = features({ sandwiches: 2 });
  assert.equal(scoreAddress(f, PARAMS), TIER_SUSPECTED);
  assert.equal(scoreAddress(f, { ...PARAMS, extractorMinSandwiches: 2 }), TIER_EXTRACTOR);
});

test("the report encodes as the receiver decodes it", () => {
  const encoded = encodeTierReport([
    { address: "0x00000000000000000000000000000000000000aa", tier: 3 },
    { address: "0x00000000000000000000000000000000000000bb", tier: 0 },
  ]);
  assert.ok(encoded.startsWith("0x"));
  assert.ok(encoded.toLowerCase().includes("aa"));
});

test("reverted attempts count against an address that no subgraph could see", () => {
  const racer = features({ swaps: 50, blocks: 50, lastBlock: 10_000, failedAttempts: 60 });
  assert.equal(scoreAddress(racer, PARAMS), TIER_SUSPECTED);
});
