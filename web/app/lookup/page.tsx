import { Suspense } from "react";
import { Scanner } from "@/components/lookup/Scanner";
import { scanWindow } from "@/lib/lookup";
import styles from "./lookup.module.css";

export const metadata = { title: "Look up an address | Gantry" };

export const revalidate = 30;

export default async function LookupPage() {
  const scan = await scanWindow();

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <span className={styles.kicker}>Look up</span>
        <h1 className={styles.title}>What would this address pay?</h1>
        <p className={styles.body}>
          Paste any address. Gantry shows the behaviour it was scored on, the tier that behaviour
          earns, and the fee that tier pays, with the evidence, not just the verdict.
        </p>
        <div className={styles.field}>
          <Suspense fallback={null}>
            <Scanner />
          </Suspense>
        </div>

        {scan.live ? (
          <div className={styles.scan}>
            <p className={styles.stat}>
              <span>Swaps observed</span>
              <b>{scan.swaps.toLocaleString()}</b>
            </p>
            <p className={styles.stat}>
              <span>Addresses seen</span>
              <b>{scan.addresses.toLocaleString()}</b>
            </p>
            <p className={styles.stat}>
              <span>Sandwiches found</span>
              <b>{scan.sandwiches.toLocaleString()}</b>
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
