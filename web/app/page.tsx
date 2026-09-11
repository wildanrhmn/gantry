import { Lookup } from "@/components/Lookup";
import { recentTolls, venue } from "@/lib/subgraph";
import { tier as tierOf } from "@/lib/tiers";
import styles from "@/components/Lookup.module.css";

export const revalidate = 10;

const GANTRY = "0x42A5B912625E0b9Aba3286CEfA3BB823DDAE0080";
const ORACLE = "0x846d3eF24c3c6e079Bd95cFeACC08B21427C9132";

export default async function Home() {
  const [tolls, stats] = await Promise.all([recentTolls(12), venue()]);
  const v = stats?.venues?.[0];

  return (
    <main className={styles.page}>
      <Lookup />

      <section className={styles.section}>
        <p className="eyebrow">Live feed</p>
        <h2 className={`display ${styles.h3}`}>Tolls as they are charged</h2>
        <p className={styles.lede}>
          Every swap through the Gantry pool on Sepolia, and what it paid.
        </p>

        {tolls?.tolls?.length ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Payer</th>
                <th>Tier</th>
                <th style={{ textAlign: "right" }}>Fee</th>
              </tr>
            </thead>
            <tbody>
              {tolls.tolls.map((t) => (
                <tr key={t.id}>
                  <td>
                    {t.trader.id}
                    <span className={styles.note}>block {Number(t.blockNumber).toLocaleString()}</span>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${styles[`t${t.tier}`]}`}>
                      {tierOf(t.tier).name}
                    </span>
                  </td>
                  <td>{(t.fee / 10_000).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className={styles.lede} style={{ marginTop: "var(--s6)" }}>
            No tolls indexed yet. The feed fills as swaps arrive.
          </p>
        )}
      </section>

      {v ? (
        <section className={styles.section}>
          <p className="eyebrow">The venue</p>
          <h2 className={`display ${styles.h3}`}>Where the traffic sits</h2>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <p className="eyebrow">Tolls charged</p>
              <p className={styles.statValue}>{Number(v.tolls).toLocaleString()}</p>
            </div>
            <div className={styles.stat}>
              <p className="eyebrow">Addresses seen</p>
              <p className={styles.statValue}>{Number(v.tradersSeen).toLocaleString()}</p>
            </div>
            {v.tollsByTier.map((n, i) => (
              <div className={styles.stat} key={i}>
                <p className="eyebrow">{tierOf(i).name}</p>
                <p className={`${styles.statValue} ${styles[`t${i}`]}`}>{Number(n).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <footer className={styles.foot}>
        <p>
          Hook{" "}
          <a href={`https://sepolia.etherscan.io/address/${GANTRY}`} target="_blank" rel="noreferrer">
            {GANTRY}
          </a>{" "}
          · Oracle{" "}
          <a href={`https://sepolia.etherscan.io/address/${ORACLE}`} target="_blank" rel="noreferrer">
            {ORACLE}
          </a>
        </p>
        <p style={{ marginTop: "var(--s2)" }}>
          Behaviour read from Ethereum mainnet. Tiers enforced on Sepolia. Nobody is ever blocked
          from trading — the fee changes, not the access.
        </p>
      </footer>
    </main>
  );
}
