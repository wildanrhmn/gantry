"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createWalletClient, type Address, type WalletClient } from "viem";
import { CHAIN, browserTransport } from "@/lib/chain";

interface Eip1193 {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: never[]) => void) => void;
  removeListener?: (event: string, handler: (...args: never[]) => void) => void;
}

interface WalletState {
  account: Address | null;
  chainId: number | null;
  wrongChain: boolean;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  switchChain: () => Promise<void>;
  disconnect: () => Promise<void>;
  client: () => WalletClient;
}

const Ctx = createContext<WalletState | null>(null);

/** Remembers only that the user chose to connect, never the account itself. */
const INTENT = "gantry.connected";
const provider = () => (globalThis as { ethereum?: Eip1193 }).ethereum ?? null;

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const client = useCallback(() => {
    const transport = browserTransport();
    if (!transport) throw new Error("No wallet found. Install one, then reload.");
    return createWalletClient({ chain: CHAIN, transport });
  }, []);

  const readChain = useCallback(async (eth: Eip1193) => {
    const id = (await eth.request({ method: "eth_chainId" })) as string;
    setChainId(Number.parseInt(id, 16));
  }, []);

  // Restore the session on load. eth_accounts never prompts, so this is silent, and
  // it only runs for someone who connected before.
  useEffect(() => {
    const eth = provider();
    if (!eth) return;
    let live = true;
    if (localStorage.getItem(INTENT) !== "1") return;
    void (async () => {
      try {
        const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
        if (!live) return;
        if (accounts[0]) {
          setAccount(accounts[0] as Address);
          await readChain(eth);
        } else {
          localStorage.removeItem(INTENT);
        }
      } catch {
        /* a wallet that will not answer is the same as no wallet */
      }
    })();
    return () => {
      live = false;
    };
  }, [readChain]);

  useEffect(() => {
    const eth = provider();
    if (!eth?.on) return;
    const onAccounts = (...args: never[]) => {
      const accounts = args[0] as unknown as string[];
      if (accounts?.[0]) {
        setAccount(accounts[0] as Address);
      } else {
        setAccount(null);
        localStorage.removeItem(INTENT);
      }
    };
    const onChain = (...args: never[]) => setChainId(Number.parseInt(args[0] as unknown as string, 16));
    eth.on("accountsChanged", onAccounts);
    eth.on("chainChanged", onChain);
    return () => {
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, []);

  const switchChain = useCallback(async () => {
    const wallet = client();
    await wallet.switchChain({ id: CHAIN.id }).catch(async () => {
      await wallet.addChain({ chain: CHAIN });
      await wallet.switchChain({ id: CHAIN.id });
    });
    setChainId(CHAIN.id);
  }, [client]);

  const connect = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      const eth = provider();
      if (!eth) throw new Error("No wallet found. Install one, then reload.");

      // Ask for permission rather than for addresses: requesting addresses hands back
      // whichever account is already selected, so the picker never opens.
      await eth
        .request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] })
        .catch(() => undefined);

      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      if (!accounts[0]) throw new Error("No account was selected.");

      setAccount(accounts[0] as Address);
      localStorage.setItem(INTENT, "1");
      await readChain(eth);
      await switchChain().catch(() => undefined);
    } catch (e) {
      setError((e instanceof Error ? e.message : String(e)).split("\n")[0].slice(0, 160));
    } finally {
      setConnecting(false);
    }
  }, [readChain, switchChain]);

  const disconnect = useCallback(async () => {
    setAccount(null);
    setChainId(null);
    localStorage.removeItem(INTENT);
    // So the next connect opens the picker again rather than silently reusing this account.
    await provider()
      ?.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] })
      .catch(() => undefined);
  }, []);

  const value = useMemo(
    () => ({
      account,
      chainId,
      wrongChain: account !== null && chainId !== null && chainId !== CHAIN.id,
      connecting,
      error,
      connect,
      switchChain,
      disconnect,
      client,
    }),
    [account, chainId, connecting, error, connect, switchChain, disconnect, client],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWallet needs WalletProvider");
  return ctx;
}
