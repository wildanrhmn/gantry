import { BigInt } from "@graphprotocol/graph-ts";
import { Tolled } from "../generated/Gantry/Gantry";
import { Toll } from "../generated/schema";
import { loadTrader, loadVenue } from "./shared";

export function handleTolled(event: Tolled): void {
  const timestamp = event.block.timestamp;
  const trader = loadTrader(event.params.payer, timestamp);
  const fee = BigInt.fromI32(event.params.fee);

  trader.swaps = trader.swaps.plus(BigInt.fromI32(1));
  trader.feePaidTotal = trader.feePaidTotal.plus(fee);
  trader.lastSeen = timestamp;
  trader.save();

  const toll = new Toll(event.transaction.hash.concatI32(event.logIndex.toI32()));
  toll.trader = trader.id;
  toll.tier = event.params.tier;
  toll.fee = event.params.fee;
  toll.blockNumber = event.block.number;
  toll.timestamp = timestamp;
  toll.transactionHash = event.transaction.hash;
  toll.save();

  const venue = loadVenue();
  venue.tolls = venue.tolls.plus(BigInt.fromI32(1));
  venue.feePaidTotal = venue.feePaidTotal.plus(fee);

  const byTier = venue.tollsByTier;
  const index = event.params.tier;
  if (index < byTier.length) {
    byTier[index] = byTier[index].plus(BigInt.fromI32(1));
    venue.tollsByTier = byTier;
  }
  venue.save();
}
