// scripts/e2e-demo.ts
// Full end-to-end demo — runs a real x402 payment on Stellar testnet.
// Usage (from repo root):  npx tsx scripts/e2e-demo.ts
//
// Prerequisites:
//   1. apps/web dev server running:  npm run dev  (inside apps/web/)
//   2. AGENT_STELLAR_SECRET_KEY set in env
//   3. Agent account funded with testnet XLM + USDC trustline established

import { x402HTTPClient } from "@x402/fetch";
import { createEd25519Signer } from "@x402/stellar";

const BASE_URL = process.env.PAYGATE_URL ?? "http://localhost:3000";
const AGENT_SECRET = process.env.AGENT_STELLAR_SECRET_KEY;
const SLUG = process.env.API_SLUG ?? "demo-weather";

async function main() {
  if (!AGENT_SECRET) {
    throw new Error(
      "AGENT_STELLAR_SECRET_KEY is not set.\n" +
        "Export it in your shell before running this script."
    );
  }

  const network = process.env.STELLAR_NETWORK === "pubnet"
    ? "stellar:pubnet"
    : "stellar:testnet";

  const signer = createEd25519Signer(AGENT_SECRET, network as any);
  const client = new x402HTTPClient({ signer });

  console.log(`\n🚀 Calling paywalled endpoint: ${BASE_URL}/api/x/${SLUG}`);
  console.log("   Expecting: 402 → auto-pay → 200...\n");

  const res = await client.fetch(`${BASE_URL}/api/x/${SLUG}`);

  if (res.status !== 200) {
    const text = await res.text();
    throw new Error(`Expected 200, got ${res.status}:\n${text}`);
  }

  const data = await res.json();
  console.log("✅ Payment settled. API response:");
  console.log(JSON.stringify(data, null, 2));
  console.log("\nVerify on Stellar testnet explorer:");
  console.log("  https://stellar.expert/explorer/testnet");
}

main().catch((err) => {
  console.error("\n❌ E2E demo failed:", err.message);
  process.exit(1);
});
