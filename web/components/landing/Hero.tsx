"use client";

import { useEffect, useRef } from "react";
import { LookupField } from "@/components/LookupField";
import { SwapCard } from "@/components/landing/SwapCard";
import type { LaneCar } from "@/components/landing/ScanLane";
import { gsap, ScrollTrigger, SplitText, reducedMotion } from "@/lib/motion";
import styles from "./Hero.module.css";

export function Hero({ block, live, cars }: { block: number; live: boolean; cars: LaneCar[] }) {
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
        const split = SplitText.create(title.current, { type: "lines,words", mask: "lines" });
        intro.from(split.words, { yPercent: 116, duration: 1, stagger: 0.04 }, 0.08);
      });

      intro
        .from("[data-reveal='badge']", { opacity: 0, y: -12, duration: 0.7 }, 0)
        .from("[data-reveal='lede']", { opacity: 0, y: 18, duration: 0.9 }, 0.42)
        .from("[data-reveal='lookup']", { opacity: 0, y: 18, duration: 0.9 }, 0.52)
        .from("[data-reveal='card']", { opacity: 0, y: 44, scale: 0.97, duration: 1.15 }, 0.6);

      gsap.to("[data-parallax]", {
        yPercent: -12,
        opacity: 0.3,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top top", end: "bottom top", scrub: 0.6 },
      });
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section className={styles.hero} ref={root}>
      <div className={styles.grid} />
      <div className={styles.glow} />

      <div className={styles.inner} data-parallax>
        <span className={styles.badge} data-reveal="badge">
          <span className={styles.pulse} data-live={live} />
          {live ? (
            <>
              live<span className={styles.wide}> · ethereum mainnet</span> · block{" "}
              {block.toLocaleString()}
            </>
          ) : (
            "indexer offline"
          )}
        </span>

        <h1 className={styles.title} ref={title}>
          <span>Every swap gets read</span>
          <span>as it passes</span>
        </h1>

        <p className={styles.lede} data-reveal="lede">
          A Uniswap v4 hook that prices every swap by the caller&apos;s on-chain behaviour.
          Sandwich bots pay <strong>1.00%</strong>, clean addresses pay <strong>0.05%</strong>,
          and <strong>nobody is ever blocked</strong>.
        </p>

        <div className={styles.lookup} data-reveal="lookup">
          <LookupField big={false} centred />
        </div>

        <div className={styles.card} data-reveal="card">
          <SwapCard cars={cars} />
        </div>
      </div>
    </section>
  );
}
