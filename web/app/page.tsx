import { Hero } from "@/components/landing/Hero";
import { Marquee } from "@/components/landing/Marquee";
import { ScanBand } from "@/components/landing/ScanBand";
import { BuiltOn, FinalCta, Mechanism, Problem, Proof } from "@/components/landing/Sections";
import { laneSample } from "@/lib/mainnet";
import { scanWindow } from "@/lib/lookup";

export const revalidate = 30;

/** Shown while the indexer is unreachable, so the card is never empty on screen. */
const PLACEHOLDER = [{ address: "0x0000000000000000000000000000000000000000", tier: 1 }];

export default async function Home() {
  const [scan, lane] = await Promise.all([scanWindow(), laneSample()]);
  const cars = lane.length ? lane.map((r) => ({ address: r.id, tier: r.tier })) : PLACEHOLDER;
  const count = (v: number) => v.toLocaleString("en-US");

  const tape: [string, string][] = [
    ["swaps read", count(scan.swaps)],
    ["sandwiches found", count(scan.sandwiches)],
    ["addresses scored", count(scan.addresses)],
    ["indexed to block", count(scan.toBlock)],
    ["reverted attempts", "2,827"],
    ["clean pays", "0.05%"],
    ["extractor pays", "1.00%"],
    ["venue", "Uniswap v4"],
    ["data", "The Graph"],
    ["scoring", "Chainlink CRE"],
  ];

  return (
    <>
      <Hero cars={cars} />
      <Marquee items={tape} />
      <Problem scan={scan} />
      <Mechanism />
      <Proof />
      <ScanBand stats={scan} cars={cars} />
      <BuiltOn />
      <FinalCta />
    </>
  );
}
