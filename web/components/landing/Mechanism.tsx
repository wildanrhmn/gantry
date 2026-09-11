"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import styles from "./Mechanism.module.css";

gsap.registerPlugin(useGSAP, ScrollTrigger, DrawSVGPlugin);

/** One address, followed the whole way through: who is calling, what we read, what it scores, what it pays. */
const SHOTS = [
  { n: "01", t: "The caller", b: "Every swap arrives with an address attached. That address is the only thing Gantry prices on." },
  { n: "02", t: "Read", b: "Its swaps and its traces. A reverted attempt emits no logs, so no subgraph can see one." },
  { n: "03", t: "Score", b: "Scored inside a Chainlink enclave. The rules are public; the thresholds never leave it." },
  { n: "04", t: "Price", b: "One storage slot, read in beforeSwap. The fee is the pool’s own, so the LPs keep it." },
];

const SHOT_AT = [0.08, 0.3, 0.54, 0.76];

/** Where the camera sits for each station. Same aspect as the stage, so nothing squashes. */
const CAM = {
  a: "4 231 792 330",
  b: "384 231 792 330",
  c: "764 231 792 330",
  d: "1144 231 792 330",
  /* the whole line, framed on the stations rather than the empty page around them */
  wide: "150 55 1640 683",
};

export interface Subject {
  address: string;
  swaps: number;
  sandwiches: number;
  tier: number;
}

const FEE = ["0.05%", "0.30%", "0.60%", "1.00%"];
const NAME = ["CLEAN", "UNKNOWN", "SUSPECTED", "EXTRACTOR"];
const short = (a: string) => `${a.slice(0, 6)}\u2026${a.slice(-4)}`;

