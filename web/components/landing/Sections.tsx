import { Reveal } from "@/components/landing/Reveal";
import styles from "./sections.module.css";

const GITHUB = "https://github.com/wildanrhmn/gantry";
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

/** The shape, not one particular transaction: two legs by one address around a third party. */
const SANDWICH = [
  { side: "buy", dir: "in", who: "0x76f30e3f…5b1a", role: "the bot", kind: "bot" },
  { side: "buy", dir: "in", who: "another trader", role: "you", kind: "victim" },
  { side: "sell", dir: "out", who: "0x76f30e3f…5b1a", role: "the bot", kind: "bot" },
];

export function Problem({ scan }: { scan: Scan }) {
  const blocks = scan.toBlock - scan.fromBlock;
  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <Reveal>
          <Tag num="01">The problem</Tag>
          <div className={styles.split}>
            <h2 className={styles.h2}>
              A pool quotes a bot the same price it quotes <em>you</em>.
            </h2>
            <div>
              <p className={styles.body}>
                The pool is holding the evidence the whole time. It just never reads it.
              </p>
              <div className={styles.evidence}>
                {[
                  [n(scan.sandwiches), "sandwiches found", "bad"],
                  ["2,827", "reverted attempts", "warn"],
                  ["0.30%", "what all of them pay today", ""],
                ].map(([value, label, tone]) => (
                  <div className={styles.evidenceRow} key={label}>
                    <span className={styles.figureValue} data-tone={tone || undefined}>{value}</span>
                    <span className={styles.figureLabel}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className={styles.slab}>
            <div className={styles.slabHead}>
              <span>One block · one pool</span>
              <span>{n(scan.sandwiches)} found in {n(blocks)} blocks</span>
            </div>

            <div className={styles.block}>
              {SANDWICH.map((tx, i) => (
                <div className={styles.txn} data-role={tx.kind} data-dir={tx.dir} key={i}>
                  <span className={styles.side}>
                    <span className={styles.arrow}>{tx.dir === "in" ? "↑" : "↓"}</span>
                    {tx.side}
                  </span>
                  <span>
                    <span className={styles.txnWho}>{tx.who}</span>
                    <span className={styles.txnRole}>{tx.role}</span>
                  </span>
                  <span className={styles.txnFee}>0.30%</span>
                </div>
              ))}
              <span className={styles.same}>
                <span className={styles.sameLabel}>same fee</span>
              </span>
            </div>
          </div>
        </Reveal>

      </div>
    </section>
  );
}

/** Three tolls actually charged on Sepolia. The last two are the same account. */
const TOLLS = [
  { fee: "1.00%", name: "extractor", who: "0xd54db805…", block: "11,677,086", tone: 3 },
  { fee: "0.30%", name: "unknown", who: "0x82fdc5c7…", block: "11,677,086", tone: 1 },
  { fee: "0.05%", name: "clean", who: "0x82fdc5c7…", block: "11,677,137", tone: 0 },
];

const TONE = ["var(--success)", "var(--fg-muted)", "var(--warning)", "var(--danger)"];
const TONE_SOFT = [
  "rgba(116, 199, 154, 0.12)",
  "rgba(220, 220, 227, 0.07)",
  "rgba(224, 164, 88, 0.12)",
  "rgba(226, 98, 76, 0.12)",
];

export function Proof() {
  return (
    <section className={styles.section} id="proof">
      <div className={styles.inner}>
        <Reveal>
          <Tag num="03">The proof</Tag>
          <h2 className={`${styles.h2} ${styles.lead}`}>
            Same pool. Same size. <em>Six times</em> the price.
          </h2>
          <p className={`${styles.body} ${styles.leadBody}`}>
            Three tolls charged on a live v4 pool. Nothing was blocked | only priced.
          </p>
        </Reveal>

        <Reveal delay={0.08}>
          <div className={styles.tolls}>
            {TOLLS.map((t, i) => (
              <div
                className={styles.toll}
                key={i}
                style={{
                  ["--tone" as string]: TONE[t.tone],
                  ["--tone-soft" as string]: TONE_SOFT[t.tone],
                }}
              >
                <span className={styles.tollFee}>{t.fee}</span>
                <span className={styles.tollChip}>
                  <span className={styles.tollDot} />
                  {t.name}
                </span>
                <span className={styles.tollWho}>{t.who}</span>
                <span className={styles.tollBlock}>block {t.block}</span>
              </div>
            ))}
            <p className={styles.tollNote}>
              The last two are the same address, 51 blocks apart. A signed report landed in
              between and the next identical swap cost <strong>six times less</strong>.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const STACK = [
  {
    name: "Uniswap",
    role: "Venue",
    logo: "/brands/uni.svg",
    hue: "rgba(255, 0, 122, 0.16)",
    body: "A v4 hook. The fee it returns in beforeSwap becomes the pool\u2019s LP fee for that swap, so the surplus stays with the liquidity.",
    href: "https://docs.uniswap.org/contracts/v4/overview",
    link: "v4 hooks",
  },
  {
    name: "The Graph",
    role: "Data",
    logo: "/brands/grt.svg",
    hue: "rgba(103, 76, 221, 0.18)",
    body: "Nine Substreams modules published to the registry, plus two subgraphs read live on every request | mainnet behaviour, and Gantry\u2019s own tolls.",
    href: "https://substreams.dev/packages/gantry/v0.1.0",
    link: "substreams.dev/gantry",
  },
  {
    name: "Chainlink",
    role: "Scoring",
    logo: "/brands/link.svg",
    hue: "rgba(42, 90, 218, 0.18)",
    body: "A CRE confidential workflow runs the scorer inside a TEE and writes a signed tier report on chain. The oracle accepts only that workflow\u2019s owner.",
    href: "https://docs.chain.link/cre",
    link: "chainlink cre",
  },
];

export function BuiltOn() {
  return (
    <section className={`${styles.section} ${styles.lit}`} id="built">
      <div className={styles.litRules} />
      <div className={styles.litAura} />
      <div className={styles.inner}>
        <Reveal>
          <Tag num="04">Built on</Tag>
          <h2 className={`${styles.h2} ${styles.lead}`}>
            Three pieces, each doing the part only it can.
          </h2>
        </Reveal>

        <Reveal delay={0.08}>
          <div className={styles.stack}>
            {STACK.map((b) => (
              <a
                className={styles.brand}
                key={b.name}
                href={b.href}
                target="_blank"
                rel="noreferrer"
                style={{ ["--hue" as string]: b.hue }}
              >
                <span className={styles.brandTop}>
                  <img className={styles.logo} src={b.logo} alt="" width={34} height={34} />
                  <span className={styles.role}>{b.role}</span>
                </span>
                <h3 className={styles.brandName}>{b.name}</h3>
                <p className={styles.brandBody}>{b.body}</p>
                <span className={styles.brandLink}>{b.link} ↗</span>
              </a>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
