import type { Lookup } from "@/lib/tiers";
import styles from "./Table.module.css";

/** Observations, never conclusions. This is what makes a tier contestable. */
export function EvidenceTable({ result }: { result: Lookup }) {
  if (result.observations.length === 0) return null;

  return (
    <>
      <h2 className="display h3" style={{ marginTop: "var(--s12)" }}>What was measured</h2>
      <p className="lede">
        Observations, not conclusions. Blocks {result.source.fromBlock.toLocaleString()}–
        {result.source.toBlock.toLocaleString()} on Ethereum mainnet, read from the subgraph
        at request time.
      </p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Observation</th>
            <th className={styles.right}>Value</th>
          </tr>
        </thead>
        <tbody>
          {result.observations.map((o) => (
            <tr key={o.label}>
              <td>
                {o.label}
                {o.note ? <span className={styles.note}>{o.note}</span> : null}
              </td>
              <td className={styles.right}>{o.value}</td>
            </tr>
          ))}
          {result.poolSwaps !== null ? (
            <tr>
              <td>
                Swaps through the Gantry pool
                <span className={styles.note}>on Sepolia, priced by this hook</span>
              </td>
              <td className={styles.right}>{result.poolSwaps.toLocaleString()}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </>
  );
}
