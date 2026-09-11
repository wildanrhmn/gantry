import { VerdictSign } from "./VerdictSign";
import { EvidenceTable } from "./EvidenceTable";
import type { Lookup } from "@/lib/tiers";
import styles from "./Verdict.module.css";

/** The whole answer for one address: the sign, why it is protected, and what was measured. */
export function Verdict({ result }: { result: Lookup }) {
  return (
    <>
      <div className={styles.head}>
        <span className={styles.address}>{result.address}</span>
        <span className="eyebrow">
          {result.scored ? "scored from mainnet history" : "no history in this scan"}
        </span>
      </div>

      <VerdictSign tier={result.tier} />

      {result.sharedInfrastructure ? (
        <p className={styles.notice}>
          Many unrelated people trade through this address, so it is never priced punitively.
          Charging a router charges every trader behind it. The people using it can sign an
          attestation to be priced as themselves.
        </p>
      ) : null}

      {!result.scored ? (
        <p className={styles.notice}>
          This address did not trade in the scanned window, so it lands on the default tier.
          Unknown is not the same as clean | nobody has judged it.
        </p>
      ) : null}

      <EvidenceTable result={result} />
    </>
  );
}
