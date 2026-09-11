import { Hero } from "@/components/landing/Hero";
import { Marquee } from "@/components/landing/Marquee";
import { BuiltOn, Problem, Proof } from "@/components/landing/Sections";
import { Mechanism } from "@/components/landing/Mechanism";
import { laneSample } from "@/lib/mainnet";
import { scanWindow, worstOffenders } from "@/lib/lookup";

export const revalidate = 30;

/** Shown while the indexer is unreachable, so the card is never empty on screen. */
const PLACEHOLDER = [{ address: "0x0000000000000000000000000000000000000000", tier: 1 }];

export default async function Home() {
  const [scan, lane, worst] = await Promise.all([scanWindow(), laneSample(), worstOffenders(1)]);
  const cars = lane.length ? lane.map((r) => ({ address: r.id, tier: r.tier })) : PLACEHOLDER;
  const count = (v: number) => v.toLocaleString("en-US");

  // the address the mechanism section follows, taken live rather than written down
  const top = worst[0];
  const subject = top
    ? { address: top.id, swaps: Number(top.swaps), sandwiches: Number(top.sandwiches), tier: top.tier }
    : { address: PLACEHOLDER[0].address, swaps: 0, sandwiches: 0, tier: 1 };

  const tape: [string, string][] = [
    ["swaps read", count(scan.swaps)],
    ["sandwiches found", count(scan.sandwiches)],
    ["addresses scored", count(scan.addresses)],
    ["indexed to block", count(scan.toBlock)],
    ["reverted attempts", count(scan.reverted)],
    ["clean pays", "0.05%"],
    ["extractor pays", "1.00%"],
    ["venue", "Uniswap v4"],
    ["data", "The Graph"],
    ["scoring", "Chainlink CRE"],
  ];

  return (
    <>
      <Hero cars={cars} stats={scan} />
      <Marquee items={tape} />
      <Problem scan={scan} />
      <Mechanism subject={subject} />
      <Proof />
      <BuiltOn />
    </>
  );
}
