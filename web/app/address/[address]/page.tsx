import { notFound } from "next/navigation";
import { LookupField } from "@/components/LookupField";
import { Verdict } from "@/components/Verdict";
import { lookup } from "@/lib/lookup";
import { tier as tierOf } from "@/lib/tiers";
import type { Metadata } from "next";

export const revalidate = 30;

export async function generateMetadata(
  { params }: { params: Promise<{ address: string }> },
): Promise<Metadata> {
  const { address } = await params;
  const result = await lookup(address);
  if (!result) return { title: "Not an address — Gantry" };
  const t = tierOf(result.tier);
  return {
    title: `${t.name} · ${t.fee} — Gantry`,
    description: `${address} would pay ${t.fee} on a Gantry pool. Here is what was measured.`,
  };
}

export default async function AddressPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const result = await lookup(address);
  if (!result) notFound();

  return (
    <main className="page">
      <section className="section">
        <LookupField initial={address} big={false} />
        <div style={{ marginTop: "var(--s8)" }}>
          <Verdict result={result} />
        </div>
      </section>
    </main>
  );
}
