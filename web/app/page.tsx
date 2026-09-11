import Link from "next/link";
import { Hero } from "@/components/landing/Hero";
import { ScanBand } from "@/components/landing/ScanBand";
import { laneSample } from "@/lib/mainnet";
import { scanWindow, worstOffenders } from "@/lib/lookup";
import { tier as tierOf } from "@/lib/tiers";
import table from "@/components/Table.module.css";

export const revalidate = 30;

/** Shown while the indexer is unreachable, so the lane is never empty on screen. */
const PLACEHOLDER = [
  { address: "0x0000000000000000000000000000000000000000", tier: 1 },
];

export default async function Home() {
  const [scan, worst, lane] = await Promise.all([scanWindow(), worstOffenders(8), laneSample()]);
  const cars = lane.length ? lane.map((r) => ({ address: r.id, tier: r.tier })) : PLACEHOLDER;

  return (
    <>
      <Hero cars={cars} />
      <ScanBand stats={scan} cars={cars} />

      <main className="page">
        <section className="section">
          <p className="eyebrow">Already found</p>
          <h2 className="display h3">Addresses the scan priced up</h2>
          <p className="lede">
            From {scan.swaps.toLocaleString()} swaps across{" "}
            {(scan.toBlock - scan.fromBlock).toLocaleString()} blocks of Ethereum mainnet, read
            live at block {scan.toBlock.toLocaleString()}. {scan.sandwiches.toLocaleString()}{" "}
            sandwich-shaped sequences, attributed only where one originator was behind both legs.
          </p>
          <table className={table.table}>
            <thead>
              <tr>
                <th>Address</th>
                <th>Tier</th>
                <th className={table.right}>Sandwiches</th>
              </tr>
            </thead>
            <tbody>
              {worst.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/address/${r.id}`} className={table.link}>{r.id}</Link>
                    <span className={table.note}>{r.originators} originator{r.originators === "1" ? "" : "s"}</span>
                  </td>
                  <td>
                    <span className={`${table.badge} ${table[`t${r.tier}`]}`}>{tierOf(r.tier).name}</span>
                  </td>
                  <td className={table.right}>{r.sandwiches}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}
