#!/usr/bin/env bash
# Deploy the receipt-verifier contract to Stellar TESTNET (free).
# Run AFTER build.sh has produced the WASM.
# Run from the repo root: ./contracts/scripts/deploy-testnet.sh
set -e

cd "$(dirname "$0")/../receipt-verifier"

echo "Generating + funding testnet deployer identity via Friendbot..."
# --fund calls Friendbot automatically — free, testnet only
stellar keys generate deployer --network testnet --fund

echo "Deploying to testnet..."
CONTRACT_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/receipt_verifier.wasm \
  --source deployer \
  --network testnet)

echo "CONTRACT_ID=$CONTRACT_ID" > ../.env.contracts.testnet
echo ""
echo "✅ Deployed. Contract ID: $CONTRACT_ID"
echo "   Saved to contracts/.env.contracts.testnet"
echo ""
echo "Add to apps/web/.env.local:"
echo "  RECEIPT_VERIFIER_CONTRACT_ID=$CONTRACT_ID"
