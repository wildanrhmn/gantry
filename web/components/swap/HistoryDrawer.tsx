"use client";

import { useEffect, useRef, useState } from "react";
import type { Hex } from "viem";
import { CHAIN } from "@/lib/chain";
import { tier as tierOf } from "@/lib/tiers";
import { tollsFor, type TollRow } from "@/lib/subgraph";
import { swapAmounts, type Amounts } from "./amounts";
import { pct, toneVars } from "./shared";
import styles from "./HistoryDrawer.module.css";

const ago = (seconds: number) => {
  const d = Math.max(0, Math.floor(Date.now() / 1000) - seconds);
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
};

const when = (seconds: number) =>
  new Date(seconds * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

const shortHash = (h: string) => `${h.slice(0, 8)}…${h.slice(-6)}`;
const amount = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: n < 1 ? 6 : 4 });

/** What this address has actually been charged, read back from the chain rather than from
 *  anything the page remembers. */
export function HistoryDrawer({ account, landed }: { account: string | null; landed: number }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<TollRow[] | null>(null);
  const [legs, setLegs] = useState<Record<string, Amounts>>({});
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (!account) {
      setRows(null);
      setLegs({});
      seen.current.clear();
      return;
    }
    let live = true;
    const load = async () => {
      const data = await tollsFor(account, 12);
      if (live) setRows(data?.tolls ?? []);
    };
    void load();
    // A swap that just landed takes the indexer a few blocks to reach, so ask again.
    if (landed === 0) return () => void (live = false);
    let tries = 0;
    const timer = setInterval(() => {
      if (++tries > 5) return clearInterval(timer);
      void load();
    }, 4000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [account, landed]);

  // The amounts live in the receipts, so they are fetched once per transaction and kept.
  useEffect(() => {
    if (!rows || !account) return;
    let live = true;
    for (const row of rows) {
      if (seen.current.has(row.transactionHash)) continue;
      seen.current.add(row.transactionHash);
      swapAmounts(row.transactionHash as Hex, account)
        .then((a) => live && setLegs((prev) => ({ ...prev, [row.transactionHash]: a })))
        .catch(() => seen.current.delete(row.transactionHash));
    }
    return () => void (live = false);
  }, [rows, account]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  if (!account || rows === null) return null;

  return (
    <>
      <button
        className={styles.fab}
        onClick={() => setOpen(true)}
        aria-label={`Your swaps (${rows.length})`}
        title="Your swaps"
      >
        <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
          <path
            d="M12 7v5l3.2 1.9M3.6 9.2A8.6 8.6 0 1 1 3 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M2 5.2v4.2h4.2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {rows.length > 0 ? <span className={styles.count}>{rows.length}</span> : null}
      </button>

      <div
        className={styles.scrim}
        data-open={open ? "true" : undefined}
        onClick={() => setOpen(false)}
      />

      <aside
        className={styles.panel}
        data-open={open ? "true" : undefined}
        role="dialog"
        aria-label="Your swaps"
        aria-hidden={open ? undefined : "true"}
      >
        <header className={styles.head}>
          <div>
            <span className={styles.title}>Your swaps</span>
            <span className={styles.who}>
              {account.slice(0, 6)}…{account.slice(-4)}
            </span>
          </div>
          <button className={styles.close} onClick={() => setOpen(false)} aria-label="Close">
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className={styles.body}>
          {rows.length === 0 ? (
            <p className={styles.empty}>
              Nothing charged to this address yet. Your first swap lands here once it is on chain.
            </p>
          ) : (
            <ul className={styles.list}>
              {rows.map((t, i) => {
                const legPair = legs[t.transactionHash];
                return (
                  <li
                    key={t.id}
                    className={styles.row}
                    style={{ ...toneVars(t.tier), animationDelay: `${Math.min(i, 8) * 45}ms` }}
                  >
                    <div className={styles.route}>
                      {legPair?.paid ? (
                        <span className={styles.leg}>
                          <img src={legPair.paid.icon} alt="" width={20} height={20} />
                          {amount(legPair.paid.amount)}
                          <em>{legPair.paid.symbol}</em>
                        </span>
                      ) : (
                        <span className={styles.legSkeleton} />
                      )}
                      <span className={styles.arrow}>&rarr;</span>
                      {legPair?.got ? (
                        <span className={styles.leg} data-in>
                          <img src={legPair.got.icon} alt="" width={20} height={20} />
                          {amount(legPair.got.amount)}
                          <em>{legPair.got.symbol}</em>
                        </span>
                      ) : (
                        <span className={styles.legSkeleton} />
                      )}
                    </div>

                    <div className={styles.meta}>
                      <span className={styles.chip}>
                        <span className={styles.dot} />
                        {tierOf(t.tier).name} · {pct(t.fee)}
                      </span>
                      <span className={styles.time} title={when(Number(t.timestamp))}>
                        {ago(Number(t.timestamp))}
                      </span>
                    </div>

                    <a
                      className={styles.hash}
                      href={`${CHAIN.blockExplorers?.default.url}/tx/${t.transactionHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {shortHash(t.transactionHash)}
                      <span aria-hidden="true">&#8599;</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
