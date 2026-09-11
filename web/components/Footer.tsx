import { ADDRESSES } from "@/lib/chain";
import styles from "./Footer.module.css";

export function Footer() {
  return (
    <footer className={styles.foot}>
      <div className={styles.inner}>
        <p>
          Hook{" "}
          <a href={`https://sepolia.etherscan.io/address/${ADDRESSES.gantry}`} target="_blank" rel="noreferrer">
            {ADDRESSES.gantry}
          </a>
        </p>
        <p className={styles.line}>
          Behaviour read from Ethereum mainnet. Tiers enforced on Sepolia. Nobody is ever blocked
          from trading — the fee changes, not the access.
        </p>
      </div>
    </footer>
  );
}
