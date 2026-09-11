import { ADDRESSES } from "@/lib/chain";
import styles from "./Footer.module.css";

const GITHUB = "https://github.com/wildanrhmn/gantry";

export function Footer() {
  return (
    <footer className={styles.foot}>
      <div className={styles.inner}>
        <span className={styles.who}>
          <span className={styles.mark} />
          <span className={styles.name}>GANTRY</span>
          <span>| a Uniswap v4 hook that prices each swap by the caller</span>
        </span>

        <span className={styles.meta}>
          <span>ETHOnline 2026</span>
          <a href={`https://sepolia.etherscan.io/address/${ADDRESSES.gantry}`} target="_blank" rel="noreferrer">
            hook ↗
          </a>
          <a href={GITHUB} target="_blank" rel="noreferrer">source ↗</a>
        </span>
      </div>
    </footer>
  );
}
