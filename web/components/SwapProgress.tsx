"use client";

import { CHAIN } from "@/lib/chain";
import { tier as tierOf } from "@/lib/tiers";
import styles from "./SwapProgress.module.css";

export type Phase = "idle" | "signing" | "confirming" | "mining" | "done" | "failed";

export interface Settled {
  tier: number;
  fee: number;
  payer: string;
  nonce: number | null;
  received: number | null;
  hash: string;
}

const TONE = ["var(--success)", "var(--fg-muted)", "var(--warning)", "var(--danger)"];
const TONE_SOFT = [
  "rgba(116, 199, 154, 0.1)",
  "rgba(220, 220, 227, 0.05)",
  "rgba(224, 164, 88, 0.1)",
  "rgba(226, 98, 76, 0.1)",
];
const TONE_LINE = [
  "rgba(116, 199, 154, 0.28)",
  "rgba(220, 220, 227, 0.1)",
  "rgba(224, 164, 88, 0.28)",
  "rgba(226, 98, 76, 0.28)",
];

const ORDER: Phase[] = ["signing", "confirming", "mining", "done"];

/** Everyone behind a shared router is priced at this, because the router has no history. */
const BASELINE = 3000;

/** Each line is something that actually happens, in the order it happens. */
const STEPS: { phase: Phase; live: string; done: string }[] = [
  { phase: "signing", live: "Signing your attestation", done: "Attestation signed" },
  { phase: "confirming", live: "Confirm in your wallet", done: "Transaction sent" },
  { phase: "mining", live: "Waiting for the block", done: "Included in a block" },
];

export function SwapProgress({
  phase,
  failedAt,
  settled,
  error,
  signed,
  symbol,
  onClose,
}: {
  phase: Phase;
  failedAt: Phase | null;
  settled: Settled | null;
  error: string | null;
  signed: boolean;
  symbol: string;
  onClose: () => void;
}) {
  // A failure stops the run where it was, so steps that already finished stay finished.
  const at = phase === "failed" ? ORDER.indexOf(failedAt ?? "signing") : ORDER.indexOf(phase);
  const state = (p: Phase) => {
    const i = ORDER.indexOf(p);
    if (i < at) return "done";
    if (i > at) return "idle";
    return phase === "failed" ? "failed" : "live";
  };

  const t = settled ? Math.min(Math.max(settled.tier, 0), 3) : 1;
  // What the same trade would have returned at the router's price. The fee comes off the
  // input, so the ratio of the two fees is the ratio of the two outputs.
  const saved =
    settled && settled.received !== null && settled.fee < BASELINE
      ? settled.received - (settled.received * (1 - BASELINE / 1e6)) / (1 - settled.fee / 1e6)
      : null;
  const steps = signed ? STEPS : STEPS.filter((s) => s.phase !== "signing");

  return (
    <div className={styles.scrim} data-open={phase !== "idle"} role="dialog" aria-modal="true">
      <div className={styles.card}>
        <div className={styles.head}>
          <span className={styles.title}>
            {phase === "done" ? "Swapped" : phase === "failed" ? "Did not go through" : "Swapping"}
          </span>
          <span className={styles.sub}>uniswap v4 · gantry pool</span>
        </div>

        <div className={styles.steps} data-settled={phase === "done"}>
          {steps.map((s) => (
            <div className={styles.step} data-state={state(s.phase)} key={s.phase}>
              <span className={styles.mark} />
              {state(s.phase) === "done" ? s.done : s.live}
            </div>
          ))}
        </div>

        {settled ? (
          <div
            className={styles.inside}
            data-shown={phase === "done"}
            style={{
              ["--tone" as string]: TONE[t],
              ["--tone-soft" as string]: TONE_SOFT[t],
              ["--tone-line" as string]: TONE_LINE[t],
            }}
          >
            <span className={styles.insideLabel}>Inside that one transaction</span>
            {settled.nonce !== null ? (
              <span className={styles.fact}>
                <span>Attestation spent</span>
                <b>nonce {settled.nonce}</b>
              </span>
            ) : null}
            <span className={styles.fact}>
              <span>Hook priced</span>
              <b>{settled.payer.slice(0, 6)}…{settled.payer.slice(-4)}</b>
            </span>
            <span className={styles.fact}>
              <span>Tier read from the oracle</span>
              <b data-tone>{settled.tier} · {tierOf(settled.tier).name}</b>
            </span>
            <span className={styles.fact}>
              <span>Fee returned to the pool</span>
              <b data-tone>{(settled.fee / 10_000).toFixed(2)}%</b>
            </span>
          </div>
        ) : null}

        {phase === "done" && settled?.received !== null && settled ? (
          <div className={styles.result}>
            <span className={styles.resultLabel}>You received</span>
            <span className={styles.resultBig}>
              {settled.received.toFixed(4)}
              <em>{symbol}</em>
            </span>
            {saved !== null ? (
              <span className={styles.saved}>
                +{saved.toFixed(2)} {symbol} against the {(BASELINE / 10_000).toFixed(2)}% a shared router pays
              </span>
            ) : null}
          </div>
        ) : null}

        {error ? <p className={styles.err}>{error}</p> : null}

        {phase === "done" || phase === "failed" ? (
          <div className={styles.actions} data-one={settled ? undefined : "true"}>
            {settled ? (
              <a
                className={styles.secondary}
                href={`${CHAIN.blockExplorers?.default.url}/tx/${settled.hash}`}
                target="_blank"
                rel="noreferrer"
              >
                View on Etherscan
              </a>
            ) : null}
            <button className={styles.primary} onClick={onClose}>Done</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
