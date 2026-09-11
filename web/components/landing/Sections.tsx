import Link from "next/link";
import { LookupField } from "@/components/LookupField";
import { Reveal } from "@/components/landing/Reveal";
import { TIERS } from "@/lib/tiers";
import styles from "./sections.module.css";

const GITHUB = "https://github.com/wildanrhmn/gantry";
const TIER_COLOUR = ["var(--success)", "var(--brand)", "var(--warning)", "var(--danger)"];
const n = (v: number) => v.toLocaleString("en-US");

function Tag({ num, children }: { num: string; children: React.ReactNode }) {
  return (
    <div className={styles.tag}>
      <span className={styles.tagDot} />
      <span className={styles.tagNum}>{num}</span>
      <span className={styles.tagText}>{children}</span>
      <span className={styles.tagRule} />
    </div>
  );
}

function Cell({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <div className={styles.cell}>
      <div className={styles.figure} data-tone={tone}>{value}</div>
      <div className={styles.note}>{label}</div>
    </div>
  );
}

export interface Scan {
  swaps: number;
  sandwiches: number;
  addresses: number;
  fromBlock: number;
  toBlock: number;
}

export function Problem({ scan }: { scan: Scan }) {
  const blocks = scan.toBlock - scan.fromBlock;
  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <Reveal>
          <Tag num="01">The problem</Tag>
          <div className={styles.split}>
            <h2 className={styles.h2}>
              A pool quotes a sandwich bot the same price it quotes <em>you</em>.
            </h2>
            <p className={styles.body}>
              Every AMM charges one fee to everyone. The contract that front-ran your trade and
              closed behind it pays exactly what you pay. The cost lands on the trader who got
              sandwiched and on the LPs who took the other side. The pool is holding the evidence
              the whole time — it just never reads it.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className={`${styles.cells} ${styles.cells4}`}>
            <Cell value={n(scan.sandwiches)} label={`sandwich-shaped sequences in ${n(blocks)} blocks`} tone="bad" />
            <Cell value="2,827" label="transactions that reached the pool and reverted" tone="warn" />
            <Cell value="1,146" label="of those from one address, in 5,000 blocks" tone="warn" />
            <Cell value="0.30%" label="what every one of them pays today" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const STEPS = [
  {
    num: "01",
    title: "Read",
    body: "Substreams streams every Uniswap v4 swap on mainnet, and reads the transaction traces alongside them — so an attempt that reverted is visible too. A subgraph's handlers only ever run on receipts of successful transactions, so no subgraph can report one.",
    tag: "The Graph",
  },
  {
    num: "02",
    title: "Score",
    body: "Behaviour is scored inside a Chainlink CRE confidential workflow. The rules are published in the repo; the thresholds are a secret that never leaves the enclave, because a published threshold is one an extractor can sit just underneath.",
    tag: "Chainlink CRE",
  },
  {
    num: "03",
    title: "Price",
    body: "The hook reads one storage slot in beforeSwap and returns an overriding fee for that swap only. The fee is the pool's own LP fee, so the surplus a bot pays goes to the people providing the liquidity it was extracting from.",
    tag: "Uniswap v4",
  },
];

export function Mechanism() {
  return (
    <section className={styles.section} id="mechanism">
      <div className={`${styles.grid} blueprint`} />
      <div className={styles.inner}>
        <Reveal>
          <Tag num="02">The mechanism</Tag>
          <h2 className={`${styles.h2} ${styles.h2Wide}`}>
            One address. One tier. One fee, decided in <em>beforeSwap</em>.
          </h2>
        </Reveal>

        <div className={`${styles.cells} ${styles.cells3}`}>
          {STEPS.map((step, i) => (
            <Reveal key={step.title} delay={i * 0.09}>
              <div className={styles.cellTall}>
                <div className={styles.stepTop}>
                  <span className={styles.tagDot} />
                  <span className={styles.stepNum}>{step.num}</span>
                </div>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepBody}>{step.body}</p>
                <span className={styles.chipTag}>{step.tag}</span>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.08}>
          <div className={styles.ladder}>
            <div className={styles.rungs}>
              {TIERS.map((tier, i) => (
                <div className={styles.rung} key={tier.name}>
                  <span className={styles.rungTrack}>
                    <span
                      className={styles.rungBar}
                      style={{ background: TIER_COLOUR[i], width: `${[12, 40, 76, 128][i]}px` }}
                    />
                  </span>
                  <span className={styles.rungName}>{tier.name}</span>
                  <span className={styles.rungFee}>{tier.fee}</span>
                </div>
              ))}
            </div>
            <p className={styles.body}>
              An address nobody has scored yet lands on the default tier, never the cheap one — so
              rotating to a fresh address does not escape the toll. And an address that many
              unrelated people trade through can never be priced up, because charging a router
              charges everyone behind it.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function Proof() {
  return (
    <section className={styles.section} id="proof">
      <div className={styles.inner}>
        <Reveal>
          <Tag num="03">The proof</Tag>
          <div className={styles.split}>
            <h2 className={styles.h2}>
              Same pool, same size, <em>six times</em> the price.
            </h2>
            <p className={styles.body}>
              Three tolls charged on Sepolia against a live v4 pool. The last two are the same
              address: between them a signed report moved it from the default tier to clean, and
              the next identical swap cost six times less. Nothing was blocked — only priced.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className={`${styles.cells} ${styles.cells4}`}>
            <Cell value="1.00%" label="tier 3 · block 11,677,086" tone="bad" />
            <Cell value="0.30%" label="tier 1 · same block, same size" />
            <Cell value="0.05%" label="same address · block 11,677,137" tone="good" />
            <Cell value="6×" label="cheaper once it was scored clean" tone="good" />
          </div>
        </Reveal>

        <Reveal delay={0.12}>
          <div className={styles.callout}>
            <p className={styles.body}>
              <strong style={{ color: "var(--fg)" }}>The guard that matters.</strong>{" "}
              Uniswap&apos;s Universal Router shows more sandwich-shaped sequences than any bot on
              this page, across thousands of distinct transaction originators. It is never priced
              up. A dedicated bot contract shows the same behaviour behind exactly one originator,
              and that is the difference the scorer keys on.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const STACK: [string, string, string][] = [
  [
    "Uniswap",
    "Venue",
    "A v4 hook. The fee it returns in beforeSwap becomes the pool's LP fee for that swap, so the surplus stays with the liquidity rather than leaving with a searcher.",
  ],
  [
    "The Graph",
    "Data",
    "Nine Substreams modules published to the registry, plus two subgraphs read live on every request — behaviour on mainnet, and Gantry's own tolls on Sepolia.",
  ],
  [
    "Chainlink",
    "Scoring",
    "A CRE confidential workflow runs the scorer inside a TEE and writes a signed tier report on chain. The oracle accepts reports only from that workflow's owner.",
  ],
];

export function BuiltOn() {
  return (
    <section className={styles.section} id="built">
      <div className={styles.inner}>
        <Reveal>
          <Tag num="04">Built on</Tag>
          <div className={`${styles.cells} ${styles.cells3}`} style={{ marginTop: 0 }}>
            {STACK.map(([name, role, desc]) => (
              <div className={styles.cellTall} key={name}>
                <div className={styles.stepTop}>
                  <span className={styles.stepTitle} style={{ margin: 0 }}>{name}</span>
                  <span className={styles.chipTag} style={{ marginTop: 0, color: "var(--amber)" }}>
                    {role}
                  </span>
                </div>
                <p className={styles.stepBody}>{desc}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className={`${styles.section} field`}>
      <div className={`${styles.inner} ${styles.centred}`}>
        <Reveal>
          <h2 className={styles.h2}>Find out what you would pay.</h2>
          <p className={styles.body}>
            Paste any address. Gantry will show you the behaviour it was scored on, the tier that
            behaviour earns, and the fee that tier pays — with the evidence, not just the verdict.
          </p>
          <div style={{ maxWidth: 470, margin: "var(--s8) auto 0", textAlign: "left" }}>
            <LookupField big={false} />
          </div>
          <div className={styles.actions}>
            <Link href="/swap" className={styles.primary}>Swap on Sepolia →</Link>
            <a href={GITHUB} target="_blank" rel="noreferrer" className={styles.secondary}>
              Read the source
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
