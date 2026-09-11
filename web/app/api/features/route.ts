import { NextResponse } from "next/server";
import dataset from "@/data/mainnet-features.json";

/**
 * Behaviour features for every address in the scanned window, in the shape the CRE
 * workflow reads. A materialised view of the Substreams pipeline rather than a live
 * stream: the enclave needs an HTTP endpoint, and streaming 40,000 blocks per request
 * is not that.
 */
export async function GET() {
  return NextResponse.json(
    {
      chain: dataset.chain,
      scannedAt: dataset.scannedAt,
      fromBlock: dataset.fromBlock,
      toBlock: dataset.toBlock,
      traders: dataset.addresses,
    },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
