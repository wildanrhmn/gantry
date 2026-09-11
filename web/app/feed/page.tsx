import Link from "next/link";
import { recentTolls } from "@/lib/subgraph";
import { tier as tierOf } from "@/lib/tiers";
import table from "@/components/Table.module.css";

export const revalidate = 10;
export const metadata = { title: "Feed | Gantry" };

export default async function FeedPage() {
  const data = await recentTolls(50);
  const tolls = data?.tolls ?? [];

  return (
    <main className="page">
      <section className="section">
        <p className="eyebrow">Live feed</p>
        <h1 className="display h3">Tolls as they are charged</h1>
        <p className="lede">
          Every swap through a Gantry pool on Sepolia, and what it paid. Read from the subgraph.
        </p>

        {tolls.length === 0 ? (
          <p className={table.empty}>No tolls indexed yet. The feed fills as swaps arrive.</p>
        ) : (
          <table className={table.table}>
            <thead>
              <tr>
                <th>Payer</th>
                <th>Tier</th>
                <th className={table.right}>Fee</th>
              </tr>
            </thead>
            <tbody>
              {tolls.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link href={`/address/${t.trader.id}`} className={table.link}>{t.trader.id}</Link>
                    <span className={table.note}>
                      block {Number(t.blockNumber).toLocaleString()} ·{" "}
                      <a href={`https://sepolia.etherscan.io/tx/${t.transactionHash}`} target="_blank"
                        rel="noreferrer" className={table.link}>tx</a>
                    </span>
                  </td>
                  <td>
                    <span className={`${table.badge} ${table[`t${t.tier}`]}`}>{tierOf(t.tier).name}</span>
                  </td>
                  <td className={table.right}>{(t.fee / 10_000).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
