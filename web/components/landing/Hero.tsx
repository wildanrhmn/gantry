"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { SwapCard, type LaneCar } from "@/components/landing/SwapCard";
import { gsap, ScrollTrigger, SplitText, reducedMotion } from "@/lib/motion";
import styles from "./Hero.module.css";

export interface HeroStats {
  swaps: number;
  sandwiches: number;
  reverted: number;
}

const count = (v: number) => v.toLocaleString("en-US");

export function Hero({ cars, stats }: { cars: LaneCar[]; stats: HeroStats }) {
  const root = useRef<HTMLElement>(null);
  const title = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (reducedMotion()) return;

    const ctx = gsap.context(() => {
      const intro = gsap.timeline({ defaults: { ease: "expo.out" } });

      // splitting before the webfont lands measures the fallback and breaks the lines
      document.fonts.ready.then(() => {
        if (!title.current) return;
        const split = SplitText.create(title.current, { type: "lines", mask: "lines" });
        intro.from(
          split.lines,
          { yPercent: 112, duration: 1, stagger: 0.08, onComplete: () => split.revert() },
          0.06,
        );
      });

      intro
        .from("[data-in='eyebrow']", { opacity: 0, x: -14, duration: 0.7 }, 0)
        .from("[data-in='lede']", { opacity: 0, y: 16, duration: 0.8 }, 0.4)
        .from("[data-in='ctas']", { opacity: 0, y: 16, duration: 0.8 }, 0.5)
        .from("[data-in='stats']", { opacity: 0, y: 16, duration: 0.8 }, 0.58)
        // the product arrives from its own side rather than rising with the copy
        .from("[data-in='product']", { opacity: 0, x: 48, duration: 1.2 }, 0.3);

      gsap.to("[data-parallax]", {
        yPercent: -8,
        opacity: 0.35,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top top", end: "bottom top", scrub: 0.6 },
      });
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section className={styles.hero} ref={root}>
      <div className={styles.rules} />
      <div className={styles.aura} />

      <div className={styles.inner} data-parallax>
        <div>
          <span className={styles.eyebrow} data-in="eyebrow">Uniswap v4 hook</span>

          <h1 className={styles.title} ref={title}>
            <span>Sandwich bots</span>
            <span>pay <em>20&times; more</em></span>
            <span>than you do</span>
          </h1>

          <p className={styles.lede} data-in="lede">
            A Uniswap v4 hook that prices each swap by the caller&apos;s behaviour. Nobody is
            ever blocked.
          </p>

          <div className={styles.ctas} data-in="ctas">
            <Link href="/swap" className={styles.primary}>Swap now</Link>
            <Link href="/lookup" className={styles.secondary}>Look up an address</Link>
          </div>

          <div className={styles.stats} data-in="stats">
            <span>
              <span className={styles.statValue}>{count(stats.swaps)}</span>
              <span className={styles.statLabel}>swaps read</span>
            </span>
            <span>
              <span className={styles.statValue}>{count(stats.sandwiches)}</span>
              <span className={styles.statLabel}>sandwiches found</span>
            </span>
            <span>
              <span className={styles.statValue}>{count(stats.reverted)}</span>
              <span className={styles.statLabel}>reverted attempts</span>
            </span>
          </div>
        </div>

        <div className={styles.product} data-in="product">
          <SwapCard cars={cars} />
        </div>
      </div>
    </section>
  );
}
