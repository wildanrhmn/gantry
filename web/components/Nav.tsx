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

const isCurrent = (href: string, path: string) =>
  href === "/" ? path.startsWith("/address") : path.startsWith(href);

export function Nav() {
  const path = usePathname();
  const { account, connecting, connect } = useWallet();
  const [lifted, setLifted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setLifted(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [path]);

  // tapping anywhere else closes the sheet, the way a menu is expected to behave
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("nav, [data-sheet]")) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);


  return (
    <div className={styles.wrap}>
      <nav className={styles.bar} data-lifted={lifted}>
        <Link href="/" className={styles.brand}>GANTRY</Link>

        <div className={styles.links}>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={styles.link} data-active={isCurrent(l.href, path)}>
              {l.label}
            </Link>
          ))}
        </div>

        <button className={styles.cta} onClick={connect} disabled={connecting}>
          {account ? <span className={styles.dot} /> : null}
          {account ? shorten(account) : connecting ? "Connecting" : "Connect wallet"}
        </button>

        <button className={styles.menu} data-open={open} onClick={() => setOpen((v) => !v)} aria-label="Menu">
          <span />
        </button>
      </nav>

      <div className={styles.sheet} data-sheet data-open={open}>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} data-active={isCurrent(l.href, path)}>{l.label}</Link>
        ))}
        <Link href="/feed" data-active={path.startsWith("/feed")}>Live feed</Link>
        <Link href="/venue" data-active={path.startsWith("/venue")}>Venue</Link>
      </div>
    </div>
  );
}
