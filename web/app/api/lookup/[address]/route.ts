import { NextResponse } from "next/server";
import { lookup } from "@/lib/lookup";

export async function GET(_: Request, ctx: { params: Promise<{ address: string }> }) {
  const { address } = await ctx.params;
  const result = await lookup(address);
  if (!result) return NextResponse.json({ error: "That is not an address." }, { status: 400 });
  return NextResponse.json(result);
}
