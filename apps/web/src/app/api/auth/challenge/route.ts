import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import crypto from "crypto";

export async function GET() {
  try {
    // Generate a random 32-byte hex nonce
    const nonce = crypto.randomBytes(32).toString("hex");
    
    // In a production environment, you might tie this nonce to an IP address 
    // or early session ID to prevent replay across different clients.
    // For now, we just store valid nonces in Redis with a 5-minute TTL.
    const redisKey = `paygate:auth:nonce:${nonce}`;
    await redis.set(redisKey, "valid", { ex: 300 });

    const message = `Sign this message to log into PayGate.\n\nNonce: ${nonce}`;

    return NextResponse.json({ nonce, message });
  } catch (error) {
    console.error("Auth challenge error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

