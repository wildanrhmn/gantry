import Link from "next/link";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <span className={styles.kicker}>Nothing here</span>
        <h1 className={styles.title}>That page does not exist</h1>
        <p className={styles.body}>
          Two things live on this site: a pool that prices you by your own history, and a lookup
          that shows you what any address would pay.
        </p>
        <div className={styles.actions}>
          <Link className={styles.primary} href="/swap">Swap</Link>
          <Link className={styles.secondary} href="/lookup">Look up an address</Link>
        </div>
      </div>
    </main>
  );
}
