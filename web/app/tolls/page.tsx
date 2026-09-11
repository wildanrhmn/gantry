import Link from "next/link";
import { CHAIN } from "@/lib/chain";
import { recentTolls, venue } from "@/lib/subgraph";
import { TIERS, tier as tierOf } from "@/lib/tiers";
import { toneVars } from "@/components/swap/shared";
import styles from "./tolls.module.css";

export const revalidate = 10;
export const metadata = {
  title: "Tolls | Gantry",
  description: "Every swap this pool has priced, and what each one was charged.",
};

const ago = (seconds: number) => {
  const d = Math.max(0, Math.floor(Date.now() / 1000) - seconds);
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
};

const short = (a: string) => `${a.slice(0, 10)}…${a.slice(-8)}`;

export default async function TollsPage() {
  const [data, v] = await Promise.all([recentTolls(60), venue()]);
  const tolls = data?.tolls ?? [];
  const row = v?.venues?.[0];
  const byTier = TIERS.map((_, i) => Number(row?.tollsByTier?.[i] ?? 0));
  const charged = byTier.reduce((a, b) => a + b, 0);

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.head}>
          <span className={styles.kicker}>
            <span className={styles.pulse} />
            Live
          </span>
          <h1 className={styles.title}>Every toll this pool has charged</h1>
          <p className={styles.body}>
            One pool, one hook, four prices. Each row is a real swap on Sepolia and the fee its
            caller was charged for being that address.
          </p>
        </header>

        {charged > 0 ? (
          <section className={styles.split}>
            <div className={styles.splitTop}>
              <span className={styles.splitLabel}>How the tolls split</span>
              <span className={styles.splitTotal}>
                {charged.toLocaleString()} charged · {Number(row?.tradersSeen ?? 0).toLocaleString()}{" "}
                addresses
              </span>
            </div>

            {/* the distribution is the argument: one venue pricing four ways at once */}
            <div className={styles.bar}>
              {byTier.map((n, i) =>
                n > 0 ? (
                  <span
                    key={i}
                    className={styles.seg}
                    style={{ ...toneVars(i), flexGrow: n }}
                    title={`${tierOf(i).name}: ${n}`}
                  />
                ) : null,
              )}
            </div>

            <div className={styles.legend}>
              {TIERS.map((t, i) => (
                <div className={styles.key} key={t.name} style={toneVars(i)} data-off={byTier[i] === 0 || undefined}>
                  <span className={styles.keyDot} />
                  <span className={styles.keyName}>{t.name}</span>
                  <span className={styles.keyFee}>{t.fee}</span>
                  <span className={styles.keyCount}>{byTier[i].toLocaleString()}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className={styles.feed}>
          {tolls.length === 0 ? (
            <p className={styles.empty}>
              No tolls indexed yet. The first swap through the pool lands here.
            </p>
          ) : (
            <ul className={styles.list}>
              {tolls.map((t, i) => (
                <li
                  className={styles.row}
                  key={t.id}
                  style={{ ...toneVars(t.tier), animationDelay: `${Math.min(i, 14) * 40}ms` }}
                >
                  {/* any payer opens straight into its own verdict */}
                  <Link className={styles.payer} href={`/lookup?a=${t.trader.id}`}>
                    {short(t.trader.id)}
                  </Link>

                  <span className={styles.chip}>
                    <span className={styles.dot} />
                    {tierOf(t.tier).name}
                  </span>

                  <span className={styles.fee}>{(t.fee / 10_000).toFixed(2)}%</span>

                  <span className={styles.when}>{ago(Number(t.timestamp))}</span>

                  <a
                    className={styles.tx}
                    href={`${CHAIN.blockExplorers?.default.url}/tx/${t.transactionHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    tx &#8599;
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
