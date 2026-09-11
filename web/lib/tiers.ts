export const TIERS = [
  { name: "clean", fee: "0.05%", token: "success" },
  { name: "unknown", fee: "0.30%", token: "neutral" },
  { name: "suspected", fee: "0.60%", token: "warning" },
  { name: "extractor", fee: "1.00%", token: "danger" },
] as const;

export type Tier = 0 | 1 | 2 | 3;

export const tier = (n: number) => TIERS[n] ?? TIERS[1];

export const isAddress = (value: string) => /^0x[0-9a-fA-F]{40}$/.test(value.trim());

export const shorten = (address: string) => `${address.slice(0, 10)}…${address.slice(-8)}`;

/** One observation as shown in the evidence table. Values, never verdicts. */
export interface Observation {
  label: string;
  value: string;
  note?: string;
}

export interface Lookup {
  address: string;
  tier: Tier;
  scored: boolean;
  sharedInfrastructure: boolean;
  observations: Observation[];
  poolSwaps: number | null;
  source: { fromBlock: number; toBlock: number; scannedAt: string };
}
