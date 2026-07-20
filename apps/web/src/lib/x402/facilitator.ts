// src/lib/x402/facilitator.ts
// Connects to the hosted x402 facilitator that handles verify + settle
// against the Stellar network on our behalf.
//
// In v2.x: HTTPFacilitatorClient is in @x402/core/http (not @x402/core/server).
// Constructor takes a plain URL string.

import { HTTPFacilitatorClient } from "@x402/core/http";

const FACILITATOR_TESTNET = "https://channels.openzeppelin.com/x402/testnet";
const FACILITATOR_MAINNET = "https://channels.openzeppelin.com/x402/mainnet";

/**
 * URL of the active facilitator — driven by STELLAR_NETWORK env var.
 * Switch to "pubnet" in .env to go live on mainnet.
 */
export const FACILITATOR_URL =
  process.env.STELLAR_NETWORK === "pubnet"
    ? FACILITATOR_MAINNET
    : FACILITATOR_TESTNET;

/**
 * Configured facilitator client.
 * Used in /api/x/[slug] to call facilitator.verify() + facilitator.settle().
 */
export const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
