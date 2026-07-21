// src/app/api/internal/stats/[apiId]/route.ts
// Returns aggregated stats for one API — used by the dashboard overview cards.
// Reads earnings from Redis cache first; falls back to Prisma aggregate and
// re-primes the cache on a miss.

import { NextRequest, NextResponse } from "next/server";
import {
  getCachedEarnings,
  setEarningsCache,
  getCachedCallCount,
  setCallCount,
} from "@/lib/feed";
import { getTotalEarnings, getDistinctCallerCount } from "@/lib/db";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ apiId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { apiId } = await params;

  if (!apiId) {
    return NextResponse.json({ error: "Missing apiId" }, { status: 400 });
  }

  // ── Earnings (Redis → Postgres fallback) ────────────────────────────────────
  let totalEarnings = await getCachedEarnings(apiId);
  if (totalEarnings === null) {
    totalEarnings = await getTotalEarnings(apiId);
    await setEarningsCache(apiId, totalEarnings);
  }

  // ── Call count (Redis → Postgres fallback) ──────────────────────────────────
  let totalCalls = await getCachedCallCount(apiId);
  if (totalCalls === null) {
    const result = await prisma.apiCall.count({
      where: { apiId, status: "settled" },
    });
    await setCallCount(apiId, result);
    totalCalls = result;
  }

  // ── Distinct callers (always from Postgres — cheap indexed query) ────────────
  const distinctCallers = await getDistinctCallerCount(apiId);

  return NextResponse.json({
    apiId,
    totalEarningsUsdc: totalEarnings,
    totalCalls,
    distinctCallers,
  });
}
