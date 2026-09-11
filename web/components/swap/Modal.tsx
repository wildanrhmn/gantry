"use client";

import type { CSSProperties, ReactNode } from "react";
import styles from "./Modal.module.css";

/** One layer of the stack. Layers sit on top of each other rather than replacing each
 *  other, so the trade you approved stays visible under everything that follows it. */
export function Modal({
  open,
  level,
  behind,
  style,
  children,
}: {
  open: boolean;
  level: 1 | 2 | 3;
  behind?: boolean;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      className={styles.scrim}
      data-open={open ? "true" : undefined}
      data-level={level}
      role="dialog"
      aria-modal="true"
      aria-hidden={open ? undefined : "true"}
    >
      <div className={styles.card} data-behind={behind ? "true" : undefined} style={style}>
        {children}
      </div>
    </div>
  );
}

export { styles as modalStyles };
