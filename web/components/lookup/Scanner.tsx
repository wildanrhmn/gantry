"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { buildObservations } from "@/lib/observations";
import { toneVars } from "@/components/swap/shared";
import { ADDRESSES, oracleAbi, publicClient } from "@/lib/chain";
import type { MainnetTrader } from "@/lib/mainnet";
import { isAddress, tier as tierOf, TIERS, type Lookup, type Tier } from "@/lib/tiers";
import styles from "./Scanner.module.css";

type Part = "oracle" | "behaviour" | "attempts" | "pool";
type PartState = "waiting" | "done" | "failed";

/** Each line is a source that is genuinely being read, and ticks when that one lands. */
const SOURCES: { part: Part; name: string; from: string }[] = [
  { part: "oracle", name: "Tier the pool would charge", from: "on chain" },
  { part: "behaviour", name: "Mainnet behaviour", from: "the graph" },
  { part: "attempts", name: "Reverted attempts", from: "substreams" },
  { part: "pool", name: "Swaps through this pool", from: "the graph" },
];

/** The tier comes from the oracle the hook reads; the mainnet history is the evidence
 *  behind it. The two can disagree, and the page says so when they do. */
interface Result extends Lookup {
  onChain: boolean;
}

const short = (a: string) => `${a.slice(0, 10)}…${a.slice(-8)}`;

/** What the pool would charge this address right now, read from the oracle the hook uses. */
const readOracle = async (address: string) => {
  const [tier, onChain] = await Promise.all([
    publicClient.readContract({
      address: ADDRESSES.oracle,
      abi: oracleAbi,
      functionName: "tierOf",
      args: [address as `0x${string}`],
    }),
    publicClient.readContract({
      address: ADDRESSES.oracle,
      abi: oracleAbi,
      functionName: "isScored",
      args: [address as `0x${string}`],
    }),
  ]);
  return { tier: Number(tier), onChain: Boolean(onChain) };
};

const get = async (address: string, part: Part) => {
  const res = await fetch(`/api/lookup?address=${address}&part=${part}`);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
};

