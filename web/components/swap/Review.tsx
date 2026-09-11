"use client";

import { tier as tierOf } from "@/lib/tiers";
import { Modal } from "./Modal";
import { BASELINE, gainOverRouter, pct, short, toneVars, type Review as Data } from "./shared";
import styles from "./Review.module.css";

export function Review({
  open,
  behind,
  data,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  behind: boolean;
  data: Data | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!data) return null;
  const gain = gainOverRouter(data.quote, data.fee);

  return (
    <Modal open={open} level={1} behind={behind} style={toneVars(data.tier)}>
      <div className={styles.head}>
        <span className={styles.title}>Review swap</span>
        <span className={styles.sub}>uniswap v4 · gantry pool</span>
      </div>

      <div className={styles.trade}>
        <div className={styles.side}>
          <div className={styles.sideText}>
            <span className={styles.sideLabel}>You pay</span>
            <span className={styles.sideAmount}>
              {data.amountIn.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </span>
          </div>
          <span className={styles.pill}>
            <img src={data.sellIcon} alt="" width={24} height={24} />
            {data.sellSymbol}
          </span>
        </div>

        <div className={styles.seam}>
          <span className={styles.seamNode}>&darr;</span>
        </div>

        <div className={styles.side}>
          <div className={styles.sideText}>
            <span className={styles.sideLabel}>You receive, before gas</span>
            <span className={styles.sideAmount} data-big>
              {data.quote !== null ? data.quote.toFixed(4) : "—"}
            </span>
          </div>
          <span className={styles.pill}>
            <img src={data.buyIcon} alt="" width={24} height={24} />
            {data.buySymbol}
          </span>
        </div>
      </div>

      {/* the fee is the product, so it is stated rather than buried in a table */}
      <div className={styles.seal}>
        <div className={styles.sealTop}>
          <span className={styles.sealTier}>
            <span className={styles.sealDot} />
            Tier {data.tier} · {tierOf(data.tier).name}
          </span>
          <span className={styles.sealFee}>{pct(data.fee)}</span>
        </div>
        <p className={styles.sealWhy}>
          Read from the oracle for{" "}
          <b>{data.address ? short(data.address) : "your address"}</b>, not for the router that
          carries the swap.
        </p>
      </div>

      <p className={styles.gain}>
        {gain !== null ? (
          <span className={styles.saved}>
            <span className={styles.savedArrow}>&uarr;</span>
            {gain.toFixed(2)} {data.buySymbol} more than the {pct(BASELINE)} router price
          </span>
        ) : (
          /* an address priced above the router deserves to be told so */
          <span className={styles.saved} data-over="true">
            {data.fee > BASELINE
              ? `priced above the ${pct(BASELINE)} router price`
              : `the same as the ${pct(BASELINE)} router price`}
          </span>
        )}
      </p>

      {/* the signature is what lets the hook look past the router, and it costs nothing */}
      <p className={styles.foot}>One off chain signature, free, is included when you confirm.</p>

      <div className={styles.actions}>
        <button className={styles.secondary} onClick={onCancel}>Cancel</button>
        <button className={styles.primary} onClick={onConfirm}>Confirm swap</button>
      </div>
    </Modal>
  );
}
