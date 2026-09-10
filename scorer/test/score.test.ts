import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PARAMS, scoreAddress } from "../src/score.ts";
import { Tier, type AddressFeatures } from "../src/types.ts";

function features(partial: Partial<AddressFeatures> = {}): AddressFeatures {
  return {
    address: "0xabc",
    swaps: 0,
    blocks: 0,
    sandwiches: 0,
    victimsHarmed: 0,
    roundTrips: 0,
    firstBlock: 0,
    lastBlock: 0,
    ...partial,
  };
}

test("an address we have never seen is unknown, not clean", () => {
  assert.equal(scoreAddress(features()), Tier.Unknown);
});

test("repeat sandwiching lands on the extractor tier", () => {
  assert.equal(scoreAddress(features({ sandwiches: DEFAULT_PARAMS.extractorMinSandwiches })), Tier.Extractor);
});

test("a single sandwich is suspected, not yet extractor", () => {
  assert.equal(scoreAddress(features({ sandwiches: 1 })), Tier.Suspected);
});

test("heavy same-block round tripping is suspected even with no sandwich found", () => {
  assert.equal(scoreAddress(features({ blocks: 10, roundTrips: 8, swaps: 40 })), Tier.Suspected);
});

test("clean needs both enough trades and enough history", () => {
  const enough = features({ swaps: 50, blocks: 50, firstBlock: 0, lastBlock: 10_000 });
  assert.equal(scoreAddress(enough), Tier.Clean);

  const tooNew = features({ swaps: 50, blocks: 50, firstBlock: 0, lastBlock: 10 });
  assert.equal(scoreAddress(tooNew), Tier.Unknown);

  const tooFew = features({ swaps: 2, blocks: 2, firstBlock: 0, lastBlock: 10_000 });
  assert.equal(scoreAddress(tooFew), Tier.Unknown);
});

test("a fresh address cannot be cheaper than a known clean one", () => {
  const fresh = scoreAddress(features({ swaps: 1, blocks: 1 }));
  const established = scoreAddress(features({ swaps: 50, blocks: 50, firstBlock: 0, lastBlock: 10_000 }));
  assert.ok(fresh > established, "rotating to a new address must not pay less");
});

test("moving the thresholds moves the verdict", () => {
  const f = features({ sandwiches: 2 });
  assert.equal(scoreAddress(f, DEFAULT_PARAMS), Tier.Suspected);
  assert.equal(scoreAddress(f, { ...DEFAULT_PARAMS, extractorMinSandwiches: 2 }), Tier.Extractor);
});
