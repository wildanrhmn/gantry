import { Swap } from "@/components/Swap";
import styles from "./swap.module.css";

export const metadata = { title: "Swap | Gantry" };

export default function SwapPage() {
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <span className={styles.kicker}>Swap</span>
        <h1 className={styles.title}>Pay your own toll</h1>
        <p className={styles.body}>
          A live v4 pool on Sepolia. The hook prices your own address, not the router
          everyone else is hiding behind.
        </p>

        <div className={styles.card}>
          <Swap />
        </div>
      </div>
    </main>
  );
}
