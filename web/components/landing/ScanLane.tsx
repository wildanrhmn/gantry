"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, reducedMotion } from "@/lib/motion";
import { TIERS } from "@/lib/tiers";
import styles from "./ScanLane.module.css";

export interface LaneCar {
  address: string;
  tier: number;
}

/** Where along the carriageway the sensor sits, as a fraction of the lane width. */
const SIGN_X = 0.3;
const CAR_W = 152;
const SPEED = 116;

const plate = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

export function ScanLane({ cars }: { cars: LaneCar[] }) {
  const laneRef = useRef<HTMLDivElement>(null);
  const trafficRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const dashRef = useRef<HTMLDivElement>(null);
  const [reading, setReading] = useState(0);

  useEffect(() => {
    const lane = laneRef.current;
    const traffic = trafficRef.current;
    if (!lane || !traffic || cars.length === 0) return;

    const fleet = Array.from(traffic.children) as HTMLElement[];
    const width = lane.clientWidth;
    const signX = width * SIGN_X;
    const span = width + CAR_W * 2;
    const gap = span / fleet.length;

    fleet.forEach((car, i) => gsap.set(car, { x: width + CAR_W - i * gap }));

    if (reducedMotion()) {
      fleet.forEach((car) => (car.dataset.read = "true"));
      return;
    }

    const wrap = gsap.utils.wrap(-CAR_W, width + CAR_W);
    const convoy = gsap.to(fleet, {
      x: `-=${span}`,
      duration: span / SPEED,
      ease: "none",
      repeat: -1,
      modifiers: { x: (value) => `${wrap(parseFloat(value))}px` },
    });

    // A car is read the moment its centre crosses under the sensor, not before.
    const previous = fleet.map((car) => gsap.getProperty(car, "x") as number);
    const watch = () => {
      fleet.forEach((car, i) => {
        const x = gsap.getProperty(car, "x") as number;
        const centre = x + CAR_W / 2;
        const was = previous[i] + CAR_W / 2;
        if (was > signX && centre <= signX) {
          car.dataset.read = "true";
          setReading(i);
        } else if (centre > was) {
          car.dataset.read = "false";
        }
        previous[i] = x;
      });
    };
    gsap.ticker.add(watch);

    // the road markings run at the traffic's speed, or nothing looks like it is moving
    const markings = dashRef.current
      ? gsap.to(dashRef.current, {
          backgroundPositionX: "-=116px",
          duration: 116 / SPEED,
          ease: "none",
          repeat: -1,
        })
      : null;

    return () => {
      gsap.ticker.remove(watch);
      convoy.kill();
      markings?.kill();
    };
  }, [cars]);

  // the sign snaps to the new verdict the way a real one does, in one frame
  useEffect(() => {
    if (!boardRef.current || reducedMotion()) return;
    gsap.fromTo(
      boardRef.current,
      { opacity: 0.25, scaleY: 0.82 },
      { opacity: 1, scaleY: 1, duration: 0.22, ease: "power3.out" },
    );
  }, [reading]);

  const current = cars[reading] ?? cars[0];
  const verdict = TIERS[current?.tier ?? 1] ?? TIERS[1];

  return (
    <div className={styles.lane} ref={laneRef} aria-hidden="true">
      <div className={styles.truss} />
      <span className={styles.leg} data-side="left" />
      <span className={styles.leg} data-side="right" />

      <div className={styles.rig} style={{ left: `${SIGN_X * 100}%` }}>
        <span className={styles.mast} />
        <div className={styles.head}>
          <span className={styles.lens} />
        </div>
        <div className={styles.board} ref={boardRef}>
          <span className={styles.tierText}>{verdict.name}</span>
          <span className={styles.feeText}>{verdict.fee}</span>
        </div>
      </div>

      <div className={styles.beam} style={{ left: `${SIGN_X * 100}%` }} />
      <div className={styles.core} style={{ left: `${SIGN_X * 100}%` }} />

      <div className={styles.road}>
        <div className={styles.dashes} ref={dashRef} />
      </div>
      <div className={styles.pool} style={{ left: `${SIGN_X * 100}%` }} />

      <div className={styles.traffic} ref={trafficRef}>
        {cars.map((car, i) => (
          <div key={`${car.address}-${i}`} className={styles.car} data-tier={car.tier} data-read="false">
            <span className={styles.lamp} />
            <span className={styles.plate}>{plate(car.address)}</span>
            <span className={styles.fee}>{TIERS[car.tier]?.fee ?? "0.30%"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
