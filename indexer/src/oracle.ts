import { TierSet } from "../generated/TierOracle/TierOracle";
import { TierChange } from "../generated/schema";
import { loadTrader } from "./shared";

export function handleTierSet(event: TierSet): void {
  const timestamp = event.block.timestamp;
  const trader = loadTrader(event.params.account, timestamp);

  const change = new TierChange(event.transaction.hash.concatI32(event.logIndex.toI32()));
  change.trader = trader.id;
  change.tier = event.params.tier;
  change.previousTier = trader.tier;
  change.blockNumber = event.block.number;
  change.timestamp = timestamp;
  change.save();

  trader.tier = event.params.tier;
  trader.scored = true;
  trader.save();
}