export function Mechanism({ subject }: { subject: Subject }) {
  const root = useRef<HTMLElement>(null);
  const tier = Math.min(Math.max(subject.tier, 0), 3);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const q = gsap.utils.selector(el);
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const svg = q<SVGSVGElement>("svg")[0];
        const shots = q<HTMLElement>("[data-shot]");
        const segs = q<HTMLElement>("[data-seg] i");
        const count = q<HTMLElement>("[data-count]")[0];
        const feeText = q<SVGTextElement>(".fee")[0];
        const rungs = q<SVGRectElement>(".rung");

        let cur = -1;
        gsap.set(shots, { autoAlpha: 0, y: 16 });
        const setShot = (p: number) => {
          let idx = -1;
          for (let i = 0; i < SHOT_AT.length; i++) if (p >= SHOT_AT[i]) idx = i;
          segs.forEach((seg, i) => {
            const a = SHOT_AT[i];
            const b = SHOT_AT[i + 1] ?? 1;
            gsap.set(seg, { scaleX: gsap.utils.clamp(0, 1, (p - a) / (b - a)) });
          });
          if (idx === cur) return;
          const prev = shots[cur];
          cur = idx;
          if (prev) gsap.to(prev, { autoAlpha: 0, y: -12, duration: 0.24, ease: "power2.in", overwrite: true });
          if (shots[idx]) {
            gsap.fromTo(
              shots[idx],
              { autoAlpha: 0, y: 16 },
              { autoAlpha: 1, y: 0, duration: 0.48, ease: "power3.out", overwrite: true, delay: prev ? 0.24 : 0.04 },
            );
          }
          if (count) count.textContent = idx < 0 ? "01" : `0${idx + 1}`;
        };

        const target = Number(FEE[tier].replace("%", ""));
        const fee = { v: 0.3 };
        const writeFee = () => feeText && (feeText.textContent = `${fee.v.toFixed(2)}%`);

        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: el,
            start: "top top",
            end: "+=3800",
            pin: true,
            scrub: 0.6,
            anticipatePin: 1,
            onUpdate: (self) => setShot(self.progress),
          },
        });

        tl
          .to(q("[data-title]"), { autoAlpha: 0, scale: 1.04, y: -20, duration: 4, ease: "power2.in" }, 4)
          .fromTo(q("[data-body]"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 3 }, 6)

          // 01 the caller
          .to(svg, { attr: { viewBox: CAM.a }, duration: 5, ease: "power2.inOut" }, 6)
          .fromTo(q(".stA .frame"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 4 }, 7)
          .fromTo(q(".stA .mark"), { scale: 0, transformOrigin: "50% 50%" }, { scale: 1, duration: 3, ease: "back.out(2)" }, 9)
          .fromTo(q(".stA .addr, .stA .cap"), { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 3, stagger: 1 }, 10)

          // 02 read - its swaps, and the reverts a subgraph cannot see
          .fromTo(q(".rail-ab"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 4 }, 22
          )
          .fromTo(q(".pk1"), { autoAlpha: 0, x: 0 }, { autoAlpha: 1, x: 120, duration: 6 }, 23)
          .to(q(".pk1"), { autoAlpha: 0, duration: 1 }, 29)
          .to(svg, { attr: { viewBox: CAM.b }, duration: 5, ease: "power2.inOut" }, 24)
          .fromTo(q(".stB .frame"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 4 }, 26)
          .fromTo(q(".stB .row"), { autoAlpha: 0, x: -14 }, { autoAlpha: 1, x: 0, duration: 3, stagger: 1.6 }, 28)
          .fromTo(q(".stB .cap"), { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 3 }, 34)

          // 03 score - sealed, and it settles on one tier
          .fromTo(q(".rail-bc"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 4 }, 44)
          .fromTo(q(".pk2"), { autoAlpha: 0, x: 0 }, { autoAlpha: 1, x: 120, duration: 6 }, 45)
          .to(q(".pk2"), { autoAlpha: 0, duration: 1 }, 51)
          .to(svg, { attr: { viewBox: CAM.c }, duration: 5, ease: "power2.inOut" }, 46)
          .fromTo(q(".stC .frame"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 4 }, 48)
          .set(q(".scoreCore"), { y: 33 }, 0)
          .fromTo(q(".seal"), { autoAlpha: 0, scale: 0.6, transformOrigin: "50% 50%" }, { autoAlpha: 1, scale: 1, duration: 3, ease: "back.out(2)" }, 50)
          .to(q(".scoreCore"), { y: 12, duration: 3, ease: "power2.out" }, 60)
          .to(rungs, { keyframes: [{ opacity: 0.3 }, { opacity: 1 }], duration: 2, stagger: { each: 0.5, repeat: 3, yoyo: true } }, 53)
          .call(() => rungs.forEach((r, i) => r.setAttribute("data-on", String(i === tier))), undefined, 60)
          .fromTo(q(".stC .verdict, .stC .cap"), { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 3, stagger: 1 }, 60)

          // 04 price - the fee that address pays on this swap
          .fromTo(q(".rail-cd"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 4 }, 68)
          .fromTo(q(".pk3"), { autoAlpha: 0, x: 0 }, { autoAlpha: 1, x: 120, duration: 6 }, 69)
          .to(q(".pk3"), { autoAlpha: 0, duration: 1 }, 75)
          .to(svg, { attr: { viewBox: CAM.d }, duration: 5, ease: "power2.inOut" }, 70)
          .fromTo(q(".stD .frame"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 4 }, 72)
          .fromTo(q(".fee"), { autoAlpha: 0, scale: 0.9, transformOrigin: "50% 50%" }, { autoAlpha: 1, scale: 1, duration: 3 }, 76)
          .to(fee, { v: target, duration: 6, ease: "power2.out", onUpdate: writeFee }, 78)
          .fromTo(q(".stD .cap"), { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 3 }, 82)

          // the whole line, end to end
          .to(svg, { attr: { viewBox: CAM.wide }, duration: 7, ease: "power2.inOut" }, 90);

        setShot(0);
        writeFee();
      });

      return () => mm.revert();
    },
    { scope: root, dependencies: [tier] },
  );

  return (
    <section className={styles.cine} ref={root} id="mechanism">
      <div className={styles.rules} />
      <div className={styles.aura} />

      <div className={styles.title} data-title>
        <h2 className={styles.titleMain}>One address, end to end.</h2>
        <p className={styles.titleSub}>02 | the mechanism</p>
      </div>

      <div className={styles.inner} data-body>
        <div style={{ display: "grid", justifyItems: "center", gap: "var(--s6)", width: "100%" }}>
          <span className={styles.kicker}>The mechanism</span>

          <div className={styles.shots}>
            {SHOTS.map((s) => (
              <div className={styles.shot} data-shot key={s.n}>
                <span className={styles.shotNum}>{s.n}</span>
                <h3 className={styles.shotTitle}>{s.t}</h3>
                <p className={styles.shotBody}>{s.b}</p>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.stage}>
          <svg className={styles.svg} viewBox="150 55 1640 683" preserveAspectRatio="xMidYMid meet" aria-hidden>
            <line className="rail rail-ab" x1={550} y1={396} x2={640} y2={396} />
            <line className="rail rail-bc" x1={930} y1={396} x2={1020} y2={396} />
            <line className="rail rail-cd" x1={1310} y1={396} x2={1400} y2={396} />

            {/* the caller */}
            <g className="stA">
              <rect className="frame" x={250} y={281} width={300} height={230} rx={18} />
              <rect className="mark" x={365} y={333} width={70} height={70} fill="url(#g1)" />
              <text className="addr" x={400} y={459}>{short(subject.address)}</text>
              <text className="cap" x={400} y={556}>the caller</text>
            </g>
            <rect className="pk pk1" x={554} y={390} width={20} height={12} rx={3} />

            {/* what was read */}
            <g className="stB">
              <rect className="frame" x={630} y={281} width={300} height={230} rx={18} />
              <g className="row">
                <text className="stat" x={766} y={351} textAnchor="end">{subject.swaps}</text>
                <text className="statL" x={790} y={351}>swaps</text>
              </g>
              <g className="row">
                <text className="stat" data-tone="bad" x={766} y={403} textAnchor="end">{subject.sandwiches}</text>
                <text className="statL" x={790} y={403}>sandwiches</text>
              </g>
              <g className="row">
                <text className="statL" x={780} y={455} textAnchor="middle">+ transaction traces</text>
              </g>
              <text className="cap" x={780} y={556}>read</text>
            </g>
            <rect className="pk pk2" x={934} y={390} width={20} height={12} rx={3} />

            {/* the verdict, sealed */}
            <g className="stC">
              <rect className="frame" x={1010} y={281} width={300} height={230} rx={18} />
              <g className="scoreCore">
                <g className="seal">
                  <rect x={1136} y={315} width={48} height={38} rx={7} />
                  <path d="M1147 315v-11a13 13 0 0 1 26 0v11" />
                </g>
                {[0, 1, 2, 3].map((i) => (
                  <rect className="rung" data-on="false" key={i} x={1090} y={369 + i * 18} width={140} height={12} rx={3} />
                ))}
              </g>
              <text className="verdict" x={1160} y={489}>{NAME[tier]}</text>
              <text className="cap" x={1160} y={556}>score</text>
            </g>
            <rect className="pk pk3" x={1314} y={390} width={20} height={12} rx={3} />

            {/* what it pays */}
            <g className="stD">
              <rect className="frame" x={1390} y={281} width={300} height={230} rx={18} />
              <text className="fee" x={1540} y={418}>0.30%</text>
              <text className="cap" x={1540} y={556}>beforeSwap</text>
            </g>

            <defs>
              <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#e8629a" />
                <stop offset="1" stopColor="#8b90a3" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div className={styles.meter}>
          <span className={styles.segs}>
            {SHOTS.map((s) => (
              <span className={styles.seg} data-seg key={s.n}><i /></span>
            ))}
          </span>
          <span className={styles.count} data-count>01</span>
        </div>
      </div>
    </section>
  );
}
