import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { verifyStellarSignature } from "@/lib/auth/verify-stellar";
import { getSession } from "@/lib/auth/session";
import { upsertDeveloper } from "@/lib/db/developers";

export async function POST(request: Request) {
  try {
    const { publicKey, signature, nonce } = await request.json();

    if (!publicKey || !signature || !nonce) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Verify nonce exists and hasn't been used
    const redisKey = `paygate:auth:nonce:${nonce}`;
    const isValidNonce = await redis.get(redisKey);
    
    if (!isValidNonce) {
      return NextResponse.json({ error: "Invalid or expired nonce" }, { status: 401 });
    }
    
    // Prevent replay attacks by deleting the nonce immediately
    await redis.del(redisKey);

    // 2. Verify the cryptographic signature
    const expectedMessage = `Sign this message to log into PayGate.\n\nNonce: ${nonce}`;
    const isValidSignature = verifyStellarSignature(publicKey, expectedMessage, signature);
    
    if (!isValidSignature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // 3. Upsert developer in the database
    const developer = await upsertDeveloper(publicKey);

    // 4. Create Iron Session
    const session = await getSession();
    session.developerId = developer.id;
    session.stellarWallet = developer.stellarWallet;
    session.isLoggedIn = true;
    await session.save();

    return NextResponse.json({ success: true, redirect: "/dashboard" });
  } catch (error) {
    console.error("Auth verify error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

