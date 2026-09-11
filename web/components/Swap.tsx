"use client";

import { useCallback, useEffect, useState } from "react";
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
import styles from "./Swap.module.css";

const MAX_UINT = BigInt(
  "115792089237316195423570985008687907853269984665640564039457584007913129639935",
);

interface Receipt {
  tier: number;
  fee: number;
  hash: Hex;
  pricedAs: Address;
}

export function Swap() {
  const { account, connecting, connect, client: wallet } = useWallet();
  const [balance, setBalance] = useState<bigint | null>(null);
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [amount, setAmount] = useState("1000");
  const [attestation, setAttestation] = useState<Hex | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [tier, setTier] = useState<number | null>(null);
  const [quote, setQuote] = useState<number | null>(null);

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
  }, [account, receipt]);

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
  const sign = () =>
    run("sign", async () => {
      if (!account) return;
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
      setAttestation(encodeAttestation(account, nonce, deadline, signature));
    });

  const swap = () =>
    run("swap", async () => {
      if (!account) return;
      const client = wallet();
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
          attestation ?? "0x",
        ],
        chain: CHAIN,
      });
      const rec = await publicClient.waitForTransactionReceipt({ hash });
      setAttestation(null);
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
        setReceipt({ tier: args.tier, fee: args.fee, hash, pricedAs: args.payer });
      }
      await refresh(account);
    });

  const has = (v: bigint | null) => v !== null && v > BigInt(0);

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

  // Without an attestation the hook prices the router, which is nobody's history.
  const FEE_BPS = [5, 30, 60, 100];
  const own = tier ?? 1;
  const pricedAs = attestation ? own : 1;
  const size = Number(amount) || 0;
  const out = (bps: number) => size * (1 - bps / 10_000);
  // Signed, show what you gain over everyone else. Unsigned, show what you are giving up.
  const delta = attestation
    ? out(FEE_BPS[own]) - out(FEE_BPS[1])
    : out(FEE_BPS[1]) - out(FEE_BPS[own]);

  const TONE = ["var(--success)", "var(--fg-muted)", "var(--warning)", "var(--danger)"];
  const TONE_SOFT = [
    "rgba(116, 199, 154, 0.1)",
    "rgba(220, 220, 227, 0.05)",
    "rgba(224, 164, 88, 0.1)",
    "rgba(226, 98, 76, 0.1)",
  ];
  const TONE_LINE = [
    "rgba(116, 199, 154, 0.3)",
    "rgba(220, 220, 227, 0.1)",
    "rgba(224, 164, 88, 0.3)",
    "rgba(226, 98, 76, 0.3)",
  ];

  const enough = balance !== null && size > 0 && balance >= parseUnits(amount || "0", 18);
  const needsTokens = Boolean(account) && !enough;
  const needsApproval = Boolean(account) && enough && !has(allowance);

  /** The button is the state machine: it says the next thing that has to happen. */
  const step = !account
    ? { label: connecting ? "Connecting" : "Connect wallet", run: connect, ready: true }
    : needsTokens
      ? { label: busy === "mint" ? "Minting" : `Mint 1,000 ${SELL_SYMBOL}`, run: getTokens, ready: true }
      : needsApproval
        ? { label: busy === "approve" ? "Approving" : `Approve ${SELL_SYMBOL}`, run: approve, ready: true }
        : { label: busy === "swap" ? "Swapping" : `Swap ${SELL_SYMBOL}`, run: swap, ready: size > 0 };

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
            {quote === null ? <span className={styles.legBal}>estimate</span> : null}
          </div>
          <div className={styles.legRow}>
            <span className={styles.out}>
              {quote !== null ? quote.toFixed(4) : out(FEE_BPS[pricedAs]).toFixed(4)}
            </span>
            <span className={styles.token}>
              <img className={styles.coin} src="/tokens/eth.svg" alt="" width={22} height={22} />
              {BUY_SYMBOL}
            </span>
          </div>
        </div>

        <div
          className={styles.priced}
          style={{
            ["--tone" as string]: TONE[pricedAs],
            ["--tone-soft" as string]: TONE_SOFT[pricedAs],
            ["--tone-line" as string]: TONE_LINE[pricedAs],
          }}
        >
          <div className={styles.pricedTop}>
            <span className={styles.pricedLabel}>Priced as</span>
            <span className={styles.chip}>
              <span className={styles.dot} />
              {tierOf(pricedAs).name}
            </span>
          </div>
          <div className={styles.pricedWho}>
            <span className={styles.who}>
              {!account ? "connect to see your tier" : attestation ? "you, signed" : "the router"}
            </span>
            <span className={styles.fee}>{(FEE_BPS[pricedAs] / 100).toFixed(2)}%</span>
          </div>

          {account ? (
            <div className={styles.compare}>
              <span>
                {attestation
                  ? `Against the ${(FEE_BPS[1] / 100).toFixed(2)}% everyone else pays`
                  : `At your own tier (${tierOf(own).name}) you would keep more`}
              </span>
              <span className={styles.delta} data-sign={delta < 0 ? "worse" : undefined}>
                {delta === 0 ? "no difference" : `${delta > 0 ? "+" : ""}${delta.toFixed(2)} ${BUY_SYMBOL}`}
              </span>
            </div>
          ) : null}

          {account && !attestation ? (
            <button className={styles.sign} onClick={sign} disabled={busy === "sign"}>
              {busy === "sign" ? "Signing" : "Sign so the hook prices you, not the router"}
            </button>
          ) : null}
        </div>

        <button className={styles.go} onClick={step.run} disabled={!step.ready || busy !== null}>
          {step.label}
        </button>

        {error ? <p className={styles.err}>{error}</p> : null}
      </div>

      {receipt ? (
        <div className={styles.receipt}>
          <div className={styles.receiptRow}>
            <span>Priced as</span><span>{receipt.pricedAs}</span>
          </div>
          <div className={styles.receiptRow}>
            <span>Tier</span><span>{receipt.tier} · {tierOf(receipt.tier).name}</span>
          </div>
          <div className={styles.receiptRow}>
            <span>Fee charged</span><span>{(receipt.fee / 10_000).toFixed(2)}%</span>
          </div>
          <div className={styles.receiptRow}>
            <span>Transaction</span>
            <span>
              <a href={`${CHAIN.blockExplorers?.default.url}/tx/${receipt.hash}`} target="_blank" rel="noreferrer">
                view &#8599;
              </a>
            </span>
          </div>
        </div>
      ) : null}

      {!account ? (
        <p className={styles.note}>Sepolia only. The tokens mint freely, so this costs nothing but gas.</p>
      ) : null}
    </div>
  );
}
