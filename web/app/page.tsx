import Link from "next/link";
import { LookupField } from "@/components/LookupField";
import { scanWindow, worstOffenders } from "@/lib/lookup";
import { tier as tierOf } from "@/lib/tiers";
import table from "@/components/Table.module.css";
import styles from "./home.module.css";

export default async function Home() {
  const [worst, scan] = await Promise.all([worstOffenders(8), scanWindow()]);

  return (
    <main className="page">
      <section className={styles.hero}>
        <p className={styles.tagline}>every swap gets read as it passes</p>
        <LookupField />
      </section>

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
  );
}
