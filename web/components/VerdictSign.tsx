"use client";

import { useEffect, useState } from "react";
import { tier as tierOf, type Tier } from "@/lib/tiers";
import styles from "./VerdictSign.module.css";

/** A real gantry carries a panel that flips when conditions change. This is that panel. */
export function VerdictSign({ tier, pending }: { tier: Tier | null; pending?: boolean }) {
  const [shown, setShown] = useState<Tier | null>(tier);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (tier === null) return;
    setShown(tier);
    setKey((k) => k + 1);
  }, [tier]);

  if (shown === null) {
    return (
      <div className={`${styles.sign} ${styles.empty}`}>
        <p className={styles.waiting}>Waiting for an address</p>
      </div>
    );
  }

  const t = tierOf(shown);

  return (
    <div className={`${styles.sign} ${styles[t.token]}`} aria-live="polite" data-pending={pending}>
      <div>
        <p className={styles.label}>Tier {shown}</p>
        <p className={styles.name} key={`n${key}`}>
          {[...t.name.toUpperCase()].map((char, i) => (
            <span key={i} style={{ animationDelay: `${i * 26}ms` }}>
              {char}
            </span>
          ))}
        </p>
      </div>
      <p className={styles.fee} key={`f${key}`}>
        {[...t.fee].map((char, i) => (
          <span key={i} style={{ animationDelay: `${120 + i * 26}ms` }}>
            {char}
          </span>
        ))}
      </p>
    </div>
  );
}
