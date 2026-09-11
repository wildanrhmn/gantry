import { LookupField } from "@/components/LookupField";
import styles from "./lookup.module.css";

export const metadata = { title: "Look up an address | Gantry" };

const EXAMPLES = [
  { address: "0x76f30e3f75437fb862b8d2c4d80a671bceba5b1a", label: "a repeat sandwicher" },
  { address: "0x66a9893cc07d91d95644aedd05d03f95e1dba8af", label: "Uniswap's router" },
];

export default function LookupPage() {
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <span className={styles.kicker}>Look up</span>
        <h1 className={styles.title}>What would this address pay?</h1>
        <p className={styles.body}>
          Paste any address. Gantry shows the behaviour it was scored on, the tier that behaviour
          earns, and the fee that tier pays | with the evidence, not just the verdict.
        </p>
        <div className={styles.field}>
          <LookupField />
        </div>
      </div>
    </main>
  );
}
