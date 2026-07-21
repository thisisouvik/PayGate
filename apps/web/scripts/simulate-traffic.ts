/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * simulate-traffic.ts
 *
 * End-to-end simulation: generates 3 Stellar testnet wallets,
 * funds them with XLM + USDC, then fires paid API calls through
 * the PayGate x402 paywall so you can watch the Live Feed / Dashboard.
 *
 * Prerequisites:
 *   1. Next.js dev server running  →  cd apps/web && npm run dev
 *   2. bootstrap-usdc.ts already run  →  USDC_ISSUER_SECRET in .env.local
 *
 * Run from repo root:
 *   npx tsx --env-file=apps/web/.env.local apps/web/scripts/simulate-traffic.ts
 *   OR (if env is already in shell):
 *   npx tsx apps/web/scripts/simulate-traffic.ts
 */

import { PrismaClient } from "@prisma/client";
import {
  Keypair,
  Asset,
  TransactionBuilder,
  Networks,
  Operation,
  Horizon,
} from "@stellar/stellar-sdk";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { createEd25519Signer } from "@x402/stellar";
import { ExactStellarScheme } from "@x402/stellar/exact/client";

// ── Config ──────────────────────────────────────────────────────────────────
const NEXT_BASE        = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
const HORIZON_URL      = "https://horizon-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;
const USDC_PER_WALLET  = "10"; // USDC minted to each simulation wallet

const prisma = new PrismaClient();

// ── Helpers ──────────────────────────────────────────────────────────────────

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    console.error(`❌ Missing required env var: ${key}`);
    console.error("   Run with:  npx tsx --env-file=apps/web/.env.local apps/web/scripts/simulate-traffic.ts");
    process.exit(1);
  }
  return val;
}

