// src/app/api/playground/fund/route.ts
// Two-step testnet USDC faucet for the Playground demo.
//
// Step 1 (GET ?address=G...):
//   Returns an unsigned ChangeTrust XDR the client signs with Freighter.
//
// Step 2 (POST { address, signedXdr }):
//   Client submits the signed trustline tx, then we issue 10 USDC from
//   the bootstrapped issuer.

import { NextRequest, NextResponse } from "next/server";
import {
  Keypair,
  Asset,
  TransactionBuilder,
  Networks,
  Operation,
  Horizon,
} from "@stellar/stellar-sdk";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;
const USDC_AMOUNT = "10";

function getIssuerKp() {
  const secret = process.env.USDC_ISSUER_SECRET;
  if (!secret) throw new Error("USDC_ISSUER_SECRET not configured");
  return Keypair.fromSecret(secret);
}

// ── Step 1: Build unsigned ChangeTrust XDR ──────────────────────────────────
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }

  try {
    const issuerKp = getIssuerKp();
    const usdc = new Asset("USDC", issuerKp.publicKey());
    const server = new Horizon.Server(HORIZON_URL);

    // Check if trustline already exists
    const account = await server.loadAccount(address);
    const hasTrustline = account.balances.some(
      (b: { asset_type: string; asset_code?: string; asset_issuer?: string }) =>
        b.asset_type !== "native" &&
        b.asset_code === "USDC" &&
        b.asset_issuer === issuerKp.publicKey()
    );

    if (hasTrustline) {
      return NextResponse.json({ trustlineExists: true });
    }

    // Build the unsigned ChangeTrust transaction
    const txBuilder = new TransactionBuilder(account, {
      fee: "300000",
      networkPassphrase: NETWORK_PASSPHRASE,
    });
    txBuilder.addOperation(Operation.changeTrust({ asset: usdc }));
    txBuilder.setTimeout(180);
    const tx = txBuilder.build();

    return NextResponse.json({
      trustlineExists: false,
      xdr: tx.toXDR(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── Step 2: Submit signed trustline + issue USDC ────────────────────────────
export async function POST(req: NextRequest) {
  const { address, signedXdr } = await req.json();

  if (!address) {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }

  try {
    const issuerKp = getIssuerKp();
    const usdc = new Asset("USDC", issuerKp.publicKey());
    const server = new Horizon.Server(HORIZON_URL);

    // Submit the signed trustline transaction if provided
    if (signedXdr) {
      const { TransactionBuilder: TB } = await import("@stellar/stellar-sdk");
      const tx = TB.fromXDR(signedXdr, NETWORK_PASSPHRASE);
      await server.submitTransaction(tx as Parameters<typeof server.submitTransaction>[0]);
    }

    // Wait briefly for trustline to settle
    await new Promise((r) => setTimeout(r, 2000));

    // Now issue 10 USDC from issuer → buyer wallet
    const issuerAccount = await server.loadAccount(issuerKp.publicKey());
    const payTx = new TransactionBuilder(issuerAccount, {
      fee: "300000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.payment({
          destination: address,
          asset: usdc,
          amount: USDC_AMOUNT,
        })
      )
      .setTimeout(60)
      .build();

    payTx.sign(issuerKp);
    const result = await server.submitTransaction(payTx);

    return NextResponse.json({
      success: true,
      amount: USDC_AMOUNT,
      txHash: result.hash,
    });
  } catch (err: unknown) {
    const detail =
      (err as { response?: { data?: { extras?: { result_codes?: unknown } } } })?.response?.data?.extras?.result_codes ??
      (err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: String(detail) }, { status: 500 });
  }
}
