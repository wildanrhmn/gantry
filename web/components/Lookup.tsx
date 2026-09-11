"use client";

import { useState } from "react";
import { VerdictSign } from "./VerdictSign";
import { isAddress, type Lookup as Result } from "@/lib/tiers";
import styles from "./Lookup.module.css";

// Two addresses worth trying, both from the mainnet scan the dataset was built from.
const EXAMPLES = [
  { address: "0x76f30e3f75437fb862b8d2c4d80a671bceba5b1a", label: "a repeat sandwicher" },
  { address: "0x66a9893cc07d91d95644aedd05d03f95e1dba8af", label: "Uniswap's router" },
];

export function Lookup() {
  const [value, setValue] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(address: string) {
    const trimmed = address.trim();
    if (!isAddress(trimmed)) {
      setError("That is not an address. It needs 0x and 40 hex characters.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/lookup/${trimmed}`);
      if (!res.ok) {
        setError("Could not read that address. Try again.");
        return;
      }
      setResult((await res.json()) as Result);
    } catch {
      setError("Could not reach the readout. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className={styles.hero}>
        <div className={styles.mark}>
          <span className={styles.wordmark}>GANTRY</span>
          <span className={styles.tagline}>every swap gets read as it passes</span>
        </div>

        <form
          className={styles.field}
          onSubmit={(e) => {
            e.preventDefault();
            void run(value);
          }}
        >
          <input
            className={styles.input}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Paste an address"
            aria-label="Address to look up"
            spellCheck={false}
            autoComplete="off"
          />
          <button className={styles.go} type="submit" disabled={busy}>
            {busy ? "Reading" : "Look up"}
          </button>
        </form>

        {error ? <p className={styles.error}>{error}</p> : null}

        <p className={styles.hint}>
          Try{" "}
          {EXAMPLES.map((e, i) => (
            <span key={e.address}>
              {i > 0 ? " or " : ""}
              <button
                type="button"
                onClick={() => {
                  setValue(e.address);
                  void run(e.address);
                }}
              >
                {e.label}
              </button>
            </span>
          ))}
          .
        </p>
      </section>

      <section className={styles.result}>
        {result ? (
          <div className={styles.resultHead}>
            <span className={styles.address}>{result.address}</span>
            <span className="eyebrow">
              {result.scored ? "scored from mainnet history" : "no history in this scan"}
            </span>
          </div>
        ) : null}

        <VerdictSign tier={result?.tier ?? null} pending={busy} />

        {result?.sharedInfrastructure ? (
          <p className={styles.notice}>
            Many unrelated people trade through this address, so it is never priced punitively.
            Charging a router charges every trader behind it. The people using it can sign an
            attestation to be priced as themselves.
          </p>
        ) : null}

        {result && !result.scored ? (
          <p className={styles.notice}>
            This address did not trade in the scanned window, so it lands on the default tier.
            Unknown is not the same as clean — nobody has judged it.
          </p>
        ) : null}

        {result && result.observations.length > 0 ? (
          <>
            <h2 className={`display ${styles.h3}`} style={{ marginTop: "var(--s12)" }}>
              What was measured
            </h2>
            <p className={styles.lede}>
              Observations, not conclusions. Blocks {result.source.fromBlock.toLocaleString()}–
              {result.source.toBlock.toLocaleString()} on Ethereum mainnet.
            </p>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Observation</th>
                  <th style={{ textAlign: "right" }}>Value</th>
                </tr>
              </thead>
              <tbody>
                {result.observations.map((o) => (
                  <tr key={o.label}>
                    <td>
                      {o.label}
                      {o.note ? <span className={styles.note}>{o.note}</span> : null}
                    </td>
                    <td>{o.value}</td>
                  </tr>
                ))}
                {result.poolSwaps !== null ? (
                  <tr>
                    <td>
                      Swaps through the Gantry pool
                      <span className={styles.note}>on Sepolia, priced by this hook</span>
                    </td>
                    <td>{result.poolSwaps.toLocaleString()}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </>
        ) : null}
      </section>
    </>
  );
}
