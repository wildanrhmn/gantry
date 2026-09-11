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
  POOL_KEY,
  erc20Abi,
  gantryAbi,
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
  const [amount, setAmount] = useState("1");
  const [attestation, setAttestation] = useState<Hex | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const refresh = useCallback(async (who: Address) => {
    const [bal, allow] = await Promise.all([
      publicClient.readContract({
        address: ADDRESSES.token0, abi: erc20Abi, functionName: "balanceOf", args: [who],
      }),
      publicClient.readContract({
        address: ADDRESSES.token0, abi: erc20Abi, functionName: "allowance",
        args: [who, ADDRESSES.router],
      }),
    ]);
    setBalance(bal as bigint);
    setAllowance(allow as bigint);
  }, []);

  useEffect(() => {
    if (account) void refresh(account);
  }, [account, refresh]);

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
        account, address: ADDRESSES.token0, abi: erc20Abi, functionName: "mint",
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
        account, address: ADDRESSES.token0, abi: erc20Abi, functionName: "approve",
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
      const signature = await client.signTypedData({
        account,
        domain: { name: "Gantry", version: "1", chainId: CHAIN.id, verifyingContract: ADDRESSES.gantry },
        types: {
          Attestation: [
            { name: "trader", type: "address" },
            { name: "poolId", type: "bytes32" },
            { name: "deadline", type: "uint256" },
          ],
        },
        primaryType: "Attestation",
        message: { trader: account, poolId: poolId(), deadline },
      });
      setAttestation(encodeAttestation(account, deadline, signature));
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
          { zeroForOne: true, amountSpecified: -parseUnits(amount || "1", 18), sqrtPriceLimitX96: MIN_PRICE_LIMIT },
          { takeClaims: false, settleUsingBurn: false },
          attestation ?? "0x",
        ],
        chain: CHAIN,
      });
      const rec = await publicClient.waitForTransactionReceipt({ hash });
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
  // Nothing is "done" until there is an account to have done it.
  const needsTokens = !account || !has(balance);
  const needsApproval = !account || (!needsTokens && !has(allowance));

  return (
    <div className={styles.wrap}>
      <div className={styles.steps}>
        <Step n={1} done={Boolean(account)} title="Connect a wallet"
          sub={account ?? "Sepolia — nothing here costs real money"}
          action={account ? null : { label: connecting ? "Connecting" : "Connect", onClick: connect, primary: true }} />

        <Step n={2} done={!needsTokens} title="Get test tokens"
          sub={!account ? "1,000 gUSD, free" : balance === null ? "reading" : `${Number(formatUnits(balance, 18)).toLocaleString()} gUSD`}
          action={account && needsTokens ? { label: busy === "mint" ? "Minting" : "Mint 1,000 gUSD", onClick: getTokens, primary: true } : null} />

        <Step n={3} done={!needsApproval && !needsTokens} title="Let the router move them"
          sub={!account ? "one approval, once" : needsApproval ? "one approval, once" : "approved"}
          action={account && needsApproval ? { label: busy === "approve" ? "Approving" : "Approve", onClick: approve, primary: true } : null} />

        <Step n={4} done={Boolean(attestation)} title="Be priced as yourself"
          sub={attestation ? "signed — the hook will read your address" : "optional: without it you are priced as the router"}
          action={account ? { label: busy === "sign" ? "Signing" : attestation ? "Sign again" : "Sign", onClick: sign } : null} />
      </div>

      <div className={styles.amount}>
        <input className={styles.amountInput} value={amount} onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal" aria-label="Amount of gUSD to swap" />
        <span className={styles.sub}>gUSD → gETH</span>
        <button className={styles.act} data-primary="true" onClick={swap}
          disabled={!account || needsTokens || needsApproval || busy !== null}>
          {busy === "swap" ? "Swapping" : "Swap"}
        </button>
      </div>

      {error ? <p className={styles.err}>{error}</p> : null}
      {!account ? <p className={styles.note}>Sepolia only. The tokens mint freely, so this costs nothing but gas.</p> : null}

      {receipt ? (
        <div className={styles.receipt}>
          <div className={styles.receiptRow}>
            <span>Priced as</span><span>{receipt.pricedAs}</span>
          </div>
          <div className={styles.receiptRow}>
            <span>Tier</span>
            <span className={styles[`t${receipt.tier}`]}>{receipt.tier} · {tierOf(receipt.tier).name}</span>
          </div>
          <div className={styles.receiptRow}>
            <span>Fee charged</span>
            <span className={styles[`t${receipt.tier}`]}>{(receipt.fee / 10_000).toFixed(2)}%</span>
          </div>
          <div className={styles.receiptRow}>
            <span>Transaction</span>
            <span><a href={`https://sepolia.etherscan.io/tx/${receipt.hash}`} target="_blank" rel="noreferrer"
              style={{ color: "var(--brand)" }}>{receipt.hash.slice(0, 18)}…</a></span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Step({ n, done, title, sub, action }: {
  n: number; done: boolean; title: string; sub: string;
  action: { label: string; onClick: () => void; primary?: boolean } | null;
}) {
  return (
    <div className={styles.step} data-done={done}>
      <span className={styles.num}>{done ? "✓" : `0${n}`}</span>
      <div className={styles.what}>
        <p className={styles.title}>{title}</p>
        <p className={styles.sub}>{sub}</p>
      </div>
      {action ? (
        <button className={styles.act} data-primary={action.primary} onClick={action.onClick}>
          {action.label}
        </button>
      ) : <span />}
    </div>
  );
}
