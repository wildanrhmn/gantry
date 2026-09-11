"use client";

import { useEffect, useRef } from "react";
import { SwapCard } from "@/components/landing/SwapCard";
import type { LaneCar } from "@/components/landing/ScanLane";
import { gsap, ScrollTrigger, SplitText, reducedMotion } from "@/lib/motion";
import styles from "./Hero.module.css";

/** Bars of light: size, tilt, where they sit, and the colour they fade out of. */
const SHAPES = [
  { w: 600, h: 140, tilt: "12deg", pos: { left: "-6%", top: "18%" }, from: "#60495a4d", delay: "0s" },
  { w: 500, h: 120, tilt: "-15deg", pos: { right: "-4%", top: "70%" }, from: "#a9aca924", delay: "1.1s" },
  { w: 300, h: 80, tilt: "-8deg", pos: { left: "8%", bottom: "6%" }, from: "#bfc3ba1f", delay: "2.2s" },
  { w: 220, h: 64, tilt: "20deg", pos: { right: "18%", top: "12%" }, from: "#3f324473", delay: "0.6s" },
  { w: 160, h: 44, tilt: "-25deg", pos: { left: "24%", top: "8%" }, from: "#60495a38", delay: "1.7s" },
] as const;

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
        intro.from(
          split.words,
          { yPercent: 116, duration: 1, stagger: 0.045, onComplete: () => split.revert() },
          0,
        );
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
      <div className={styles.wash} />
      <div className={styles.shapes}>
        {SHAPES.map((s, i) => (
          <span
            key={i}
            className={styles.shape}
            style={{
              ...s.pos,
              width: s.w,
              height: s.h,
              animationDelay: s.delay,
              backgroundImage: `linear-gradient(90deg, ${s.from}, transparent)`,
              ["--tilt" as string]: s.tilt,
            }}
          />
        ))}
      </div>
      <div className={styles.blueprint + " blueprint"} />
      <div className={styles.close} />

      <div className={styles.inner} data-parallax>
        <h1 className={styles.title} ref={title}>
          <span>Every swap gets read</span>
          <em>as it passes</em>
        </h1>

        <div className={styles.card} data-reveal="card">
          <SwapCard cars={cars} />
        </div>
      </div>
    </section>
  );
}
