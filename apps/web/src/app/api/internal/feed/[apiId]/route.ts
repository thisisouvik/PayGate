// src/app/api/internal/feed/[apiId]/route.ts
// Internal route polled by the dashboard every 3-5 seconds for the live feed.
// Returns the last 50 settled calls from Redis (fast, no Postgres hit).
// Falls back to Prisma if Redis has no data yet.

import { NextRequest, NextResponse } from "next/server";
import { getFeed } from "@/lib/feed";
import { getRecentCalls } from "@/lib/db";

type Params = { params: Promise<{ apiId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { apiId } = await params;

  if (!apiId) {
    return NextResponse.json({ error: "Missing apiId" }, { status: 400 });
  }

  // Try Redis first (fast path)
  const redisFeed = await getFeed(apiId);

  if (redisFeed.length > 0) {
    return NextResponse.json({ source: "redis", entries: redisFeed });
  }

  // Fallback: read from Postgres and return in the same shape
  const calls = await getRecentCalls(apiId, 50);
  const entries = calls.map((c) => ({
    callerWallet: c.callerWallet,
    amountUsdc: Number(c.amountUsdc),
    txHash: c.txHash,
    ts: c.createdAt.getTime(),
  }));

  return NextResponse.json({ source: "postgres", entries });
}
