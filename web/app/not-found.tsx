import { LookupField } from "@/components/LookupField";

export default function NotFound() {
  return (
    <main className="page">
      <section className="section">
        <p className="eyebrow">Nothing here</p>
        <h1 className="display h3">That page does not exist</h1>
        <p className="lede">If you were looking up an address, paste it below.</p>
        <div style={{ marginTop: "var(--s6)", maxWidth: 640 }}>
          <LookupField big={false} />
        </div>
      </section>
    </main>
  );
}
