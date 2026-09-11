"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { isAddress } from "@/lib/tiers";
import styles from "./LookupField.module.css";

const EXAMPLES = [
  { address: "0x76f30e3f75437fb862b8d2c4d80a671bceba5b1a", label: "a repeat sandwicher" },
  { address: "0x66a9893cc07d91d95644aedd05d03f95e1dba8af", label: "Uniswap's router" },
];

export function LookupField({
  initial = "",
  big = true,
  trailing,
}: {
  initial?: string;
  big?: boolean;
  trailing?: React.ReactNode;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  function go(address: string) {
    const trimmed = address.trim();
    if (!isAddress(trimmed)) {
      setError("That is not an address. It needs 0x and 40 hex characters.");
      return;
    }
    setError(null);
    router.push(`/address/${trimmed}`);
  }

  return (
    <div>
      <form className={styles.field} onSubmit={(e) => { e.preventDefault(); go(value); }}>
        <input
          className={big ? styles.inputBig : styles.input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste an address"
          aria-label="Address to look up"
          spellCheck={false}
          autoComplete="off"
        />
        <button className={styles.go} type="submit">Look up</button>
        {trailing}
      </form>

      {error ? <p className={styles.error}>{error}</p> : null}

      {big ? (
        <p className={styles.hint}>
          Try{" "}
          {EXAMPLES.map((e, i) => (
            <span key={e.address}>
              {i > 0 ? " or " : ""}
              <button type="button" onClick={() => go(e.address)}>{e.label}</button>
            </span>
          ))}
          .
        </p>
      ) : null}
    </div>
  );
}
