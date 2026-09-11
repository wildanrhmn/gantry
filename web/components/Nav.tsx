"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useWallet } from "@/components/WalletProvider";
import { shorten } from "@/lib/tiers";
import styles from "./Nav.module.css";

const LINKS = [
  { href: "/swap", label: "Swap" },
  { href: "/", label: "Look up" },
  { href: "/how", label: "How it works" },
];

const MORE = [
  { href: "/feed", label: "Live feed" },
  { href: "/venue", label: "Venue" },
];

const isCurrent = (href: string, path: string) =>
  href === "/" ? path.startsWith("/address") : path.startsWith(href);

export function Nav() {
  const path = usePathname();
  const { account, connecting, connect } = useWallet();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [path]);

  // tapping anywhere else closes the sheet, the way a menu is expected to behave
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(`.${styles.col}`)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  const label = account ? shorten(account) : connecting ? "Connecting" : "Connect wallet";

  return (
    <div className={styles.wrap}>
      <div className={styles.col}>
        <nav className={styles.bar}>
          <Link href="/" className={styles.brand}>GANTRY</Link>

          <div className={styles.links}>
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={styles.link} data-active={isCurrent(l.href, path)}>
                {l.label}
              </Link>
            ))}
          </div>

          <div className={styles.right}>
            <button className={styles.cta} onClick={connect} disabled={connecting}>
              {account ? <span className={styles.dot} /> : null}
              {label}
            </button>

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
            <button className={styles.cta} style={{ margin: "6px 4px 2px", justifyContent: "center" }} onClick={connect}>
              {label}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
