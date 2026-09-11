import { ADDRESSES } from "@/lib/chain";
import { scanWindow } from "@/lib/lookup";
import styles from "./how.module.css";

export const metadata = { title: "How it works — Gantry" };
export const revalidate = 30;

export default async function HowPage() {
  const scan = await scanWindow();

  return (
    <main className="page">
      <section className="section">
        <p className="eyebrow">How it works</p>
        <h1 className="display h3">A gantry reads a vehicle at speed</h1>
        <p className="lede">
          It classifies what passes and bills it accordingly, without anyone stopping. This is
          that, applied to a liquidity pool: nobody is blocked from trading, the fee changes.
        </p>
      </section>

      <section className="section">
        <h2 className="display h3">The path a swap takes</h2>
        <ol className={styles.steps}>
          <Step n="Read" body="Substreams pulls every v4 swap on Ethereum mainnet. eth_getLogs returns the log but not who sent the transaction, and without that a router is indistinguishable from a bot. Substreams carries it." />
          <Step n="Detect" body="A sandwich is one address opening and closing a position around somebody else's trade, in one block and pool, where the closing leg reverses the opening one. Both legs must share an originator." />
          <Step n="Score" body="Features become a tier inside a hardware enclave. The rules are public and readable. The thresholds are secrets, because a published threshold is one an extractor can sit just underneath." />
          <Step n="Publish" body="A DON-signed report writes tiers on chain. The oracle refuses to price shared infrastructure punitively, so a bug upstream cannot make every trader behind a router pay extractor rates." />
          <Step n="Charge" body="The hook reads one storage slot in beforeSwap and returns the fee for that swap. The enclave is never in the swap path." />
        </ol>
      </section>

      <section className="section">
        <h2 className="display h3">Things worth knowing</h2>
        <div className={styles.notes}>
          <Note title="Unknown is not clean">
            An address nobody has scored lands on the default tier, never the cheapest one. So
            rotating to a fresh address does not escape the toll — it guarantees it.
          </Note>
          <Note title="Arbitrage is not sandwiching">
            Arbitrage rebalances a pool and LPs want it. Only extraction around another trade is
            priced up, and that is an objective on-chain shape rather than a judgement.
          </Note>
          <Note title="Nobody is blocked">
            The worst outcome is paying more. That bounds the damage from a misclassification,
            and every tier shows the observations behind it so it can be argued with.
          </Note>
          <Note title="It is a tax, not a wall">
            A well-funded bot can pay the toll and proceed. The fee goes to the LPs being
            extracted from, so the loss is recycled rather than prevented.
          </Note>
        </div>
      </section>

      <section className="section">
        <h2 className="display h3">Where it lives</h2>
        <dl className={styles.addresses}>
          <Row label="Hook" value={ADDRESSES.gantry} />
          <Row label="Tier oracle" value={ADDRESSES.oracle} />
          <Row label="Report receiver" value={ADDRESSES.receiver} />
          <Row label="Pool manager" value={ADDRESSES.poolManager} note="Uniswap canonical" />
        </dl>
        <p className="lede" style={{ marginTop: "var(--s6)", fontSize: 13 }}>
          Behaviour read from {scan.swaps.toLocaleString()} mainnet swaps, blocks{" "}
          {scan.fromBlock.toLocaleString()}–{scan.toBlock.toLocaleString()}, indexed live. Tiers
          enforced on Sepolia.
        </p>
      </section>
    </main>
  );
}

function Step({ n, body }: { n: string; body: string }) {
  return (
    <li className={styles.step}>
      <span className={styles.stepName}>{n}</span>
      <p className={styles.stepBody}>{body}</p>
    </li>
  );
}

function Note({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.note}>
      <h3 className={styles.noteTitle}>{title}</h3>
      <p className={styles.noteBody}>{children}</p>
    </div>
  );
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className={styles.row}>
      <dt className={styles.rowLabel}>{label}</dt>
      <dd className={styles.rowValue}>
        <a href={`https://sepolia.etherscan.io/address/${value}`} target="_blank" rel="noreferrer">
          {value}
        </a>
        {note ? <span className={styles.rowNote}>{note}</span> : null}
      </dd>
    </div>
  );
}
