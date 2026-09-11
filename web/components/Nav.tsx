"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Nav.module.css";

const LINKS = [
  { href: "/", label: "look up" },
  { href: "/swap", label: "swap" },
  { href: "/feed", label: "feed" },
  { href: "/venue", label: "venue" },
  { href: "/how", label: "how it works" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className={styles.bar}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>GANTRY</Link>
        <div className={styles.links}>
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={styles.link}
              data-active={l.href === "/" ? path === "/" || path.startsWith("/address") : path.startsWith(l.href)}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <span className={styles.net}>sepolia</span>
      </div>
    </nav>
  );
}
