// src/lib/db/calls.ts
// Query helpers for the ApiCall table — the transaction ledger.
//
// This table is append-only (no updates, no deletes).
// Every row is one settled, paid API call with its Stellar txHash as the
// immutable audit trail. Dashboard earnings views and the "50 wallets"
// verification query both read from here.

import { prisma } from "@/lib/prisma";
import type { ApiCall, Prisma } from "@prisma/client";
import type { Decimal } from "@prisma/client/runtime/library";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LogCallInput = {
  apiId: string;
  callerWallet: string;
  amountUsdc: Decimal | number;
  txHash: string;
  network: "testnet" | "pubnet";
  status: "settled" | "failed";
  latencyMs?: number;
};

export type DailyEarnings = {
  date: string; // "YYYY-MM-DD"
  totalUsdc: number;
  callCount: number;
};

export type TopCaller = {
  callerWallet: string;
  callCount: number;
  totalUsdc: number;
};

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Record one settled payment. Called immediately after the facilitator confirms
 * settlement — this is the source of truth, never Redis.
 */
export async function logApiCall(input: LogCallInput): Promise<ApiCall> {
  return prisma.apiCall.create({
    data: {
      apiId: input.apiId,
      callerWallet: input.callerWallet,
      amountUsdc: input.amountUsdc,
      txHash: input.txHash,
      network: input.network,
      status: input.status,
      latencyMs: input.latencyMs,
    },
  });
}

// ─── Reads ────────────────────────────────────────────────────────────────────

/**
 * Total lifetime earnings for one API (sum of settled amounts).
 * Used in the per-API detail page header.
 */
export async function getTotalEarnings(apiId: string): Promise<number> {
  const result = await prisma.apiCall.aggregate({
    where: { apiId, status: "settled" },
    _sum: { amountUsdc: true },
  });
  return Number(result._sum.amountUsdc ?? 0);
}

/**
 * Total earnings for a developer across all their APIs.
 * Used in the dashboard overview card.
 */
export async function getDeveloperTotalEarnings(
  developerId: string
): Promise<number> {
  const result = await prisma.apiCall.aggregate({
    where: {
      api: { developerId },
      status: "settled",
    },
    _sum: { amountUsdc: true },
  });
  return Number(result._sum.amountUsdc ?? 0);
}

/**
 * Daily earnings for the last N days for one API.
 * Feeds the earnings chart in the per-API detail page.
 */
export async function getDailyEarnings(
  apiId: string,
  days = 30
): Promise<DailyEarnings[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await prisma.apiCall.findMany({
    where: { apiId, status: "settled", createdAt: { gte: since } },
    select: { createdAt: true, amountUsdc: true },
    orderBy: { createdAt: "asc" },
  });

  // Bucket by day (YYYY-MM-DD)
  const map = new Map<string, { total: number; count: number }>();
  for (const row of rows) {
    const day = row.createdAt.toISOString().slice(0, 10);
    const existing = map.get(day) ?? { total: 0, count: 0 };
    map.set(day, {
      total: existing.total + Number(row.amountUsdc),
      count: existing.count + 1,
    });
  }

  return Array.from(map.entries()).map(([date, { total, count }]) => ({
    date,
    totalUsdc: total,
    callCount: count,
  }));
}

/**
 * Top N distinct caller wallets for one API, ranked by call count.
 * Used in the "Top Callers" table on the per-API detail page.
 * Also powers the "50 distinct wallets" verification query.
 */
export async function getTopCallers(
  apiId: string,
  limit = 10
): Promise<TopCaller[]> {
  const rows = await prisma.apiCall.groupBy({
    by: ["callerWallet"],
    where: { apiId, status: "settled" },
    _count: { callerWallet: true },
    _sum: { amountUsdc: true },
    orderBy: { _count: { callerWallet: "desc" } },
    take: limit,
  });

  return rows.map((r) => ({
    callerWallet: r.callerWallet,
    callCount: r._count.callerWallet,
    totalUsdc: Number(r._sum.amountUsdc ?? 0),
  }));
}

/**
 * Count of distinct caller wallets — used to verify the "50 wallets" milestone.
 */
export async function getDistinctCallerCount(apiId: string): Promise<number> {
  const result = await prisma.apiCall.findMany({
    where: { apiId, status: "settled" },
    select: { callerWallet: true },
    distinct: ["callerWallet"],
  });
  return result.length;
}

/**
 * Most recent N calls for one API.
 * Fallback for the live feed when Redis has no data yet.
 */
export async function getRecentCalls(
  apiId: string,
  limit = 50
): Promise<ApiCall[]> {
  return prisma.apiCall.findMany({
    where: { apiId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
