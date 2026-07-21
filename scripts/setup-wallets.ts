/**
 * scripts/setup-wallets.ts
 *
 * One-time setup for testnet wallets used by the PayGate E2E demo.
 * Adds the USDC classic trustline to both the agent and treasury wallets.
 *
 * The USDC testnet issuer is:  GBBD47IF6LWK7P7MDEVSCZA7JMURGNQGLFPE5OTABZCEASIGPDKV5GMM
 * The USDC SAC contract is:   CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
 *
 * Usage (from repo root):
 *   node -r dotenv/config -r tsx scripts/setup-wallets.ts dotenv_config_path=apps/web/.env.local
 */

import {
  Keypair,
  Asset,
  TransactionBuilder,
  Networks,
  Operation,
  Horizon,
} from "@stellar/stellar-sdk";
import * as dotenv from "dotenv";

dotenv.config({ path: "apps/web/.env.local" });

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;
const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCZA7JMURGNQGLFPE5OTABZCEASIGPDKV5GMM";
const USDC = new Asset("USDC", USDC_ISSUER);

const AGENT_SECRET = process.env.AGENT_STELLAR_SECRET_KEY!;
const TREASURY_SECRET = process.env.PAYGATE_TREASURY_SECRET_KEY!;

async function addTrustline(label: string, secret: string, server: Horizon.Server) {
  const kp = Keypair.fromSecret(secret);
  const pub = kp.publicKey();
  console.log(`\n[${label}]  ${pub}`);

  // Load account
  const account = await server.loadAccount(pub);

  // Check if trustline already exists
  const existing = (account.balances as any[]).find(
    (b: any) => b.asset_code === "USDC" && b.asset_issuer === USDC_ISSUER
  );
  if (existing) {
    console.log(`  ✅ USDC trustline already exists (balance: ${existing.balance} USDC)`);
    return;
  }

  // Build changeTrust transaction
  const tx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.changeTrust({ asset: USDC }))
    .setTimeout(30)
    .build();

  tx.sign(kp);
  const result = await server.submitTransaction(tx);
  console.log(`  ✅ USDC trustline added. Tx hash: ${result.hash}`);
}

async function checkBalance(label: string, secret: string, server: Horizon.Server) {
  const kp = Keypair.fromSecret(secret);
  const account = await server.loadAccount(kp.publicKey());
  const xlm = (account.balances as any[]).find((b: any) => b.asset_type === "native");
  const usdc = (account.balances as any[]).find(
    (b: any) => b.asset_code === "USDC" && b.asset_issuer === USDC_ISSUER
  );
  console.log(`\n[${label}] Balances:`);
  console.log(`  XLM:  ${xlm?.balance ?? "0"}`);
  console.log(`  USDC: ${usdc?.balance ?? "0 (no trustline)"}`);
}

async function main() {
  if (!AGENT_SECRET || !TREASURY_SECRET) {
    console.error("Missing AGENT_STELLAR_SECRET_KEY or PAYGATE_TREASURY_SECRET_KEY in .env.local");
    process.exit(1);
  }

  const server = new Horizon.Server(HORIZON_URL);

  console.log("=== PayGate Wallet Setup ===");
  console.log("Adding USDC trustlines to agent and treasury wallets...");

  await addTrustline("Agent   ", AGENT_SECRET, server);
  await addTrustline("Treasury", TREASURY_SECRET, server);

  console.log("\n=== Balances after setup ===");
  await checkBalance("Agent   ", AGENT_SECRET, server);
  await checkBalance("Treasury", TREASURY_SECRET, server);

  const agentPub = Keypair.fromSecret(AGENT_SECRET).publicKey();
  console.log(`
=== Next Step: Get Testnet USDC ===

Your agent wallet needs testnet USDC to make payments.
Get some from the Circle testnet faucet:

  https://faucet.circle.com/

Select "Stellar Testnet" and paste:
  ${agentPub}

Then run the e2e demo:
  node --env-file=apps/web/.env.local -r tsx scripts/e2e-demo.ts
`);
}

main().catch((err) => {
  console.error("Setup failed:", err?.message ?? err);
  process.exit(1);
});
