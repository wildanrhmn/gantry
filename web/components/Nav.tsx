"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AccountMenu } from "@/components/AccountMenu";
import styles from "./Nav.module.css";

const LINKS = [
  { href: "/swap", label: "Swap" },
  { href: "/lookup", label: "Look up" },
  { href: "/how", label: "How it works" },
];

const MORE = [
  { href: "/feed", label: "Live feed" },
  { href: "/venue", label: "Venue" },
];

const isCurrent = (href: string, path: string) =>
  href === "/lookup" ? path.startsWith("/lookup") || path.startsWith("/address") : path.startsWith(href);

export function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [lifted, setLifted] = useState(false);

  useEffect(() => setOpen(false), [path]);

  useEffect(() => {
    const onScroll = () => setLifted(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // tapping anywhere else closes the sheet, the way a menu is expected to behave
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(`.${styles.col}`)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  return (
    <div className={styles.wrap}>
      <div className={styles.col}>
        <nav className={styles.bar} data-lifted={lifted}>
          <Link href="/" className={styles.brand}>GANTRY</Link>

          <div className={styles.links}>
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={styles.link} data-active={isCurrent(l.href, path)}>
                {l.label}
              </Link>
            ))}
          </div>

          <div className={styles.right}>
            <a
              className={styles.icon}
              href="https://github.com/wildanrhmn/gantry"
              target="_blank"
              rel="noreferrer"
              aria-label="Source on GitHub"
            >
              <svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38l-.01-1.49C3.8 14.18 3.3 12.9 3.3 12.9c-.36-.93-.89-1.18-.89-1.18-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.67.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48l-.01 2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
              </svg>
            </a>
            <AccountMenu className={styles.cta} />

            <button
              className={styles.burger}
              data-open={open}
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Close menu" : "Open menu"}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </nav>

        <div className={styles.drop} data-open={open}>
          <div className={styles.panel}>
            {[...LINKS, ...MORE].map((l) => (
              <Link key={l.href} href={l.href} data-active={isCurrent(l.href, path)}>{l.label}</Link>
            ))}
            <div style={{ margin: "6px 4px 2px" }}>
              <AccountMenu className={styles.ctaWide} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
