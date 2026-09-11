"use client";

import { useEffect, useRef } from "react";
import { ScanLane, type LaneCar } from "@/components/landing/ScanLane";
import { gsap, ScrollTrigger, reducedMotion } from "@/lib/motion";
import styles from "./ScanBand.module.css";

export interface ScanStats {
  swaps: number;
  sandwiches: number;
  addresses: number;
  toBlock: number;
}

const STATS = [
  { key: "swaps", label: "swaps read" },
  { key: "sandwiches", label: "sandwiches found" },
  { key: "addresses", label: "addresses scored" },
  { key: "toBlock", label: "indexed to block" },
] as const;

export function ScanBand({ stats, cars }: { stats: ScanStats; cars: LaneCar[] }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;

    const write = (node: HTMLElement, n: number) => (node.textContent = n.toLocaleString("en-US"));
    if (reducedMotion()) {
      STATS.forEach(({ key }) => {
        const node = el.querySelector<HTMLElement>(`[data-count='${key}']`);
        if (node) write(node, stats[key]);
      });
      return;
    }

    // the figures run up once the band is on screen, not while it is still below
    const ctx = gsap.context(() => {
      STATS.forEach(({ key }) => {
        const node = el.querySelector<HTMLElement>(`[data-count='${key}']`);
        if (!node) return;
        const proxy = { n: 0 };
        gsap.to(proxy, {
          n: stats[key],
          duration: 1.6,
          ease: "power2.out",
          onUpdate: () => write(node, Math.round(proxy.n)),
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        });
      });
    }, el);

    return () => ctx.revert();
  }, [stats]);

  return (
    <div className={styles.band} ref={root}>
      <div className={styles.ticker}>
        {STATS.map(({ key, label }) => (
          <div className={styles.stat} key={key}>
            <span className={styles.statValue} data-count={key}>0</span>
            <span className={styles.statLabel}>{label}</span>
          </div>
        ))}
      </div>
      <p className={styles.caption}>
        Traffic through Uniswap v4 on Ethereum mainnet, read as it passes. The sign shows the
        verdict for whichever address is under the sensor.
      </p>
      <ScanLane cars={cars} />
    </div>
  );
}
