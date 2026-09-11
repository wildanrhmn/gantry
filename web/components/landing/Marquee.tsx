import styles from "./Marquee.module.css";

export function Marquee({ items }: { items: [string, string][] }) {
  return (
    <div className={styles.tape} aria-hidden>
      {/* two identical runs, so the loop point never shows a gap */}
      <div className={styles.run}>
        {[0, 1].map((run) => (
          <div className={styles.set} key={run}>
            {items.map(([key, value], i) => (
              <span className={styles.item} key={i}>
                <span className={styles.slash}>/</span>
                <span className={styles.key}>{key}</span>
                <span className={styles.value}>{value}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
