"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createWalletClient, type Address, type WalletClient } from "viem";
import { CHAIN, browserTransport } from "@/lib/chain";

interface WalletState {
  account: Address | null;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  client: () => WalletClient;
}

const Ctx = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<Address | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const client = useCallback(() => {
    const transport = browserTransport();
    if (!transport) throw new Error("No wallet found. Install one, then reload.");
    return createWalletClient({ chain: CHAIN, transport });
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      const wallet = client();
      const [who] = await wallet.requestAddresses();
      await wallet.switchChain({ id: CHAIN.id }).catch(async () => {
        await wallet.addChain({ chain: CHAIN });
      });
      setAccount(who);
    } catch (e) {
      setError((e instanceof Error ? e.message : String(e)).split("\n")[0].slice(0, 160));
    } finally {
      setConnecting(false);
    }
  }, [client]);

  // an account switch in the wallet should not leave the page showing the old one
  useEffect(() => {
    const eth = (globalThis as { ethereum?: { on?: Function; removeListener?: Function } }).ethereum;
    if (!eth?.on) return;
    const onAccounts = (accounts: string[]) => setAccount((accounts[0] as Address) ?? null);
    eth.on("accountsChanged", onAccounts);
    return () => eth.removeListener?.("accountsChanged", onAccounts);
  }, []);

  const value = useMemo(
    () => ({ account, connecting, error, connect, disconnect: () => setAccount(null), client }),
    [account, connecting, error, connect, client],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWallet needs WalletProvider");
  return ctx;
}
