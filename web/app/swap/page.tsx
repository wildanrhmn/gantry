import { Swap } from "@/components/Swap";
import { ADDRESSES } from "@/lib/chain";

export const metadata = { title: "Swap | Gantry" };

export default function SwapPage() {
  return (
    <main className="page">
      <section className="section">
        <p className="eyebrow">Swap</p>
        <h1 className="display h3">Pay your own toll</h1>
        <p className="lede">
          A pool on Sepolia with the hook attached. The tokens mint freely, so this costs
          nothing but gas.
        </p>
        <p className="lede" style={{ marginTop: "var(--s3)" }}>
          A shared router is what calls the pool, so the hook sees the router rather than you.
          Sign an attestation and it prices your address instead.
        </p>
        <Swap />
        <p className="lede" style={{ marginTop: "var(--s8)", fontSize: 13 }}>
          Pool{" "}
          <a href={`https://sepolia.etherscan.io/address/${ADDRESSES.gantry}`} target="_blank"
            rel="noreferrer" style={{ color: "var(--brand)" }}>{ADDRESSES.gantry}</a>
        </p>
      </section>
    </main>
  );
}
