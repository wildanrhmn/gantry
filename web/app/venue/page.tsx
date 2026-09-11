import Link from "next/link";
import { venue } from "@/lib/subgraph";
import { scanWindow, sharedInfrastructure } from "@/lib/lookup";
import { tier as tierOf, TIERS } from "@/lib/tiers";
import table from "@/components/Table.module.css";
import styles from "./venue.module.css";

export const revalidate = 30;
export const metadata = { title: "Venue | Gantry" };

export default async function VenuePage() {
  const data = await venue();
  const v = data?.venues?.[0];
  const [shared, scan] = await Promise.all([sharedInfrastructure(8), scanWindow()]);

  return (
    <main className="page">
      <section className="section">
        <p className="eyebrow">The venue</p>
        <h1 className="display h3">Where the traffic sits</h1>
        <p className="lede">
          The fee the hook returns is the pool&apos;s LP fee for that swap, so a higher tier is
          paid straight to the people providing liquidity. Toxic flow either pays more or goes
          somewhere else, and both outcomes suit an LP.
        </p>

        {v ? (
          <div className={styles.stats}>
            <Stat label="Tolls charged" value={Number(v.tolls).toLocaleString()} />
            <Stat label="Addresses seen" value={Number(v.tradersSeen).toLocaleString()} />
            {v.tollsByTier.map((n, i) => (
              <Stat key={i} label={tierOf(i).name} value={Number(n).toLocaleString()} tone={i} />
            ))}
          </div>
        ) : (
          <p className={table.empty}>Nothing indexed yet.</p>
        )}
      </section>

      <section className="section">
        <p className="eyebrow">Fee schedule</p>
        <h2 className="display h3">What each tier pays</h2>
        <table className={table.table}>
          <thead>
            <tr><th>Tier</th><th>Meaning</th><th className={table.right}>Fee</th></tr>
          </thead>
          <tbody>
            {TIERS.map((t, i) => (
              <tr key={t.name}>
                <td><span className={`${table.badge} ${table[`t${i}`]}`}>{t.name}</span></td>
                <td>{MEANING[i]}</td>
                <td className={table.right}>{t.fee}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="section">
        <p className="eyebrow">Protected</p>
        <h2 className="display h3">Addresses that can never be priced up</h2>
        <p className="lede">
          Many unrelated people trade through these, so charging them would charge everyone
          behind them. They stay on the default tier no matter what their traffic looks like.
        </p>
        <table className={table.table}>
          <thead>
            <tr><th>Address</th><th className={table.right}>Originators</th><th className={table.right}>Swaps</th></tr>
          </thead>
          <tbody>
            {shared.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/address/${r.id}`} className={table.link}>{r.id}</Link></td>
                <td className={table.right}>{Number(r.originators).toLocaleString()}</td>
                <td className={table.right}>{Number(r.swaps).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="lede" style={{ marginTop: "var(--s5)", fontSize: 13 }}>
          Measured over blocks {scan.fromBlock.toLocaleString()}–{scan.toBlock.toLocaleString()}{" "}
          on Ethereum mainnet.
        </p>
      </section>
    </main>
  );
}

const MEANING = [
  "Enough history, no extraction found",
  "Nobody has judged it yet | the default",
  "Some extraction signal",
  "Repeatedly opened and closed around other trades",
];

function Stat({ label, value, tone }: { label: string; value: string; tone?: number }) {
  return (
    <div className={styles.stat}>
      <p className="eyebrow">{label}</p>
      <p className={`${styles.value} ${tone !== undefined ? table[`t${tone}`] : ""}`}>{value}</p>
    </div>
  );
}
