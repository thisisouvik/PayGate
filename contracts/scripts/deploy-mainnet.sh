#!/usr/bin/env bash
# Deploy the receipt-verifier contract to Stellar MAINNET.
# Requires a funded mainnet account (a small amount of real XLM for the one-time deploy fee).
# Run AFTER build.sh and AFTER thorough testnet testing.
# Run from the repo root: ./contracts/scripts/deploy-mainnet.sh
set -e

cd "$(dirname "$0")/../receipt-verifier"

echo "Deploying to mainnet..."
echo "⚠️  This uses real XLM for the transaction fee. Ensure your 'deployer' key is funded on mainnet."

CONTRACT_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/receipt_verifier.wasm \
  --source deployer \
  --network mainnet)

echo "CONTRACT_ID=$CONTRACT_ID" > ../.env.contracts.mainnet
echo ""
echo "✅ Deployed to mainnet. Contract ID: $CONTRACT_ID"
echo "   Saved to contracts/.env.contracts.mainnet"
echo ""
echo "Add to apps/web/.env.local (production):"
echo "  RECEIPT_VERIFIER_CONTRACT_ID=$CONTRACT_ID"
