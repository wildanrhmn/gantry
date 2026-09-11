"use client";

import { Modal } from "./Modal";
import { pct, toneVars, type Phase } from "./shared";
import styles from "./Running.module.css";

/** Gantry is a toll gantry over a road, so the run is drawn as one: the swap carries your
 *  signature down the lane, passes under the frame, and is read there. Every beat is a
 *  thing that actually happens. */
const BEATS: { phase: Phase; name: string; note: string }[] = [
  {
    phase: "signing",
    name: "Fitting your plate",
    note: "One EIP-712 message, signed off chain and free, that names you as the trader.",
  },
  {
    phase: "confirming",
    name: "Entering the lane",
    note: "The router carries your swap to the pool, and your signature rides along with it.",
  },
  {
    phase: "mining",
    name: "Under the gantry",
    note: "The hook recovers your address from the signature, reads your tier, and sets the fee.",
  },
];

export function Running({
  open,
  phase,
  failedAt,
  tier,
  fee,
  error,
  onClose,
}: {
  open: boolean;
  phase: Phase;
  failedAt: Phase | null;
  tier: number;
  fee: number;
  error: string | null;
  onClose: () => void;
}) {
  const failed = phase === "failed";
  const at = Math.max(
    0,
    BEATS.findIndex((b) => b.phase === (failed ? (failedAt ?? "signing") : phase)),
  );
  const beat = BEATS[at];

  return (
    <Modal open={open} level={2} style={toneVars(tier)}>
      <div className={styles.head}>
        <span className={styles.title}>{failed ? "Stopped at the gantry" : "Pricing your swap"}</span>
        <span className={styles.sub}>sepolia</span>
      </div>

      <div className={styles.stage} data-beat={at} data-failed={failed ? "true" : undefined}>
        <svg viewBox="0 0 400 150" className={styles.scene} aria-hidden="true">
          <defs>
            <linearGradient id="gantryRoad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1d1f28" />
              <stop offset="100%" stopColor="#0d0e14" />
            </linearGradient>
            <linearGradient id="gantryBeam" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--tone)" stopOpacity="0.55" />
              <stop offset="100%" stopColor="var(--tone)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="gantryCar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3d4255" />
              <stop offset="100%" stopColor="#232630" />
            </linearGradient>
            <linearGradient id="gantrySteel" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#2b2e3a" />
              <stop offset="45%" stopColor="#474c5e" />
              <stop offset="100%" stopColor="#262932" />
            </linearGradient>
            <radialGradient id="gantryHalo" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" stopColor="var(--tone)" stopOpacity="0.2" />
              <stop offset="100%" stopColor="var(--tone)" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="gantryFade" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#000" stopOpacity="0" />
              <stop offset="18%" stopColor="#000" stopOpacity="1" />
              <stop offset="100%" stopColor="#000" stopOpacity="1" />
            </linearGradient>
            <mask id="gantryGridMask">
              <rect x="0" y="0" width="400" height="96" fill="url(#gantryFade)" />
            </mask>
          </defs>

          {/* the space above the road, kept quiet but not empty */}
          <g mask="url(#gantryGridMask)" opacity="0.5">
            <path
              d="M0 30H400M0 58H400M0 86H400M60 0V96M140 0V96M220 0V96M300 0V96M380 0V96"
              stroke="#1e212a" strokeWidth="1"
            />
          </g>
          <ellipse cx="303" cy="60" rx="120" ry="70" fill="url(#gantryHalo)" />

          {/* the road */}
          <rect x="0" y="96" width="400" height="54" fill="url(#gantryRoad)" />
          <line x1="0" y1="96" x2="400" y2="96" stroke="#33363f" strokeWidth="1" />
          <line
            className={styles.lane}
            x1="-40" y1="134" x2="400" y2="134"
            stroke="#3b3f4b" strokeWidth="2" strokeLinecap="round"
          />

          {/* the frame the toll is read from */}
          <g className={styles.gantry}>
            <rect x="262" y="18" width="7" height="78" fill="url(#gantrySteel)" />
            <rect x="344" y="18" width="7" height="78" fill="url(#gantrySteel)" />
            <rect x="253" y="9" width="107" height="10" rx="3" fill="url(#gantrySteel)" />
            <rect x="266" y="88" width="81" height="4" rx="1" fill="#20232b" />
            <rect
              className={styles.sign}
              x="277" y="27" width="59" height="30" rx="5"
              fill="#0f1017" stroke="var(--tone)" strokeOpacity="0.45"
            />
            <text className={styles.signIdle} x="306.5" y="47" textAnchor="middle">· · ·</text>
            <text className={styles.signFee} x="306.5" y="47" textAnchor="middle">{pct(fee)}</text>
          </g>

          {/* the beam that reads the plate */}
          <rect
            className={styles.beam}
            x="277" y="58" width="59" height="38" fill="url(#gantryBeam)"
          />

          {/* the swap, with the attestation fitted to it */}
          <g className={styles.car}>
            <g className={styles.wake}>
              <line x1="-30" y1="108" x2="-6" y2="108" stroke="#4d5265" strokeWidth="2" strokeLinecap="round" />
              <line x1="-48" y1="118" x2="-14" y2="118" stroke="#3d424f" strokeWidth="2" strokeLinecap="round" />
            </g>
            <ellipse cx="39" cy="128" rx="30" ry="4" fill="#000" opacity="0.45" />
            <rect x="12" y="100" width="54" height="26" rx="8" fill="url(#gantryCar)" stroke="#4e5468" />
            <rect x="20" y="105" width="18" height="7" rx="2" fill="#2b2f3c" />
            <rect className={styles.plate} x="44" y="113" width="17" height="9" rx="2" fill="var(--tone)" />
          </g>
        </svg>
      </div>

      <div className={styles.beats}>
        {BEATS.map((b, i) => (
          <span
            key={b.phase}
            className={styles.tick}
            data-state={
              failed && i === at ? "failed" : i < at ? "done" : i === at ? "live" : "idle"
            }
          />
        ))}
      </div>

      <div className={styles.caption} key={failed ? "failed" : beat.phase}>
        <span className={styles.captionName}>{failed ? "It did not go through" : beat.name}</span>
        <span className={styles.captionNote}>{failed ? (error ?? "The run stopped here.") : beat.note}</span>
      </div>

      {failed ? (
        <button className={styles.close} onClick={onClose}>Close</button>
      ) : null}
    </Modal>
  );
}
