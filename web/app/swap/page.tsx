import { Swap } from "@/components/Swap";
import { ADDRESSES } from "@/lib/chain";
import styles from "./swap.module.css";

export const metadata = { title: "Swap | Gantry" };

export default function SwapPage() {
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <span className={styles.kicker}>Swap</span>
        <h1 className={styles.title}>Pay your own toll</h1>
        <p className={styles.body}>
          A live v4 pool on Sepolia with the hook attached. A router is what calls the pool, so
          sign an attestation and it prices your address instead of the router&apos;s.
        </p>

        <div className={styles.card}>
          <Swap />
        </div>

        <p className={styles.foot}>
          Hook{" "}
          <a href={`https://sepolia.etherscan.io/address/${ADDRESSES.gantry}`} target="_blank" rel="noreferrer">
            {ADDRESSES.gantry}
          </a>
        </p>
      </div>
    </main>
  );
}
