"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  decodeEventLog,
  formatUnits,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import {
  ADDRESSES,
  CHAIN,
  MIN_PRICE_LIMIT,
  MAX_PRICE_LIMIT,
  SELL,
  BUY,
  SELL_IS_TOKEN0,
  SELL_SYMBOL,
  BUY_SYMBOL,
  POOL_KEY,
  erc20Abi,
  gantryAbi,
  oracleAbi,
  encodeAttestation,
  poolId,
  publicClient,
  routerAbi,
} from "@/lib/chain";
import { useWallet } from "@/components/WalletProvider";
import { tier as tierOf } from "@/lib/tiers";
import { Review as ReviewModal } from "@/components/swap/Review";
import { Running } from "@/components/swap/Running";
import { Done } from "@/components/swap/Done";
import { HistoryDrawer } from "@/components/swap/HistoryDrawer";
import type { Phase, Review, Settled } from "@/components/swap/shared";
import styles from "./Swap.module.css";

const MAX_UINT = BigInt(
  "115792089237316195423570985008687907853269984665640564039457584007913129639935",
);

export function Swap() {
  const { account, connecting, connect, wrongChain, switchChain, client: wallet } = useWallet();
  const [balance, setBalance] = useState<bigint | null>(null);
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [amount, setAmount] = useState("1000");
  const [landed, setLanded] = useState(0);
  const [attestation, setAttestation] = useState<Hex | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [settled, setSettled] = useState<Settled | null>(null);
  const [failedAt, setFailedAt] = useState<Phase | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [tier, setTier] = useState<number | null>(null);
  const [quote, setQuote] = useState<number | null>(null);
  const lastNonce = useRef<number | null>(null);

  const refresh = useCallback(async (who: Address) => {
    const [bal, allow] = await Promise.all([
      publicClient.readContract({
        address: SELL, abi: erc20Abi, functionName: "balanceOf", args: [who],
      }),
      publicClient.readContract({
        address: SELL, abi: erc20Abi, functionName: "allowance",
        args: [who, ADDRESSES.router],
      }),
    ]);
    setBalance(bal as bigint);
    setAllowance(allow as bigint);
  }, []);

  useEffect(() => {
    if (account) void refresh(account);
  }, [account, refresh]);

  // The tier the hook will actually read when this swap lands.
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
  }, [account, settled]);

  async function run(label: string, fn: () => Promise<void>) {
    setError(null);
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message.split("\n")[0].slice(0, 160));
    } finally {
      setBusy(null);
    }
  }

  const getTokens = () =>
    run("mint", async () => {
      if (!account) return;
      const client = wallet();
      const hash = await client.writeContract({
        account, address: SELL, abi: erc20Abi, functionName: "mint",
        args: [account, parseUnits("1000", 18)], chain: CHAIN,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await refresh(account);
    });

  const approve = () =>
    run("approve", async () => {
      if (!account) return;
      const client = wallet();
      const hash = await client.writeContract({
        account, address: SELL, abi: erc20Abi, functionName: "approve",
        args: [ADDRESSES.router, MAX_UINT], chain: CHAIN,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await refresh(account);
    });

  // Without this the hook only sees the router, so everyone behind it shares one tier.
  /** Returns the hookData the hook will read, signing one if we do not have it yet. */
  const attest = useCallback(async (): Promise<Hex> => {
    if (!account) return "0x";
    const client = wallet();
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    // The hook only accepts the next number this trader has not spent, so read it fresh.
    const nonce = (await publicClient.readContract({
      address: ADDRESSES.gantry,
      abi: gantryAbi,
      functionName: "nonces",
      args: [account],
    })) as bigint;

    const signature = await client.signTypedData({
      account,
      domain: { name: "Gantry", version: "1", chainId: CHAIN.id, verifyingContract: ADDRESSES.gantry },
      types: {
        Attestation: [
          { name: "trader", type: "address" },
          { name: "sender", type: "address" },
          { name: "poolId", type: "bytes32" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      primaryType: "Attestation",
      message: { trader: account, sender: ADDRESSES.router, poolId: poolId(), nonce, deadline },
    });
    const data = encodeAttestation(account, nonce, deadline, signature);
    setAttestation(data);
    setSettled((prev) => (prev ? { ...prev, nonce: Number(nonce) } : prev));
    lastNonce.current = Number(nonce);
    return data;
  }, [account, wallet]);

  const swap = () =>
    run("swap", async () => {
      if (!account) return;
      const client = wallet();
      setSettled(null);
      setError(null);
      setFailedAt(null);
      lastNonce.current = null;
      let reached: Phase = "signing";

      try {
        // Sign first if the trader wants their own price. One popup, no gas, no wait.
        let hookData: Hex = attestation ?? "0x";
        if (!attestation) {
          reached = "signing";
          setPhase("signing");
          hookData = await attest();
        }

        const before = (await publicClient.readContract({
          address: BUY, abi: erc20Abi, functionName: "balanceOf", args: [account],
        })) as bigint;

        reached = "confirming";
        setPhase("confirming");
        const hash = await client.writeContract({
          account,
          address: ADDRESSES.router,
          abi: routerAbi,
          functionName: "swap",
          args: [
            POOL_KEY,
            {
              zeroForOne: SELL_IS_TOKEN0,
              amountSpecified: -parseUnits(amount || "1", 18),
              sqrtPriceLimitX96: SELL_IS_TOKEN0 ? MIN_PRICE_LIMIT : MAX_PRICE_LIMIT,
            },
            { takeClaims: false, settleUsingBurn: false },
            hookData,
          ],
          chain: CHAIN,
        });

        reached = "mining";
        setPhase("mining");
        const rec = await publicClient.waitForTransactionReceipt({ hash });
        setAttestation(null);

        const after = (await publicClient.readContract({
          address: BUY, abi: erc20Abi, functionName: "balanceOf", args: [account],
        })) as bigint;

        const tolled = rec.logs
          .filter((l) => l.address.toLowerCase() === ADDRESSES.gantry.toLowerCase())
          .map((l) => {
            try {
              return decodeEventLog({ abi: gantryAbi, data: l.data, topics: l.topics });
            } catch {
              return null;
            }
          })
          .find((d) => d?.eventName === "Tolled");

        if (tolled?.args) {
          const args = tolled.args as unknown as { payer: Address; tier: number; fee: number };
          setSettled({
            tier: args.tier,
            fee: args.fee,
            payer: args.payer,
            // Only true when the hook actually accepted and spent the attestation.
            nonce: args.payer.toLowerCase() === account.toLowerCase() ? lastNonce.current : null,
            received: Number(formatUnits(after - before, 18)),
            hash,
          });
        }
        setPhase("done");
        setLanded((n) => n + 1);
        await refresh(account);
      } catch (e) {
        setFailedAt(reached);
        setPhase("failed");
        throw e;
      }
    });

  const has = (v: bigint | null) => v !== null && v > BigInt(0);

  /** The phases the cinematic layer owns. */
  const running: Phase[] = ["signing", "confirming", "mining", "failed"];

  const reviewOf = (): Review => ({
    address: account ?? null,
    tier: own,
    fee: FEE_BPS[own] * 100,
    amountIn: size,
    quote: quoted ?? out(FEE_BPS[own]),
    sellSymbol: SELL_SYMBOL,
    buySymbol: BUY_SYMBOL,
    sellIcon: "/tokens/usdc.svg",
    buyIcon: "/tokens/eth.svg",
  });

  /** Closing the stack takes the form back to where it started. */
  const reset = () => {
    setPhase("idle");
    setReview(null);
    setSettled(null);
    setFailedAt(null);
    setError(null);
    setAttestation(null);
    setAmount("");
    if (account) void refresh(account);
  };

  /** The swap is shown before it is signed, so nothing is committed unseen. */
  const openReview = () => {
    setError(null);
    setSettled(null);
    setFailedAt(null);
    setReview(reviewOf());
    setPhase("review");
  };

  /** v4 packs both sides of a trade into one int256: amount0 high, amount1 low. */
  const unpack = (delta: bigint) => {
    const mask = (BigInt(1) << BigInt(128)) - BigInt(1);
    const signed = (v: bigint) => (v >= BigInt(1) << BigInt(127) ? v - (BigInt(1) << BigInt(128)) : v);
    return { amount0: signed((delta >> BigInt(128)) & mask), amount1: signed(delta & mask) };
  };

  // Ask the pool what this trade actually returns. A fee-only estimate ignores the
  // price the trade itself moves, which on a swap this size is the larger number.
  useEffect(() => {
    const size = Number(amount);
    if (!account || !size || !has(allowance)) return setQuote(null);
    let live = true;
    const timer = setTimeout(() => {
      publicClient
        .simulateContract({
          account,
          address: ADDRESSES.router,
          abi: routerAbi,
          functionName: "swap",
          args: [
            POOL_KEY,
            {
              zeroForOne: SELL_IS_TOKEN0,
              amountSpecified: -parseUnits(amount, 18),
              sqrtPriceLimitX96: SELL_IS_TOKEN0 ? MIN_PRICE_LIMIT : MAX_PRICE_LIMIT,
            },
            { takeClaims: false, settleUsingBurn: false },
            attestation ?? "0x",
          ],
        })
        .then(({ result }) => {
          const d = unpack(result as bigint);
          const received = SELL_IS_TOKEN0 ? d.amount1 : d.amount0;
          if (live) setQuote(Number(formatUnits(received, 18)));
        })
        .catch(() => live && setQuote(null));
    }, 350);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [account, amount, attestation, allowance]);

  // Nobody who reaches the pool through a shared router has a history of their own,
  // so that is what the hook charges without an attestation.
  const FEE_BPS = [5, 30, 60, 100];
  const own = tier ?? 1;
  const size = Number(amount) || 0;
  const out = (bps: number) => size * (1 - bps / 10_000);

  // The pool is simulated with whatever hookData we hold, which is none until the swap
  // signs one. Price impact is the same either way, so the tier difference is exact.
  const quoted =
    quote === null ? null : quote + (attestation ? 0 : (size * (FEE_BPS[1] - FEE_BPS[own])) / 10_000);

  const enough = balance !== null && size > 0 && balance >= parseUnits(amount || "0", 18);
  const needsTokens = Boolean(account) && !enough;
  const needsApproval = Boolean(account) && enough && !has(allowance);

  /** The button is the state machine: it says the next thing that has to happen. */
  const step = !account
    ? { label: connecting ? "Connecting" : "Connect wallet", run: connect, ready: true }
    : wrongChain
      ? { label: `Switch to ${CHAIN.name}`, run: switchChain, ready: true }
      : needsTokens
        ? { label: busy === "mint" ? "Minting" : `Mint 1,000 ${SELL_SYMBOL}`, run: getTokens, ready: true }
        : needsApproval
          ? { label: busy === "approve" ? "Approving" : `Approve ${SELL_SYMBOL}`, run: approve, ready: true }
          : { label: `Swap ${SELL_SYMBOL}`, run: openReview, ready: size > 0 };

  return (
    <div className={styles.stage}>
      <div className={styles.card}>
        <div className={styles.head}>
          <span className={styles.title}>Swap</span>
          <span className={styles.venue}>uniswap v4 · gantry pool</span>
        </div>

        <div className={styles.leg}>
          <div className={styles.legTop}>
            <span className={styles.legLabel}>You pay</span>
            {balance !== null ? (
              <span className={styles.legBal}>
                {Number(formatUnits(balance, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                <button onClick={() => setAmount(formatUnits(balance, 18))}>max</button>
              </span>
            ) : null}
          </div>
          <div className={styles.legRow}>
            <input
              className={styles.input}
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              placeholder="0"
              aria-label={`Amount of ${SELL_SYMBOL} to swap`}
            />
            <span className={styles.token}>
              <img className={styles.coin} src="/tokens/usdc.svg" alt="" width={22} height={22} />
              {SELL_SYMBOL}
            </span>
          </div>
        </div>

        <div className={styles.hinge}><span>&darr;</span></div>

        <div className={styles.leg}>
          <div className={styles.legTop}>
            <span className={styles.legLabel}>You receive, before gas</span>
            {quoted === null ? <span className={styles.legBal}>estimate</span> : null}
          </div>
          <div className={styles.legRow}>
            <span className={styles.out}>
              {quoted !== null ? quoted.toFixed(4) : out(FEE_BPS[own]).toFixed(4)}
            </span>
            <span className={styles.token}>
              <img className={styles.coin} src="/tokens/eth.svg" alt="" width={22} height={22} />
              {BUY_SYMBOL}
            </span>
          </div>
        </div>

        <button className={styles.go} onClick={step.run} disabled={!step.ready || busy !== null}>
          {step.label}
        </button>

        {error ? <p className={styles.err}>{error}</p> : null}
      </div>

      {/* three layers rather than one card that keeps changing its mind */}
      <ReviewModal
        open={phase !== "idle"}
        behind={phase !== "review"}
        data={review}
        onConfirm={() => void (busy === null && swap())}
        onCancel={reset}
      />
      <Running
        open={running.includes(phase)}
        phase={phase}
        failedAt={failedAt}
        tier={review?.tier ?? 1}
        fee={review?.fee ?? 3000}
        error={error}
        onClose={reset}
      />
      <Done
        open={phase === "done"}
        data={review}
        settled={settled}
        onClose={reset}
      />

      <HistoryDrawer account={account} landed={landed} />

      {!account ? (
        <p className={styles.note}>Sepolia only. The tokens mint freely, so this costs nothing but gas.</p>
      ) : null}
    </div>
  );
}
