"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger, reducedMotion } from "@/lib/motion";

/** Lifts its children into place once they are actually on screen. */
export function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = el.current;
    if (!node || reducedMotion()) return;
    const tween = gsap.from(node, {
      opacity: 0,
      y: 26,
      duration: 0.85,
      delay,
      ease: "power3.out",
      scrollTrigger: { trigger: node, start: "top 88%", once: true },
    });
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [delay]);

  return <div ref={el}>{children}</div>;
}
