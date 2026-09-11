"use client";

import { useEffect, useRef } from "react";
import styles from "./Reveal.module.css";

/**
 * Lifts its children into place as they come on screen.
 *
 * Content is visible by default and only hidden once this has decided it can
 * reveal it again, so a failure anywhere in here leaves the section readable
 * rather than blank.
 */
export function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (typeof IntersectionObserver === "undefined") return;

    // already on screen: leave it alone rather than hiding it to fade it back in
    if (node.getBoundingClientRect().top <= window.innerHeight * 0.92) return;

    node.dataset.armed = "true";
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        node.dataset.shown = "true";
        io.disconnect();
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={el} className={styles.reveal} style={{ transitionDelay: `${delay}s` }}>
      {children}
    </div>
  );
}
