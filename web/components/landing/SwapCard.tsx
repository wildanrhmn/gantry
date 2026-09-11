"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { gsap, reducedMotion } from "@/lib/motion";
import { TIERS } from "@/lib/tiers";
import type { LaneCar } from "@/components/landing/ScanLane";
import styles from "./SwapCard.module.css";

/** One fixed trade, so the only thing that moves between addresses is the price. */
const PAY = 1000;
const RATE = 4000;
const HOLD = 3.4;

const FEE_BPS = [5, 30, 60, 100];
const TINT = ["#86bd9b", "#8b90a3", "#cf9257", "#cb7b81"];

const plate = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function SwapCard({ cars }: { cars: LaneCar[] }) {
  const [i, setI] = useState(0);
  const card = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const out = useRef<HTMLSpanElement>(null);
  const feeRef = useRef<HTMLSpanElement>(null);
  const tick = useRef<HTMLSpanElement>(null);

  const current = cars[i % cars.length] ?? { address: "0x", tier: 1 };
  const tier = Math.min(Math.max(current.tier, 0), 3);
  const verdict = TIERS[tier];
  const received = (PAY / RATE) * (1 - FEE_BPS[tier] / 10_000);
  const feeInToken = (PAY * FEE_BPS[tier]) / 10_000;

  useEffect(() => {
    if (cars.length < 2) return;
    if (reducedMotion()) return;

    const advance = () => setI((n) => n + 1);
    const timeline = gsap.timeline({ repeat: -1, onRepeat: advance });
    if (tick.current) timeline.fromTo(tick.current, { scaleX: 0 }, { scaleX: 1, duration: HOLD, ease: "none" });
    return () => {
      timeline.kill();
    };
  }, [cars.length]);

  // the received amount and the fee settle on their new values rather than jumping
  useEffect(() => {
    if (reducedMotion()) {
      if (out.current) out.current.textContent = received.toFixed(6);
      if (feeRef.current) feeRef.current.textContent = `${(FEE_BPS[tier] / 100).toFixed(2)}%`;
      return;
    }
    const proxy = { out: Number(out.current?.textContent ?? received), fee: 0 };
    const tween = gsap.to(proxy, {
      out: received,
      fee: FEE_BPS[tier] / 100,
      duration: 0.55,
      ease: "power2.out",
      onUpdate: () => {
        if (out.current) out.current.textContent = proxy.out.toFixed(6);
        if (feeRef.current) feeRef.current.textContent = `${proxy.fee.toFixed(2)}%`;
      },
    });
    const flare = frame.current
      ? gsap.fromTo(
          frame.current,
          { filter: "brightness(1.9)" },
          { filter: "brightness(1)", duration: 0.9, ease: "power2.out" },
        )
      : null;

    return () => {
      tween.kill();
      flare?.kill();
    };
  }, [received, tier]);

  // a little parallax so the card reads as a physical object above the page
  useEffect(() => {
    const el = card.current;
    if (!el || reducedMotion()) return;
    const move = (e: PointerEvent) => {
      const box = el.getBoundingClientRect();
      const x = (e.clientX - box.left) / box.width - 0.5;
      const y = (e.clientY - box.top) / box.height - 0.5;
      gsap.to(el, { rotateY: x * 7, rotateX: -y * 7, duration: 0.6, ease: "power3.out" });
    };
    const reset = () => gsap.to(el, { rotateY: 0, rotateX: 0, duration: 0.9, ease: "power3.out" });
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", reset);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", reset);
    };
  }, []);

  return (
    <div
      className={styles.stage}
      style={{ perspective: "1100px", ["--tier-colour" as string]: TINT[tier] }}
    >
      <span className={styles.cast} style={{ ["--cast-colour" as string]: TINT[tier] }} />

      <div className={styles.frame} ref={frame}>
        <span className={styles.corner} data-c="tl" />
        <span className={styles.corner} data-c="tr" />
        <span className={styles.corner} data-c="bl" />
        <span className={styles.corner} data-c="br" />

      <div className={styles.card} ref={card}>
        <span className={styles.track}><span className={styles.tick} ref={tick} /></span>

        <div className={styles.head}>
          <span className={styles.title}>Swap</span>
          <span className={styles.venue}>uniswap v4 · gantry pool</span>
        </div>

        <div className={styles.leg}>
          <span className={styles.legLabel}>You pay</span>
          <span className={styles.legRow}>
            <span className={styles.amount}>{PAY.toLocaleString()}</span>
            <span className={styles.token}>gUSD</span>
          </span>
        </div>

        <div className={styles.hinge}><span>↓</span></div>

        <div className={styles.leg}>
          <span className={styles.legLabel}>You receive</span>
          <span className={styles.legRow}>
            <span className={styles.amount} ref={out}>{received.toFixed(6)}</span>
            <span className={styles.token}>gETH</span>
          </span>
        </div>

        <div className={styles.pricing}>
          <div className={styles.row}>
            <span className={styles.key}>Priced as</span>
            <span className={styles.val}>{plate(current.address)}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.key}>Verdict</span>
            <span className={styles.chip} data-tier={tier}>
              <span className={styles.lamp} />
              {verdict.name}
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.key}>Fee this swap</span>
            <span className={`${styles.val} ${styles.fee}`} data-tier={tier}>
              <span ref={feeRef}>{(FEE_BPS[tier] / 100).toFixed(2)}%</span>
              <span className={styles.key}> · {feeInToken.toFixed(2)} gUSD</span>
            </span>
          </div>
        </div>

        <Link href={`/address/${current.address}`} className={styles.go}>
          Why does it pay this?
        </Link>
      </div>
      </div>
    </div>
  );
}