export function Scanner() {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();

  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [state, setState] = useState<Record<Part, PartState>>({
    oracle: "waiting",
    behaviour: "waiting",
    attempts: "waiting",
    pool: "waiting",
  });
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);
  const run = useRef(0);

  const scan = useCallback(async (raw: string) => {
    const address = raw.trim();
    if (!isAddress(address)) {
      setError("That is not an address. It needs 0x and 40 hex characters.");
      return;
    }
    const id = ++run.current;
    setError(null);
    setResult(null);
    setTarget(address);
    setState({ oracle: "waiting", behaviour: "waiting", attempts: "waiting", pool: "waiting" });
    setOpen(true);

    const mark = (part: Part, to: PartState) =>
      run.current === id && setState((prev) => ({ ...prev, [part]: to }));

    const settleWith = <T,>(part: Part, work: Promise<T>) =>
      work.then(
        (data: T) => {
          mark(part, "done");
          return data;
        },
        () => {
          mark(part, "failed");
          return null;
        },
      );

    const settle = <T,>(part: Part) =>
      get(address, part).then(
        (data: T) => {
          mark(part, "done");
          return data;
        },
        () => {
          mark(part, "failed");
          return null;
        },
      );

    const [chain, behaviour, attempts, pool] = await Promise.all([
      // The oracle is what the hook reads at swap time, so it is the answer.
      settleWith("oracle", readOracle(address)),
      settle<{ row: MainnetTrader | null; source: Lookup["source"] }>("behaviour"),
      settle<{ reverted: number }>("attempts"),
      settle<{ swaps: number | null }>("pool"),
    ]);
    if (run.current !== id) return;

    const row = behaviour?.row ?? null;
    setResult({
      address,
      tier: (chain?.tier ?? row?.tier ?? 1) as Tier,
      onChain: Boolean(chain?.onChain),
      scored: Boolean(row),
      sharedInfrastructure: Boolean(row?.sharedInfrastructure),
      observations: row ? buildObservations(row, attempts?.reverted ?? 0) : [],
      poolSwaps: pool?.swaps ?? null,
      source: behaviour?.source ?? { fromBlock: 0, toBlock: 0, swaps: 0, live: false },
    });
    // A shareable link without leaving the page.
    router.replace(`${path}?a=${address}`, { scroll: false });
  }, [path, router]);

  // A pasted link opens straight into its result.
  const fromUrl = params.get("a");
  useEffect(() => {
    if (fromUrl && isAddress(fromUrl) && run.current === 0) {
      setValue(fromUrl);
      void scan(fromUrl);
    }
  }, [fromUrl, scan]);

  const close = useCallback(() => {
    setOpen(false);
    router.replace(path, { scroll: false });
  }, [path, router]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, close]);

  const copy = () => {
    if (!target) return;
    void navigator.clipboard.writeText(`${window.location.origin}${path}?a=${target}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const scanning = result === null;

  return (
    <>
      <form
        className={styles.field}
        onSubmit={(e) => {
          e.preventDefault();
          void scan(value);
        }}
      >
        <span className={styles.prefix} aria-hidden="true">
          <svg viewBox="0 0 20 20" width="16" height="16">
            <circle cx="9" cy="9" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M13.6 13.6L18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
        <input
          className={styles.input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste an address"
          aria-label="Address to look up"
          spellCheck={false}
          autoComplete="off"
        />
        <button className={styles.go} type="submit">Scan</button>
      </form>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.scrim} data-open={open ? "true" : undefined} onClick={close} />

      <div
        className={styles.sheet}
        data-open={open ? "true" : undefined}
        role="dialog"
        aria-modal="true"
        aria-label="Lookup result"
        aria-hidden={open ? undefined : "true"}
      >
        <header className={styles.head}>
          <div className={styles.who}>
            <span className={styles.address}>{target ? short(target) : ""}</span>
            <span className={styles.status}>
              {scanning
                ? "reading four sources"
                : result?.onChain
                  ? "published to the oracle"
                  : "never scored"}
            </span>
          </div>
          <button className={styles.close} onClick={close} aria-label="Close">
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className={styles.body}>
          {scanning ? (
            <div className={styles.scan}>
              {/* the plate being read, with the beam crossing it */}
              <div className={styles.plate}>
                <span className={styles.plateText}>{target}</span>
                <span className={styles.beam} />
              </div>

              <ul className={styles.sources}>
                {SOURCES.map((s) => (
                  <li key={s.part} className={styles.source} data-state={state[s.part]}>
                    <span className={styles.mark} />
                    <span className={styles.sourceName}>{s.name}</span>
                    <span className={styles.sourceFrom}>{s.from}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : result ? (
            <div className={styles.result}>
              <div className={styles.verdict} style={toneVars(result.tier)}>
                <span className={styles.tierLabel}>Tier {result.tier}</span>
                <span className={styles.tierName}>
                  {[...tierOf(result.tier).name].map((c, i) => (
                    <span key={i} style={{ animationDelay: `${120 + i * 30}ms` }}>{c}</span>
                  ))}
                </span>
                <span className={styles.tierFee}>
                  pays {tierOf(result.tier).fee} on every swap
                </span>

                {/* where this address sits on the scale, not just what it is called */}
                <div className={styles.scale} aria-hidden="true">
                  {TIERS.map((t, i) => (
                    <span key={t.name} className={styles.step} data-here={i === result.tier} />
                  ))}
                </div>
                <div className={styles.scaleLabels} aria-hidden="true">
                  {TIERS.map((t, i) => (
                    <span key={t.name} data-here={i === result.tier}>{t.name}</span>
                  ))}
                </div>
              </div>

              {result.sharedInfrastructure ? (
                <p className={styles.notice}>
                  Many unrelated people trade through this address, so it is never priced
                  punitively. Charging a router charges every trader behind it. The people using
                  it can sign an attestation to be priced as themselves.
                </p>
              ) : null}

              {/* the oracle and the mainnet scan are different questions, so say which answered */}
              {result.onChain && !result.scored ? (
                <p className={styles.notice}>
                  This tier is published on the oracle, so it is what the pool would charge. It
                  did not come from the mainnet scan below | this address did no trading in the
                  scanned window.
                </p>
              ) : null}

              {!result.onChain ? (
                <p className={styles.notice}>
                  Nobody has scored this address, so the oracle returns the default tier. Unknown
                  is not the same as clean | it means no judgement has been made.
                </p>
              ) : null}

              {result.observations.length > 0 ? (
                <>
                  <div className={styles.measuredHead}>
                    <span className={styles.measuredLabel}>What was measured</span>
                    <span className={styles.window}>
                      blocks {result.source.fromBlock.toLocaleString()} to{" "}
                      {result.source.toBlock.toLocaleString()}
                    </span>
                  </div>
                  <div className={styles.tiles}>
                    {result.observations.map((o, i) => (
                      <div
                        className={styles.tile}
                        key={o.label}
                        style={{ animationDelay: `${180 + i * 45}ms` }}
                      >
                        <span className={styles.tileValue} data-long={o.value.length > 9 || undefined}>
                          {o.value}
                        </span>
                        <span className={styles.tileLabel}>{o.label}</span>
                        {o.note ? <span className={styles.tileNote}>{o.note}</span> : null}
                      </div>
                    ))}
                    {result.poolSwaps !== null ? (
                      <div
                        className={styles.tile}
                        style={{ animationDelay: `${180 + result.observations.length * 45}ms` }}
                      >
                        <span className={styles.tileValue}>
                          {result.poolSwaps.toLocaleString()}
                        </span>
                        <span className={styles.tileLabel}>Swaps through the Gantry pool</span>
                        <span className={styles.tileNote}>on Sepolia, priced by this hook</span>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        {!scanning && target ? (
          <footer className={styles.foot}>
            <button className={styles.secondary} onClick={copy}>
              {copied ? "Link copied" : "Copy link"}
            </button>
            <button className={styles.primary} onClick={close}>Look up another</button>
          </footer>
        ) : null}
      </div>
    </>
  );
}
