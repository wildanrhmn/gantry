import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import { Trader, Venue } from "../generated/schema";

export const VENUE_ID = Bytes.fromUTF8("gantry");
export const TIER_UNKNOWN = 1;

export function loadVenue(): Venue {
  let venue = Venue.load(VENUE_ID);
  if (venue == null) {
    venue = new Venue(VENUE_ID);
    venue.tolls = BigInt.zero();
    venue.tradersSeen = BigInt.zero();
    venue.feePaidTotal = BigInt.zero();
    venue.tollsByTier = [BigInt.zero(), BigInt.zero(), BigInt.zero(), BigInt.zero()];
  }
  return venue as Venue;
}

/** An address nobody has scored is unknown, never clean. */
export function loadTrader(address: Bytes, timestamp: BigInt): Trader {
  let trader = Trader.load(address);
  if (trader == null) {
    trader = new Trader(address);
    trader.tier = TIER_UNKNOWN;
    trader.scored = false;
    trader.swaps = BigInt.zero();
    trader.feePaidTotal = BigInt.zero();
    trader.firstSeen = timestamp;
    trader.lastSeen = timestamp;

    const venue = loadVenue();
    venue.tradersSeen = venue.tradersSeen.plus(BigInt.fromI32(1));
    venue.save();
  }
  return trader as Trader;
}
