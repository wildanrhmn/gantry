import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import { Swap } from "../generated/PoolManager/PoolManager";
import { BlockPool, MainnetTrader, OriginatorLink, RawSwap, Scan } from "../generated/schema";

const ONE = BigInt.fromI32(1);
const ZERO = BigInt.zero();
const SCAN = Bytes.fromUTF8("gantry");

/**
 * The published tier rules, kept identical to scorer/src/score.ts. The thresholds the
 * enclave actually signs with are secrets; these are the defaults, so the site can show
 * what the rules would say without pretending to be the oracle.
 */
const SHARED_INFRA_MIN_ORIGINATORS = BigInt.fromI32(5);
const EXTRACTOR_MIN_SANDWICHES = BigInt.fromI32(3);
const CLEAN_MIN_SWAPS = BigInt.fromI32(20);
const CLEAN_MIN_BLOCK_SPAN = BigInt.fromI32(5000);

function tierOf(t: MainnetTrader): i32 {
  // Pricing a shared router would charge every trader behind it for one bot's
  // behaviour. Those addresses stay unknown; the traders behind them can attest.
  if (t.originators.ge(SHARED_INFRA_MIN_ORIGINATORS)) return 1;
  if (t.sandwiches.ge(EXTRACTOR_MIN_SANDWICHES)) return 3;
  if (t.sandwiches.ge(ONE)) return 2;
  if (t.blocks.gt(ZERO) && t.roundTrips.times(BigInt.fromI32(2)).ge(t.blocks)) return 2;
  if (t.swaps.ge(CLEAN_MIN_SWAPS) && t.lastBlock.minus(t.firstBlock).ge(CLEAN_MIN_BLOCK_SPAN)) return 0;
  // Anything we have not seen enough of stays unknown. Never clean by default.
  return 1;
}

/** How closely a backrun must reverse its own frontrun, in percent. */
const TOLERANCE = BigInt.fromI32(20);
const HUNDRED = BigInt.fromI32(100);

function loadTrader(address: Bytes, block: BigInt): MainnetTrader {
  let trader = MainnetTrader.load(address);
  if (trader == null) {
    trader = new MainnetTrader(address);
    trader.swaps = ZERO;
    trader.blocks = ZERO;
    trader.sandwiches = ZERO;
    trader.victims = ZERO;
    trader.roundTrips = ZERO;
    trader.originators = ZERO;
    trader.firstBlock = block;
    trader.lastBlock = block;
    trader.tier = 1;
    trader.sharedInfrastructure = false;
  }
  return trader as MainnetTrader;
}

/** The closing leg has to return roughly what the opening leg acquired. */
function offsets(frontOut: BigInt, backIn: BigInt): boolean {
  if (frontOut.le(ZERO) || backIn.le(ZERO)) return false;
  let hi = frontOut.gt(backIn) ? frontOut : backIn;
  let lo = frontOut.gt(backIn) ? backIn : frontOut;
  return hi.minus(lo).times(HUNDRED).le(hi.times(TOLERANCE));
}

export function handleSwap(event: Swap): void {
  let caller = event.params.sender;
  let originator = event.transaction.from;
  let blockNumber = event.block.number;

  // v4 emits the swapper's own delta, so a negative token0 amount means they paid it in.
  let amount0 = event.params.amount0;
  let amount1 = event.params.amount1;
  let zeroForOne = amount0.lt(ZERO);
  let amountIn = zeroForOne ? amount0.neg() : amount1.neg();
  let amountOut = zeroForOne ? amount1 : amount0;

  let scan = Scan.load(SCAN);
  if (scan == null) {
    scan = new Scan(SCAN);
    scan.swaps = ZERO;
    scan.sandwiches = ZERO;
    scan.addresses = ZERO;
    scan.firstBlock = blockNumber;
  }
  scan.swaps = scan.swaps.plus(ONE);
  scan.lastBlock = blockNumber;

  let seen = MainnetTrader.load(caller) != null;
  if (!seen) scan.addresses = scan.addresses.plus(ONE);

  let trader = loadTrader(caller, blockNumber);
  trader.swaps = trader.swaps.plus(ONE);
  if (trader.blocks.equals(ZERO) || trader.lastBlock.notEqual(blockNumber)) {
    trader.blocks = trader.blocks.plus(ONE);
  }
  trader.lastBlock = blockNumber;

  // One link per (caller, originator). A link appearing for the first time is a
  // newly seen originator, which is how shared infrastructure gives itself away.
  let linkId = caller.concat(originator);
  if (OriginatorLink.load(linkId) == null) {
    let link = new OriginatorLink(linkId);
    link.save();
    trader.originators = trader.originators.plus(ONE);
  }
  trader.tier = tierOf(trader);
  trader.sharedInfrastructure = trader.originators.ge(SHARED_INFRA_MIN_ORIGINATORS);
  trader.save();

  let bucketId = Bytes.fromUTF8(blockNumber.toString()).concat(event.params.id);
  let bucket = BlockPool.load(bucketId);
  if (bucket == null) {
    bucket = new BlockPool(bucketId);
    bucket.swaps = [];
  }

  let swapId = event.transaction.hash.concatI32(event.logIndex.toI32());
  let current = new RawSwap(swapId);
  current.pool = bucketId;
  current.caller = caller;
  current.originator = originator;
  current.zeroForOne = zeroForOne;
  current.amountIn = amountIn;
  current.amountOut = amountOut;
  current.logIndex = event.logIndex;
  current.consumed = false;
  current.save();

  let earlier = bucket.swaps;

  // Walk back for an opening leg by the same originator, in the opposite direction,
  // with somebody else trading the front's way in between. That shape is a sandwich.
  for (let i = earlier.length - 1; i >= 0; i--) {
    let front = RawSwap.load(earlier[i]);
    if (front == null) continue;
    if (front.consumed) continue;
    if (front.originator != originator) continue;
    if (front.zeroForOne == zeroForOne) continue;
    if (!offsets(front.amountOut, amountIn)) continue;

    let victims = 0;
    for (let j = i + 1; j < earlier.length; j++) {
      let between = RawSwap.load(earlier[j]);
      if (between == null) continue;
      if (between.originator == originator) continue;
      if (between.zeroForOne != front.zeroForOne) continue;
      victims += 1;
    }

    trader.roundTrips = trader.roundTrips.plus(ONE);

    if (victims > 0) {
      trader.sandwiches = trader.sandwiches.plus(ONE);
      trader.victims = trader.victims.plus(BigInt.fromI32(victims));
      front.consumed = true;
      front.save();
      current.consumed = true;
      current.save();
      scan.sandwiches = scan.sandwiches.plus(ONE);
    }
    trader.tier = tierOf(trader);
    trader.save();
    break;
  }

  earlier.push(swapId);
  bucket.swaps = earlier;
  bucket.save();
  scan.save();
}
