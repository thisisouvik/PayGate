import { NextResponse } from "next/server";
import { getFeed, pushToFeed } from "@/lib/feed";
import { getSession } from "@/lib/auth/session";
import { getApiById } from "@/lib/db/apis";
import { getRecentCalls } from "@/lib/db/calls";

export async function GET(
  request: Request,
  { params }: { params: { apiId: string } }
) {
  try {
    const session = await getSession();
    
    // Auth check - ensure the developer owns this API
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const api = await getApiById(params.apiId, session.developerId);
    if (!api) {
      return NextResponse.json({ error: "API not found" }, { status: 404 });
    }

    // Try to get feed from Redis
    let feed = await getFeed(api.id);

    // If Redis is empty (e.g. key expired or was flushed), populate from Postgres
    if (feed.length === 0) {
      const recentCalls = await getRecentCalls(api.id, 50);
      
      feed = recentCalls.map(call => ({
        callerWallet: call.callerWallet,
        amountUsdc: Number(call.amountUsdc),
        txHash: call.txHash,
        ts: call.createdAt.getTime()
      }));

      // Fire and forget cache priming
      Promise.all([...feed].reverse().map(entry => pushToFeed(api.id, entry))).catch(console.error);
    }

    return NextResponse.json({ feed });
  } catch (error) {
    console.error("Feed error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
