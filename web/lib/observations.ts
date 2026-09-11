import type { MainnetTrader } from "@/lib/mainnet";
import type { Observation } from "@/lib/tiers";

const count = (n: number | string) => Number(n).toLocaleString("en-US");

/** Values, never verdicts. Pure, so the page can compose it from whichever source lands. */
export function buildObservations(row: MainnetTrader, reverted: number): Observation[] {
  return [
    { label: "Swaps observed", value: count(row.swaps) },
    { label: "Blocks active", value: count(row.blocks) },
    {
      label: "Sandwich-shaped sequences",
      value: count(row.sandwiches),
      note: Number(row.sandwiches) > 0 ? "opened and closed around another trade" : undefined,
    },
    { label: "Same-block round trips", value: count(row.roundTrips) },
    {
      label: "Distinct originators",
      value: count(row.originators),
      note: row.sharedInfrastructure
        ? "many unrelated people trade through this address"
        : "one operator",
    },
    {
      label: "Reverted attempts",
      value: count(reverted),
      note: "from transaction traces; no subgraph can see these",
    },
    { label: "First seen", value: `block ${count(row.firstBlock)}` },
    { label: "Last seen", value: `block ${count(row.lastBlock)}` },
  ];
}
