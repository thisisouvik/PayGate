/**
 * scripts/bootstrap-usdc.ts
 *
 * Creates a self-contained USDC test environment on Stellar testnet:
 * 1. Generates + funds a USDC issuer keypair
 * 2. Adds classic USDC trustlines to agent + treasury wallets
 * 3. Issues test USDC to the agent wallet
 * 4. Deploys a Stellar Asset Contract (SAC) for our USDC
 * 5. Prints the SAC contract ID to paste into .env.local as SOROBAN_USDC_CONTRACT
 *
 * Run ONCE from repo root:
 *   node -r dotenv/config -r tsx scripts/bootstrap-usdc.ts dotenv_config_path=apps/web/.env.local
 */

import {
  Keypair,
  Asset,
  TransactionBuilder,
  Networks,
  Operation,
  Horizon,
} from "@stellar/stellar-sdk";
import { execSync } from "child_process";
import * as fs from "fs";
import * as dotenv from "dotenv";

dotenv.config({ path: "apps/web/.env.local" });

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;
const AGENT_SECRET = process.env.AGENT_STELLAR_SECRET_KEY!;
const TREASURY_SECRET = process.env.PAYGATE_TREASURY_SECRET_KEY!;

async function friendbot(address: string) {
  const res = await fetch(`https://friendbot.stellar.org?addr=${address}`);
  if (!res.ok) {
    const text = await res.text();
    if (text.includes("createAccountAlreadyExist")) {
      console.log(`  ℹ️  Already funded: ${address}`);
      return;
    }
    throw new Error(`Friendbot failed: ${text}`);
  }
  console.log(`  ✅ Funded: ${address}`);
}

async function submitTx(server: Horizon.Server, tx: any, kp: Keypair) {
  tx.sign(kp);
  const result = await server.submitTransaction(tx);
  return result.hash as string;
}

async function addTrustlineAndFund(
  label: string,
  walletSecret: string,
  issuerKp: Keypair,
  asset: Asset,
  amount: string,
  server: Horizon.Server
) {
  const walletKp = Keypair.fromSecret(walletSecret);
  const walletPub = walletKp.publicKey();
  console.log(`\n[${label}] ${walletPub}`);

  const account = await server.loadAccount(walletPub);

  // Add trustline
  const trustTx = new TransactionBuilder(account, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(Operation.changeTrust({ asset }))
    .setTimeout(30)
    .build();
  const trustHash = await submitTx(server, trustTx, walletKp);
  console.log(`  ✅ Trustline added: ${trustHash}`);

  // Issue USDC from issuer to wallet
  const issuerAccount = await server.loadAccount(issuerKp.publicKey());
  const payTx = new TransactionBuilder(issuerAccount, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(Operation.payment({ destination: walletPub, asset, amount }))
    .setTimeout(30)
    .build();
  const payHash = await submitTx(server, payTx, issuerKp);
  console.log(`  ✅ Issued ${amount} USDC: ${payHash}`);
}

async function main() {
  if (!AGENT_SECRET || !TREASURY_SECRET) {
    throw new Error("Missing AGENT_STELLAR_SECRET_KEY or PAYGATE_TREASURY_SECRET_KEY");
  }

  const server = new Horizon.Server(HORIZON_URL);
  
  // 1. Generate USDC issuer
  const issuerKp = Keypair.random();
  const issuerPub = issuerKp.publicKey();
  const issuerSecret = issuerKp.secret();
  console.log(`\n=== Step 1: Funding USDC Issuer ===`);
  console.log(`  Issuer pub:    ${issuerPub}`);
  console.log(`  Issuer secret: ${issuerSecret}`);
  await friendbot(issuerPub);

  const USDC = new Asset("USDC", issuerPub);

  // 2. Add trustlines + issue USDC to both wallets
  console.log(`\n=== Step 2: Trustlines + Minting ===`);
  await addTrustlineAndFund("Agent   ", AGENT_SECRET, issuerKp, USDC, "1000", server);
  await addTrustlineAndFund("Treasury", TREASURY_SECRET, issuerKp, USDC, "10", server);

  // 3. Deploy the Stellar Asset Contract (SAC) for our USDC
  console.log(`\n=== Step 3: Deploying USDC Stellar Asset Contract (SAC) ===`);
  console.log("  Running: stellar contract asset deploy ...");
  
  // Save issuer secret to a temp file for stellar CLI
  const sacResult = execSync(
    `stellar contract asset deploy --asset USDC:${issuerPub} --network testnet --source deployer`,
    { cwd: process.cwd(), encoding: "utf-8" }
  ).trim();

  // The output is the contract ID
  const sacContractId = sacResult.split("\n").pop()?.trim() ?? sacResult.trim();
  console.log(`  ✅ SAC deployed: ${sacContractId}`);

  // 4. Print results
  console.log(`
=== DONE ===

Add these to apps/web/.env.local and apps/web/.env:

USDC_ISSUER_SECRET="${issuerSecret}"
SOROBAN_USDC_CONTRACT="${sacContractId}"

These replace USDC_TESTNET_ADDRESS in middleware.ts for your self-hosted testnet USDC.
`);

  // 5. Auto-update .env.local
  let envContent = fs.readFileSync("apps/web/.env.local", "utf-8");
  if (!envContent.includes("USDC_ISSUER_SECRET")) {
    envContent += `\nUSDC_ISSUER_SECRET="${issuerSecret}"\n`;
  }
  if (!envContent.includes("SOROBAN_USDC_CONTRACT")) {
    envContent += `SOROBAN_USDC_CONTRACT="${sacContractId}"\n`;
  }
  fs.writeFileSync("apps/web/.env.local", envContent);
  console.log("✅ Updated apps/web/.env.local automatically.");
}

main().catch((err) => {
  console.error("\n❌ Bootstrap failed:", err?.message ?? err);
  process.exit(1);
});
