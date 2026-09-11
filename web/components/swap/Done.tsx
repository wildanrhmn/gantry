"use client";

import { CHAIN } from "@/lib/chain";
import { tier as tierOf } from "@/lib/tiers";
import { Modal } from "./Modal";
import { BASELINE, gainOverRouter, pct, short, toneVars, type Review, type Settled } from "./shared";
import styles from "./Done.module.css";

export function Done({
  open,
  data,
  settled,
  onClose,
}: {
  open: boolean;
  data: Review | null;
  settled: Settled | null;
  onClose: () => void;
}) {
  if (!settled || !data) return null;
  const gain = gainOverRouter(settled.received, settled.fee);

  return (
    <Modal open={open} level={3} style={toneVars(settled.tier)}>
      <div className={styles.crest}>
        <svg viewBox="0 0 44 44" className={styles.tick} aria-hidden="true">
          <circle cx="22" cy="22" r="20" fill="none" stroke="var(--tone)" strokeOpacity="0.35" strokeWidth="1.5" />
          <path
            d="M13 22.5 L19.5 29 L31 17"
            fill="none"
            stroke="var(--tone)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <h2 className={styles.title}>Swap complete</h2>
      <p className={styles.lede}>Your address paid its own toll.</p>

      <div className={styles.amount}>
        <span className={styles.amountBig}>
          {settled.received !== null ? settled.received.toFixed(4) : "—"}
        </span>
        <span className={styles.amountUnit}>{data.buySymbol}</span>
      </div>
      {gain !== null ? (
        <p className={styles.gain}>
          <span className={styles.saved}>
            <span className={styles.savedArrow}>&uarr;</span>
            {gain.toFixed(2)} {data.buySymbol} more than the {pct(BASELINE)} router price
          </span>
        </p>
      ) : null}

      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt>Paid</dt>
          <dd>
            {data.amountIn.toLocaleString(undefined, { maximumFractionDigits: 4 })} {data.sellSymbol}
          </dd>
        </div>
        <div className={styles.fact}>
          <dt>Fee charged</dt>
          <dd data-tone>{pct(settled.fee)} · tier {settled.tier} {tierOf(settled.tier).name}</dd>
        </div>
        <div className={styles.fact}>
          <dt>Priced on</dt>
          <dd>{settled.payer ? short(settled.payer) : "your address"}</dd>
        </div>
        {settled.nonce !== null ? (
          <div className={styles.fact}>
            <dt>Attestation spent</dt>
            <dd>nonce {settled.nonce}</dd>
          </div>
        ) : null}
        <div className={styles.fact}>
          <dt>Transaction</dt>
          <dd>{short(settled.hash)}</dd>
        </div>
      </dl>

      <div className={styles.actions}>
        <a
          className={styles.secondary}
          href={`${CHAIN.blockExplorers?.default.url}/tx/${settled.hash}`}
          target="_blank"
          rel="noreferrer"
        >
          View on Etherscan
        </a>
        <button className={styles.primary} onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}
