export type Phase = "idle" | "review" | "signing" | "confirming" | "mining" | "done" | "failed";

export interface Review {
  address: string | null;
  tier: number;
  fee: number;
  amountIn: number;
  quote: number | null;
  sellSymbol: string;
  buySymbol: string;
  sellIcon: string;
  buyIcon: string;
}

export interface Settled {
  tier: number;
  fee: number;
  payer: string;
  nonce: number | null;
  received: number | null;
  hash: string;
}

export const TONE = ["var(--success)", "var(--fg-muted)", "var(--warning)", "var(--danger)"];
export const TONE_SOFT = [
  "rgba(116, 199, 154, 0.1)",
  "rgba(220, 220, 227, 0.05)",
  "rgba(224, 164, 88, 0.1)",
  "rgba(226, 98, 76, 0.1)",
];
export const TONE_LINE = [
  "rgba(116, 199, 154, 0.28)",
  "rgba(220, 220, 227, 0.1)",
  "rgba(224, 164, 88, 0.28)",
  "rgba(226, 98, 76, 0.28)",
];

/** Everyone behind a shared router is priced at this, because the router has no history. */
export const BASELINE = 3000;

export const toneVars = (tier: number) => {
  const t = Math.min(Math.max(tier, 0), 3);
  return {
    ["--tone" as string]: TONE[t],
    ["--tone-soft" as string]: TONE_SOFT[t],
    ["--tone-line" as string]: TONE_LINE[t],
  };
};

/** What the same trade returns at the router's price. The fee comes off the input, so the
 *  ratio of the two fees is the ratio of the two outputs. */
export const gainOverRouter = (out: number | null | undefined, fee: number) =>
  out === null || out === undefined || fee >= BASELINE
    ? null
    : out - (out * (1 - BASELINE / 1e6)) / (1 - fee / 1e6);

export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
export const pct = (fee: number) => `${(fee / 10_000).toFixed(2)}%`;
