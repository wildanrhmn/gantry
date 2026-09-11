"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { LookupField } from "@/components/LookupField";
import { ScanLane, type LaneCar } from "@/components/landing/ScanLane";
import { gsap, ScrollTrigger, SplitText, reducedMotion } from "@/lib/motion";
import styles from "./Hero.module.css";

export interface HeroScan {
  swaps: number;
  sandwiches: number;
  addresses: number;
  toBlock: number;
  live: boolean;
}

const STATS = [
  { key: "swaps", label: "swaps read" },
  { key: "sandwiches", label: "sandwiches found" },
  { key: "addresses", label: "addresses scored" },
  { key: "toBlock", label: "indexed to block" },
] as const;

export function Hero({ scan, cars }: { scan: HeroScan; cars: LaneCar[] }) {
  const root = useRef<HTMLElement>(null);
  const title = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (reducedMotion()) {
      gsap.set(el.querySelectorAll("[data-reveal]"), { opacity: 1, y: 0 });
      return;
    }

    const ctx = gsap.context(() => {
      const intro = gsap.timeline({ defaults: { ease: "expo.out" } });

      // splitting before the webfont lands measures the fallback and breaks the lines
      document.fonts.ready.then(() => {
        if (!title.current) return;
        const split = SplitText.create(title.current, { type: "lines,words", mask: "lines" });
        intro.from(
          split.words,
          { yPercent: 118, duration: 1.1, stagger: 0.042 },
          0.1,
        );
      });

      intro
        .from("[data-reveal='badge']", { opacity: 0, y: -14, duration: 0.7 }, 0)
        .from("[data-reveal='lede']", { opacity: 0, y: 22, duration: 0.9 }, 0.5)
        .from("[data-reveal='actions']", { opacity: 0, y: 22, duration: 0.9 }, 0.62)
        .from("[data-reveal='ticker']", { opacity: 0, y: 18, duration: 0.9 }, 0.72)
        .from("[data-reveal='lane']", { opacity: 0, duration: 1.2 }, 0.35);

      // counters settle on the real figure rather than arriving at it
      STATS.forEach(({ key }) => {
        const node = el.querySelector<HTMLElement>(`[data-count='${key}']`);
        if (!node) return;
        const target = scan[key];
        const proxy = { n: 0 };
        intro.to(
          proxy,
          {
            n: target,
            duration: 1.6,
            ease: "power2.out",
            onUpdate: () => (node.textContent = Math.round(proxy.n).toLocaleString("en-US")),
          },
          0.7,
        );
      });

      // the headline drifts up as you leave, so the lane becomes the subject
      gsap.to("[data-parallax]", {
        yPercent: -18,
        opacity: 0.25,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top top", end: "bottom top", scrub: 0.6 },
      });
    }, el);

    return () => ctx.revert();
  }, [scan]);

  return (
    <section className={styles.hero} ref={root}>
      <div className={styles.horizon} />
      <div className={styles.glow} />

      <div className={styles.inner} data-parallax>
        <span className={styles.badge} data-reveal="badge">
          <span className={styles.pulse} data-live={scan.live} />
          {scan.live ? (
            <>
              live<span className={styles.wide}> · ethereum mainnet</span> · block{" "}
              {scan.toBlock.toLocaleString()}
            </>
          ) : (
            "indexer offline"
          )}
        </span>

        <h1 className={styles.title} ref={title}>
          <span>Every swap</span>
          <span>gets read</span>
          <em>as it passes</em>
        </h1>

        <p className={styles.lede} data-reveal="lede">
          A Uniswap v4 hook that prices each swap by the caller&apos;s on-chain behaviour.
          Sandwich bots pay <strong>1.00%</strong>. Clean addresses pay <strong>0.05%</strong>.
          The difference goes to the pool&apos;s LPs, and <strong>nobody is ever blocked</strong>.
        </p>

        <div className={styles.actions} data-reveal="actions">
          <div className={styles.lookup}>
            <LookupField
              trailing={
                <Link href="/swap" className={styles.swapLink}>
                  Swap against it →
                </Link>
              }
            />
          </div>
        </div>
      </div>

      <div className={styles.ticker} data-reveal="ticker">
        {STATS.map(({ key, label }) => (
          <div className={styles.stat} key={key}>
            <span className={styles.statValue} data-count={key}>0</span>
            <span className={styles.statLabel}>{label}</span>
          </div>
        ))}
      </div>

      <div data-reveal="lane">
        <ScanLane cars={cars} />
      </div>
    </section>
  );
}
