"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@/components/WalletProvider";
import { ADDRESSES, CHAIN, oracleAbi, publicClient } from "@/lib/chain";
import { TIERS, shorten } from "@/lib/tiers";
import styles from "./AccountMenu.module.css";

const TONE = ["var(--success)", "var(--brand-light)", "var(--warning)", "var(--danger)"];
const TONE_SOFT = [
  "rgba(116, 199, 154, 0.1)",
  "rgba(220, 220, 227, 0.06)",
  "rgba(224, 164, 88, 0.1)",
  "rgba(226, 98, 76, 0.1)",
];
const TONE_LINE = [
  "rgba(116, 199, 154, 0.28)",
  "rgba(220, 220, 227, 0.12)",
  "rgba(224, 164, 88, 0.28)",
  "rgba(226, 98, 76, 0.28)",
];

/** Two hues taken straight out of the address, so the mark is stable per account. */
function mark(address: string) {
  const a = parseInt(address.slice(2, 8), 16) % 360;
  const b = parseInt(address.slice(-6), 16) % 360;
  return `linear-gradient(135deg, hsl(${a} 58% 60%), hsl(${b} 60% 44%))`;
}

const Copy = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.8" />
    <path d="M10.5 5.5V3.8A1.3 1.3 0 0 0 9.2 2.5H3.8A1.3 1.3 0 0 0 2.5 3.8v5.4a1.3 1.3 0 0 0 1.3 1.3h1.7" />
  </svg>
);
const Tick = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
    <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Out = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
    <path d="M6.5 3.5H3.4A1.4 1.4 0 0 0 2 4.9v7.7A1.4 1.4 0 0 0 3.4 14h7.7a1.4 1.4 0 0 0 1.4-1.4V9.5" />
    <path d="M9.5 2.5H14v4.5M14 2.5 7.5 9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Power = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
    <path d="M8 2v5.5" strokeLinecap="round" />
    <path d="M4.4 4.6a5 5 0 1 0 7.2 0" strokeLinecap="round" />
  </svg>
);

export function AccountMenu({ className }: { className?: string }) {
  const { account, connecting, connect, disconnect, error } = useWallet();
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("click", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  // Read from the oracle the hook reads, not from our own scoring view. This number
  // is what the next swap actually costs, so it has to come from the chain.
  useEffect(() => {
    if (!account) return setTier(null);
    let live = true;
    publicClient
      .readContract({ address: ADDRESSES.oracle, abi: oracleAbi, functionName: "tierOf", args: [account] })
      .then((t) => live && setTier(Number(t)))
      .catch(() => live && setTier(1));
    return () => {
      live = false;
    };
  }, [account]);

  if (!account) {
    return (
      <button className={className} onClick={connect} disabled={connecting}>
        {connecting ? "Connecting" : "Connect wallet"}
      </button>
    );
  }

  const t = tier ?? 1;
  const verdict = TIERS[t];
  const tones = {
    ["--tone" as string]: TONE[t],
    ["--tone-soft" as string]: TONE_SOFT[t],
    ["--tone-line" as string]: TONE_LINE[t],
  };

  return (
    <div className={styles.wrap} ref={wrap}>
      <button className={styles.trigger} data-open={open} onClick={() => setOpen((v) => !v)}>
        <span className={styles.avatar} style={{ background: mark(account) }} />
        {shorten(account)}
        <span className={styles.chev}>
          <svg width="10" height="7" viewBox="0 0 10 7" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path d="m1 1.5 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      <div className={styles.panel} data-open={open} style={tones}>
        <div className={styles.head}>
          <span className={styles.headAvatar} style={{ background: mark(account) }} />
          <span className={styles.who}>
            <span className={styles.addr}>{shorten(account)}</span>
            <span className={styles.net}>
              <span className={styles.netDot} />
              {CHAIN.name}
            </span>
          </span>
          <button
            className={styles.copy}
            data-done={copied}
            aria-label="Copy address"
            onClick={() => {
              void navigator.clipboard?.writeText(account);
              setCopied(true);
              setTimeout(() => setCopied(false), 1400);
            }}
          >
            {copied ? <Tick /> : <Copy />}
          </button>
        </div>

        <div className={styles.fee}>
          <span className={styles.feeLabel}>Fee on your next swap</span>
          <span className={styles.feeRow}>
            <span className={styles.feeValue}>{tier === null ? "·" : verdict.fee}</span>
            <span className={styles.verdict}>
              <span className={styles.verdictDot} />
              {tier === null ? "reading" : verdict.name}
            </span>
          </span>
        </div>

        <div className={styles.actions}>
          <a
            className={styles.action}
            href={`${CHAIN.blockExplorers?.default.url}/address/${account}`}
            target="_blank"
            rel="noreferrer"
          >
            <Out />
            View on explorer
          </a>
          <button
            className={styles.action}
            data-danger="true"
            onClick={() => {
              disconnect();
              setOpen(false);
            }}
          >
            <Power />
            Disconnect
          </button>
        </div>

        {error ? <p className={styles.error}>{error}</p> : null}
      </div>
    </div>
  );
}