async function friendbot(publicKey: string) {
  const res = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`);
  const json = await res.json();
  if (!res.ok && !JSON.stringify(json).includes("createAccountAlreadyExist")) {
    throw new Error(`Friendbot failed: ${JSON.stringify(json)}`);
  }
  console.log(`   💸 Funded (XLM) ${publicKey.slice(0, 8)}...`);
}

async function submitTx(
  server: Horizon.Server,
  account: Horizon.AccountResponse,
  ops: Operation[],
  signers: Keypair[],
  label: string
): Promise<string> {
  const tx = new TransactionBuilder(account, {
    fee: "300000",
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  ops.forEach(op => tx.addOperation(op as any));
  const built = tx.setTimeout(60).build();
  signers.forEach(s => built.sign(s as any));
  const result = await server.submitTransaction(built);
  const hash = result.hash as string;
  console.log(`   ✅ ${label} → ${hash.slice(0, 12)}...`);
  return hash;
}

/**
 * Adds a USDC trustline to a wallet and then issues it USDC from the issuer.
 */
async function setupUsdc(
  wallet: Keypair,
  issuerKp: Keypair,
  usdc: Asset,
  server: Horizon.Server
) {
  const walletPub = wallet.publicKey();
  const short = `${walletPub.slice(0, 8)}...`;

  // 1. Add trustline (signed by the wallet itself)
  const walletAccount = await server.loadAccount(walletPub);
  await submitTx(
    server,
    walletAccount,
    [Operation.changeTrust({ asset: usdc })],
    [wallet],
    `Trustline (USDC) for ${short}`
  );

  // 2. Issue USDC from issuer → wallet
  const issuerAccount = await server.loadAccount(issuerKp.publicKey());
  await submitTx(
    server,
    issuerAccount,
    [Operation.payment({ destination: walletPub, asset: usdc, amount: USDC_PER_WALLET })],
    [issuerKp],
    `Issued ${USDC_PER_WALLET} USDC → ${short}`
  );
}

// ── Pre-flight ───────────────────────────────────────────────────────────────

async function preflight(proxyUrl: string) {
  try {
    const r = await fetch(NEXT_BASE + "/api/auth/challenge");
    if (!r.ok && r.status !== 400) throw new Error(`HTTP ${r.status}`);
    console.log(`✅ Next.js reachable at ${NEXT_BASE}`);
  } catch {
    console.error(
      `\n❌ Cannot reach Next.js at ${NEXT_BASE}.\n` +
      `   Start it first:  cd apps/web && npm run dev\n`
    );
    process.exit(1);
  }

  const probe = await fetch(proxyUrl);
  if (probe.status !== 402) {
    console.error(`❌ Expected 402 from ${proxyUrl} but got ${probe.status}`);
    process.exit(1);
  }
  console.log(`✅ Route returned 402 — paywall is live!\n`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  // ── 0. Validate environment ──
  const issuerSecret  = requireEnv("USDC_ISSUER_SECRET");
  const issuerKp      = Keypair.fromSecret(issuerSecret);
  const usdc          = new Asset("USDC", issuerKp.publicKey());

  console.log("🔍 Looking for an active API in the database...");
  const api = await prisma.api.findFirst({ where: { isActive: true, isListed: true } });
  if (!api) {
    console.error(
      "❌ No active listed APIs found.\n" +
      "   Go to http://localhost:3000 → My APIs → create one (Active + Listed)."
    );
    process.exit(1);
  }

  const PROXY_URL = `${NEXT_BASE}/api/x/${api.slug}`;
  console.log(`🎯 API      : ${api.name}  (${api.slug})`);
  console.log(`💰 Price    : ${api.priceUsdc} USDC / call`);
  console.log(`🌐 Endpoint : ${PROXY_URL}\n`);

  // ── 1. Pre-flight ──
  await preflight(PROXY_URL);

  // ── 2. Generate 3 wallets ──
  const server  = new Horizon.Server(HORIZON_URL);
  const wallets = [Keypair.random(), Keypair.random(), Keypair.random()];

  console.log("🚀 Generating & funding 3 wallets...\n");
  for (let i = 0; i < wallets.length; i++) {
    const kp = wallets[i];
    console.log(`Wallet ${i + 1}: ${kp.publicKey()}`);
    await friendbot(kp.publicKey());
  }

  console.log("\n⏳ Waiting 5s for Friendbot to confirm...");
  await new Promise(r => setTimeout(r, 5000));

  // ── 3. Trustline + mint USDC for every wallet ──
  console.log("\n💳 Setting up USDC trustlines & minting...\n");
  for (let i = 0; i < wallets.length; i++) {
    console.log(`Wallet ${i + 1}:`);
    try {
      await setupUsdc(wallets[i], issuerKp, usdc, server);
    } catch (e: any) {
      console.error(`   ❌ USDC setup failed for Wallet ${i + 1}: ${e.message}`);
      process.exit(1);
    }
  }

  console.log("\n⏳ Waiting 3s for USDC to settle...");
  await new Promise(r => setTimeout(r, 3000));

  // ── 4. Simulate 3 rounds of API traffic ──
  console.log("\n⚡ Simulating API Traffic (3 rounds × 3 wallets)...\n");

  for (let round = 1; round <= 3; round++) {
    for (let i = 0; i < wallets.length; i++) {
      const kp    = wallets[i];
      const label = `[Round ${round}/3 | Wallet ${i + 1} | ${kp.publicKey().slice(0, 8)}...]`;

      // Fresh x402-enabled fetch for this keypair
      const signer        = createEd25519Signer(kp.secret(), "stellar:testnet");
      const scheme        = new ExactStellarScheme(signer as any);
      const client        = new x402Client().register("stellar:testnet", scheme);
      const fetchWithX402 = wrapFetchWithPayment(fetch, client);

      try {
        console.log(`${label} → calling...`);
        const res = await fetchWithX402(PROXY_URL, { method: "GET" });

        if (res.ok) {
          const txHash = res.headers.get("x-paygate-txhash") ?? "(no hash)";
          console.log(`   ✅ HTTP ${res.status} | Paid ${api.priceUsdc} USDC | Tx: ${txHash.slice(0, 14)}...`);
        } else {
          const body = await res.text().catch(() => "");
          console.log(`   ❌ HTTP ${res.status}: ${body.slice(0, 140)}`);
        }
      } catch (err: any) {
        console.log(`   ❌ Network error: ${err.message}`);
        if (err.cause) console.log(`      Cause: ${String(err.cause).slice(0, 200)}`);
      }

      // Organic delay
      await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
    }
    console.log();
  }

  console.log("🎉 Simulation complete!");
  console.log(`   Dashboard  → ${NEXT_BASE}/dashboard`);
  console.log(`   Live Feed  → ${NEXT_BASE}/apis  (open any API detail page)`);
  await prisma.$disconnect();
  process.exit(0);
}

run().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
