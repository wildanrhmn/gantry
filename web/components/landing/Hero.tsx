"use client";

import { useEffect, useRef } from "react";
import { SwapCard } from "@/components/landing/SwapCard";
import type { LaneCar } from "@/components/landing/ScanLane";
import { gsap, ScrollTrigger, SplitText, reducedMotion } from "@/lib/motion";
import styles from "./Hero.module.css";

export function Hero({ cars }: { cars: LaneCar[] }) {
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
        intro.from(split.words, { yPercent: 116, duration: 1, stagger: 0.045 }, 0);
      });

      intro.from("[data-reveal='card']", { opacity: 0, y: 46, scale: 0.97, duration: 1.2 }, 0.34);

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
        <h1 className={styles.title} ref={title}>
          <span>Every swap gets read</span>
          <span>as it passes</span>
        </h1>

        <div className={styles.card} data-reveal="card">
          <SwapCard cars={cars} />
        </div>
      </div>
    </section>
  );
}
