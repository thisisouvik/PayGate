#!/usr/bin/env bash
# Build the receipt-verifier Soroban contract to WASM.
# Run from the repo root: ./contracts/scripts/build.sh
set -e

cd "$(dirname "$0")/../receipt-verifier"
echo "Building receipt-verifier contract..."
stellar contract build
echo "Done. WASM at: target/wasm32-unknown-unknown/release/receipt_verifier.wasm"
