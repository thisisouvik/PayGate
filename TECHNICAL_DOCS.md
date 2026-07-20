# PayGate — Technical Implementation Documentation
### Stack: Next.js · TypeScript · Tailwind · shadcn/ui · Redis (Upstash) · Neon Postgres · Prisma · Stellar / x402
### Budget: $0 — every service below is on a permanent free tier

---

## 1. What We're Actually Building

A single Next.js application that does three jobs at once:

1. **SDK/middleware layer** — a Next.js route wrapper (packaged as an installable npm module later) that turns any API route into an x402-paywalled, pay-per-call endpoint settled in USDC on Stellar.
2. **Dashboard** — a shadcn/ui admin panel where a developer sees earnings, callers, and live requests for their monetized routes.
3. **Directory** — a public page listing every API monetized through PayGate, for discovery.

Since you already know Next.js end-to-end, we run this as **one Next.js app** first (App Router, API routes double as the "resource server"), and only extract the SDK into its own npm package once the core flow is proven. That's the fastest path to a working demo and avoids managing multiple repos during the hackathon window.

---

## 2. Free-Tier Service Map

| Layer | Service | Free tier (verified 2026) | Why |
|---|---|---|---|
| Hosting | **Vercel** (Hobby) | Unlimited personal projects, generous serverless invocations | Native Next.js host, zero config |
| Database | **Neon** (Free plan) | 100 CU-hrs/project/month, 0.5 GB storage/project, up to 100 projects, scale-to-zero | Postgres, branch-per-feature, works great with Prisma |
| Cache / Rate limit | **Upstash Redis** (Free) | 256 MB, 500K commands/month, REST API (no TCP needed) | Perfect for serverless/Vercel — no persistent connections required |
| Blockchain | **Stellar Testnet** | Free, via Friendbot faucet | Zero-cost transaction testing before mainnet |
| Payment facilitator | **x402.org public facilitator** or **OpenZeppelin hosted facilitator (testnet)** | Free hosted verify/settle service | You don't need to run your own facilitator infra for MVP |
| Test stablecoin | **Circle USDC faucet (Stellar testnet)** | Free testnet USDC | Needed to simulate real payments |
| Auth (optional) | **Neon Auth** (bundled, free) or Stellar wallet-based auth | Free, built into Neon | Skip building your own auth system |

Nothing on this list requires a credit card to start.

---

## 3. High-Level Architecture

```
                         ┌─────────────────────────────────────────┐
                         │              Next.js App (Vercel)         │
                         │                                           │
   AI Agent / Client ───▶│  /api/x/[apiSlug]  ──▶ x402 middleware   │
   (pays per call)       │        │                    │            │
                         │        │           ┌─────────▼─────────┐ │
                         │        │           │ Facilitator client │ │
                         │        │           │ (verify/settle)    │ │
                         │        │           └─────────┬─────────┘ │
                         │        ▼                     │            │
                         │  Protected handler            │            │
                         │  (developer's actual API)      │            │
                         │        │                       │            │
                         │        ▼                       ▼            │
                         │  Prisma ORM ──▶ Neon Postgres  Stellar RPC   │
                         │        │           (usage, users, APIs)     │
                         │        ▼                                    │
                         │  Upstash Redis (rate limits, live feed,     │
                         │                 cached analytics counters)  │
                         │                                           │
                         │  /dashboard  (shadcn/ui, reads Prisma+Redis)│
                         │  /directory  (public, reads Prisma)        │
                         └─────────────────────┬─────────────────────┘
                                                │
                                     ┌──────────▼──────────┐
                                     │  x402 Facilitator     │
                                     │ (hosted, free tier)   │
                                     │  verify + settle on   │
                                     │  Stellar (Soroban)    │
                                     └──────────┬──────────┘
                                                │
                                     ┌──────────▼──────────┐
                                     │   Stellar Network     │
                                     │  (Testnet → Mainnet)  │
                                     └───────────────────────┘
```

Key architectural decision: **don't build your own facilitator or Soroban contract for the MVP.** Stellar's ecosystem already ships a hosted, free x402 facilitator (built on the OpenZeppelin Relayer framework) that exposes `/verify`, `/settle`, and `/supported` endpoints and handles fee sponsorship for you. Building a custom Soroban receipt-verifier is a real Phase-2 differentiator, but it isn't required to get a working, on-chain, real-money(testnet) demo live.

---

## 4. Monorepo / Project Structure

You can start as a single app and evolve into a monorepo. Recommended layout from day one (using plain npm workspaces — free, no tooling to buy):

```
paygate/
├── apps/
│   └── web/                      # the Next.js app (dashboard + directory + API host)
│       ├── src/
│       │   ├── app/
│       │   │   ├── api/
│       │   │   │   └── x/[slug]/route.ts     # generic x402-protected proxy route
│       │   │   ├── dashboard/
│       │   │   │   ├── page.tsx
│       │   │   │   ├── earnings/page.tsx
│       │   │   │   ├── callers/page.tsx
│       │   │   │   └── settings/page.tsx
│       │   │   ├── directory/
│       │   │   │   └── page.tsx
│       │   │   └── layout.tsx
│       │   ├── components/ui/     # shadcn components
│       │   ├── lib/
│       │   │   ├── prisma.ts
│       │   │   ├── redis.ts
│       │   │   ├── x402/
│       │   │   │   ├── facilitator.ts
│       │   │   │   ├── middleware.ts
│       │   │   │   └── pricing.ts
│       │   │   └── stellar/
│       │   │       └── signer.ts
│       │   └── server/
│       │       └── actions/       # server actions for dashboard mutations
│       ├── prisma/
│       │   └── schema.prisma
│       └── package.json
├── packages/
│   └── sdk/                       # extracted later as @paygate/stellar
│       ├── src/index.ts
│       └── package.json
├── contracts/                     # Soroban smart contracts (Rust) — deployed on-chain
│   ├── receipt-verifier/
│   │   ├── src/
│   │   │   └── lib.rs
│   │   ├── Cargo.toml
│   │   └── Makefile
│   ├── Cargo.toml                 # Rust workspace root, for adding more contracts later
│   ├── .env.contracts             # deployed contract IDs per network (testnet/mainnet)
│   └── scripts/
│       ├── build.sh
│       ├── deploy-testnet.sh
│       └── deploy-mainnet.sh
└── package.json
```

**Why `contracts/` sits outside `apps/` and `packages/`:** it's a Rust/Cargo project, not a JS one, so it has its own toolchain and build graph — your Next.js app never compiles it. Once deployed, the app only ever talks to it by its contract ID (a `C...` address) over RPC, the same way it talks to any on-chain resource. Keeping contracts as a sibling directory is the standard layout for Stellar full-stack repos: Rust on one side, TypeScript on the other, connected only through an RPC endpoint and a contract ID stored in env.

---

## 5. Database Schema (Prisma + Neon)

Neon's free tier gives you 0.5 GB per project and scale-to-zero compute, which is more than enough for a hackathon MVP and early production traffic.

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")       // Neon pooled connection string
  directUrl = env("DIRECT_URL")         // Neon direct connection, used for migrations
}

model Developer {
  id            String   @id @default(cuid())
  stellarWallet String   @unique          // G... public key, used as login identity
  email         String?  @unique
  createdAt     DateTime @default(now())
  apis          Api[]
}

model Api {
  id              String   @id @default(cuid())
  developer       Developer @relation(fields: [developerId], references: [id])
  developerId     String
  slug            String   @unique         // used in /api/x/[slug]
  name            String
  description     String?
  targetUrl       String                   // the developer's real backend (proxied)
  priceUsdc       Decimal                  // e.g. 0.002
  isListed        Boolean  @default(false) // shown in public directory
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  calls           ApiCall[]
}

model ApiCall {
  id            String   @id @default(cuid())
  api           Api      @relation(fields: [apiId], references: [id])
  apiId         String
  callerWallet  String                     // paying agent's Stellar address
  amountUsdc    Decimal
  txHash        String   @unique           // Stellar transaction hash (audit trail)
  network       String   @default("testnet") // "testnet" | "pubnet"
  status        String                     // "settled" | "failed"
  latencyMs     Int?
  createdAt     DateTime @default(now())

  @@index([apiId, createdAt])
  @@index([callerWallet])
}
```

Set this up:

```bash
cd apps/web
npx prisma init
# paste schema above
npx prisma migrate dev --name init
npx prisma generate
```

Neon connection strings (get both from the Neon dashboard — one pooled, one direct):

```
DATABASE_URL="postgresql://<user>:<pass>@<host>-pooler.neon.tech/paygate?sslmode=require"
DIRECT_URL="postgresql://<user>:<pass>@<host>.neon.tech/paygate?sslmode=require"
```

Use the pooled URL (`DATABASE_URL`) in the app for regular queries (works well on Vercel's serverless functions), and the direct URL only for running migrations.

---

## 6. Redis (Upstash) — What It's Actually For

Upstash's free tier (256 MB, 500K commands/month, REST-based — no persistent TCP connection needed) is exactly right for a serverless Next.js app on Vercel. Use it for three things, not as your source of truth:

1. **Rate limiting** each API route against abuse before it even reaches the paywall logic.
2. **Live request feed** on the dashboard — push the last ~50 calls per API into a Redis list for instant reads, instead of hammering Postgres for a "live" view.
3. **Cached rollups** — today's/this-week's earnings per API, recomputed periodically, so the dashboard doesn't recompute aggregates from `ApiCall` on every page load.

```ts
// src/lib/redis.ts
import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
```

```ts
// src/lib/ratelimit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./redis";

// 20 requests / 10s per caller wallet — tune per API later
export const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "10 s"),
});
```

```ts
// live feed push, called after a settled call
await redis.lpush(`feed:${apiId}`, JSON.stringify({ callerWallet, amountUsdc, ts: Date.now() }));
await redis.ltrim(`feed:${apiId}`, 0, 49); // keep last 50
```

`@upstash/redis` and `@upstash/ratelimit` are both free, MIT-licensed npm packages built specifically for edge/serverless environments — no extra infra to run.

---

## 7. The x402 Payment Flow on Stellar (Core Piece)

### 7.1 Packages

```bash
npm install @stellar/stellar-sdk @x402/core @x402/stellar
```

(`@x402/express` isn't needed since we're on Next.js, not Express — we call the lower-level `@x402/core` primitives directly inside a Next.js route handler, following the same pattern the Express middleware uses internally.)

### 7.2 Facilitator configuration

Don't self-host a facilitator for the MVP. Point at a hosted one:

```ts
// src/lib/x402/facilitator.ts
import { HTTPFacilitatorClient } from "@x402/core/server";

// Free public facilitator — good for early testing
export const facilitatorTestnet = new HTTPFacilitatorClient({
  url: "https://www.x402.org/facilitator",
});

// Or the Stellar-native hosted facilitator (OpenZeppelin Relayer-based),
// which supports both testnet and mainnet:
export const facilitatorStellarTestnet = new HTTPFacilitatorClient({
  url: "https://channels.openzeppelin.com/x402/testnet",
});
```

### 7.3 The paywall route

This is the actual "3 lines of code to monetize an API" promise, implemented as a generic proxy route so any developer's `targetUrl` can be wrapped without writing custom server code:

```ts
// src/app/api/x/[slug]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { ExactStellarScheme } from "@x402/stellar/exact/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { ratelimit } from "@/lib/ratelimit";
import { facilitatorStellarTestnet } from "@/lib/x402/facilitator";

const scheme = new ExactStellarScheme();

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const api = await prisma.api.findUnique({ where: { slug: params.slug, isActive: true } });
  if (!api) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const paymentSig = req.headers.get("PAYMENT-SIGNATURE");

  if (!paymentSig) {
    // Step 1: tell the caller what to pay and how
    return NextResponse.json(
      {
        price: `$${api.priceUsdc}`,
        network: "stellar:testnet",
        facilitator: "https://channels.openzeppelin.com/x402/testnet",
        payTo: process.env.PAYGATE_TREASURY_WALLET,
      },
      { status: 402 }
    );
  }

  // basic abuse protection before we touch the facilitator or origin API
  const identityKey = req.headers.get("X-Caller-Wallet") ?? "anonymous";
  const { success } = await ratelimit.limit(identityKey);
  if (!success) return NextResponse.json({ error: "Rate limited" }, { status: 429 });

  // Step 2: verify + settle the payment via the hosted facilitator
  const result = await scheme.verifyAndSettle(paymentSig, {
    facilitator: facilitatorStellarTestnet,
    expectedAmount: api.priceUsdc.toString(),
    payTo: process.env.PAYGATE_TREASURY_WALLET!,
  });

  if (!result.settled) {
    return NextResponse.json({ error: "Payment failed", detail: result.reason }, { status: 402 });
  }

  // Step 3: log the call (Postgres = source of truth, Redis = fast live feed)
  await prisma.apiCall.create({
    data: {
      apiId: api.id,
      callerWallet: identityKey,
      amountUsdc: api.priceUsdc,
      txHash: result.txHash,
      network: "testnet",
      status: "settled",
    },
  });
  await redis.lpush(`feed:${api.id}`, JSON.stringify({ callerWallet: identityKey, amountUsdc: api.priceUsdc, ts: Date.now() }));
  await redis.ltrim(`feed:${api.id}`, 0, 49);

  // Step 4: proxy to the developer's real API
  const upstream = await fetch(api.targetUrl, { headers: { "X-PayGate-Verified": "true" } });
  const data = await upstream.json();
  return NextResponse.json(data);
}
```

This is the whole "wrap an endpoint in a paywall" mechanic — a developer never touches this file; they just register `targetUrl` + `priceUsdc` through the dashboard, and PayGate's single dynamic route handles payment negotiation, verification, settlement, logging, and proxying for every registered API.

### 7.4 The client side (what an agent does to pay)

For your demo script / example agent:

```bash
npm install @x402/fetch
```

```ts
import { x402HTTPClient } from "@x402/fetch";
import { createEd25519Signer } from "@x402/stellar";

const signer = createEd25519Signer(process.env.AGENT_STELLAR_SECRET_KEY!, "stellar:testnet");
const client = new x402HTTPClient({ signer });

const res = await client.fetch("https://paygate.xyz/api/x/cricket-predictor");
const data = await res.json();
```

### 7.5 Getting testnet funds (all free)

1. Fund a Stellar testnet account: `https://friendbot.stellar.org/?addr=<G...>` (gives you testnet XLM instantly).
2. Get testnet USDC: use the Circle faucet, selecting the Stellar network, for the account you just funded.
3. Establish a USDC trustline on that account before you can receive/send it (standard Stellar SDK call — one transaction).

You now have a fully working, zero-cost, real-on-chain-testnet payment loop to demo.

---

## 7A. `/contracts` — The Soroban Receipt-Verifier Contract

This is the piece that lets you say "we deployed our own contract," rather than depending entirely on the hosted facilitator. It's a genuine differentiator (Section 12, Phase 6) — you can ship the MVP against the hosted facilitator first, then swap in this contract once it's deployed, without changing your Next.js route's public interface.

### 7A.1 Toolchain (all free, one-time local install)

```bash
# Rust itself
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# Stellar CLI (build, deploy, invoke contracts)
cargo install --locked stellar-cli --features opt

# Confirm
stellar --version
```

No paid accounts anywhere in this chain — the CLI, the compiler, and the network itself (testnet) are all free. Deploying to **mainnet** later costs only the network's actual transaction fee, which on Stellar is a fraction of a cent per deploy — not a subscription or infra cost.

### 7A.2 `contracts/receipt-verifier/Cargo.toml`

```toml
[package]
name = "receipt-verifier"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
soroban-sdk = "22.0.0"

[dev-dependencies]
soroban-sdk = { version = "22.0.0", features = ["testutils"] }

[profile.release]
opt-level = "z"
overflow-checks = true
debug = 0
strip = "symbols"
lto = true
codegen-units = 1
panic = "abort"
```

### 7A.3 `contracts/receipt-verifier/src/lib.rs`

A minimal, honest first version: it records a payment receipt on-chain (caller, api id, amount, timestamp) and rejects duplicate/replayed receipts. This is intentionally small — the goal is a working, auditable on-chain log you control, not a full reimplementation of the facilitator's settlement logic on day one.

```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Symbol, symbol_short};

#[contracttype]
#[derive(Clone)]
pub struct Receipt {
    pub caller: Address,
    pub api_id: String,
    pub amount: i128,
    pub timestamp: u64,
}

const RECEIPT_KEY: Symbol = symbol_short!("receipt");

#[contract]
pub struct ReceiptVerifier;

#[contractimpl]
impl ReceiptVerifier {
    /// Called by the facilitator/backend after a payment settles.
    /// `caller` must have authorized this invocation (require_auth),
    /// which is what prevents anyone but the paying wallet from writing a receipt.
    pub fn record_receipt(env: Env, caller: Address, api_id: String, amount: i128) -> u64 {
        caller.require_auth();

        let timestamp = env.ledger().timestamp();
        let key = (RECEIPT_KEY, caller.clone(), api_id.clone(), timestamp);

        if env.storage().persistent().has(&key) {
            panic!("duplicate receipt");
        }

        let receipt = Receipt { caller, api_id, amount, timestamp };
        env.storage().persistent().set(&key, &receipt);
        timestamp
    }

    /// Read-only check used by your Next.js backend to confirm a receipt exists
    /// before trusting a client's claim that it paid.
    pub fn has_receipt(env: Env, caller: Address, api_id: String, timestamp: u64) -> bool {
        let key = (RECEIPT_KEY, caller, api_id, timestamp);
        env.storage().persistent().has(&key)
    }
}
```

### 7A.4 Build, test, deploy — `contracts/scripts/`

```bash
# scripts/build.sh
#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/../receipt-verifier"
stellar contract build
```

```bash
# scripts/deploy-testnet.sh
#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/../receipt-verifier"

# One-time: create + fund a free testnet identity via Friendbot
stellar keys generate deployer --network testnet --fund

stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/receipt_verifier.wasm \
  --source deployer \
  --network testnet \
  > ../.env.contracts.testnet

echo "Deployed. Contract ID saved to contracts/.env.contracts.testnet"
```

```bash
# scripts/deploy-mainnet.sh
#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/../receipt-verifier"

# Requires a funded mainnet account (real, small amount of XLM for fees — not a subscription cost)
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/receipt_verifier.wasm \
  --source deployer \
  --network mainnet \
  > ../.env.contracts.mainnet

echo "Deployed to mainnet. Contract ID saved to contracts/.env.contracts.mainnet"
```

Run them:

```bash
chmod +x contracts/scripts/*.sh
./contracts/scripts/build.sh
./contracts/scripts/deploy-testnet.sh
```

The deploy script's output is a `C...` contract ID — put that in your Next.js app's env as `NEXT_PUBLIC_RECEIPT_VERIFIER_CONTRACT_ID` (or a server-only var if you don't need client-side reads), and call it from `src/lib/stellar/` using `@stellar/stellar-sdk`'s `Contract` client the same way you'd call any Soroban contract from a Node backend.

### 7A.5 Tests (still free, run entirely locally)

```rust
// contracts/receipt-verifier/src/test.rs
#![cfg(test)]
use super::*;
use soroban_sdk::testutils::Address as _;

#[test]
fn records_and_verifies_a_receipt() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(ReceiptVerifier, ());
    let client = ReceiptVerifierClient::new(&env, &contract_id);

    let caller = Address::generate(&env);
    let api_id = String::from_str(&env, "cricket-predictor");

    let ts = client.record_receipt(&caller, &api_id, &2_000_000i128); // $0.002 in 7-decimal base units
    assert!(client.has_receipt(&caller, &api_id, &ts));
}
```

```bash
cd contracts/receipt-verifier
cargo test
```

### 7A.6 How this plugs into the flow from Section 7.3

Two integration options, pick based on how much you want to depend on the hosted facilitator:

- **Light integration (recommended to start):** keep using the hosted facilitator for verify/settle exactly as in Section 7.3, and *additionally* call `record_receipt` right after a successful settlement, purely as your own on-chain audit log. Zero risk to the working payment flow — this is pure addition.
- **Full integration (Phase 6 / post-MVP):** replace the hosted facilitator's verify step with a call to `has_receipt` against your own contract, meaning your contract becomes the source of truth for "was this paid." This is the real differentiator, but only attempt it once the light integration is solid and demoed — it's meaningfully more work and you don't want to block your first working demo on it.

---

## 8. Dashboard (shadcn/ui)

Scaffold once:

```bash
npx shadcn@latest init
npx shadcn@latest add card table tabs chart badge button dialog input
```

Pages to build, in priority order:

| Page | Purpose | Data source |
|---|---|---|
| `/dashboard` | Overview: today's earnings, total calls, active APIs | Prisma aggregate + Redis cached rollup |
| `/dashboard/apis` | List + create/edit monetized APIs (slug, targetUrl, price) | Prisma CRUD via server actions |
| `/dashboard/apis/[id]` | Per-API detail: earnings chart, top callers, live feed | Prisma + Redis list (`feed:{apiId}`) |
| `/dashboard/settings` | Wallet, payout address, pricing defaults | Prisma |

Use **Server Actions** (native to Next.js App Router) instead of hand-rolled API routes for all dashboard mutations — no extra backend framework needed, keeps everything inside one Next.js app, and it's free/built-in.

Earnings chart: use `recharts` (already common with shadcn examples) fed by a Prisma `groupBy` query on `ApiCall.createdAt` bucketed by day.

Live feed component: poll `/api/internal/feed/[apiId]` every 3–5 seconds, which just does `redis.lrange(\`feed:${apiId}\`, 0, 49)` — cheap, fast, and doesn't touch Postgres at all for the "live" experience.

---

## 9. Public API Directory

A simple public route, no auth required:

```ts
// app/directory/page.tsx (Server Component)
const apis = await prisma.api.findMany({
  where: { isListed: true, isActive: true },
  select: { slug: true, name: true, description: true, priceUsdc: true },
});
```

Render as a searchable shadcn `Table` or card grid. This is the long-term discovery moat — keep it dead simple for now (list + price + one-line description + a "try it" curl snippet), and iterate later with categories, ratings, or featured slots (your $49/month monetization lever from the business model).

---

## 10. Wallet-Based "Login"

Skip building a password/email auth system. A developer's identity in PayGate is their Stellar wallet address:

1. Developer connects a Stellar wallet (Freighter, xBull, or any SEP-43-compatible wallet — all free browser extensions) on the dashboard's landing page.
2. They sign a short challenge message to prove ownership (standard "sign this nonce" pattern).
3. You look up or create a `Developer` row keyed on `stellarWallet`, and issue a normal Next.js session (e.g. via `iron-session` or `next-auth`'s Credentials provider) — both free, open source.

This avoids Stripe-style KYC entirely and fits the "no accounts" ethos of the product itself.

---

## 11. Environment Variables

```bash
# .env.local
DATABASE_URL=            # Neon pooled connection string
DIRECT_URL=               # Neon direct connection string (migrations only)

UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

PAYGATE_TREASURY_WALLET=  # your G... address that collects the 0.5% protocol fee split
STELLAR_NETWORK=testnet   # switch to pubnet at launch

AGENT_STELLAR_SECRET_KEY= # only needed in your demo/agent script, never in the server app
```

---

## 12. Phase-Wise Build Plan

### Phase 0 — Environment (half a day)
- Create Neon project, Upstash Redis database, Vercel project (all free sign-ups, no card).
- Scaffold Next.js + TypeScript + Tailwind + shadcn.
- Wire up Prisma against Neon, run the initial migration.
- Fund two Stellar testnet accounts (developer + agent) via Friendbot, get testnet USDC via the Circle faucet, add USDC trustlines.
- Install the Rust + Soroban CLI toolchain (Section 7A.1) and confirm `stellar contract build` runs — do this early since first-time Rust/wasm toolchain installs occasionally hit environment quirks, and you don't want to discover that on Day 3.

### Phase 1 — Core Paywall Loop (Day 1)
- Build the `/api/x/[slug]` route exactly as in Section 7.3, pointed at the public testnet facilitator.
- Write a standalone script (`scripts/demo-agent.ts`) using `@x402/fetch` that calls a seeded `Api` row end-to-end: gets a 402, pays, gets a 200.
- Confirm the transaction on Stellar's testnet explorer — this is your first real milestone.

### Phase 2 — Data Layer + Logging (Day 1–2)
- Add `ApiCall` logging on every settled payment.
- Add Redis rate limiting and the live-feed list.
- Seed 2–3 demo `Api` rows (a weather API, a price-feed API) pointing at simple mock backends you also deploy on Vercel.

### Phase 3 — Dashboard (Day 2–3)
- Build `/dashboard` overview, `/dashboard/apis` CRUD, and the per-API detail page with the live feed and earnings chart.
- Wire wallet-based session auth.

### Phase 4 — Public Directory (Day 3)
- Build `/directory` listing all `isListed` APIs.
- Add a "try it" snippet per listing (curl + a copy of the client code from 7.4).

### Phase 5 — Demo Polish & Deploy (Day 4)
- Deploy to Vercel (free), confirm Neon + Upstash connections work in production.
- Run the full demo live against testnet (or mainnet if you're comfortable — Stellar mainnet fees are fractions of a cent, so this is realistic even on a free budget with a small amount of real USDC).
- Record the walkthrough: agent hits endpoint → 402 → pays → 200 → dashboard updates in real time.

### Phase 6 — Post-Hackathon Hardening (optional, ongoing)
- Extract `packages/sdk` into a real `@paygate/stellar` npm package so external developers can `npm install` it directly instead of only using PayGate's hosted proxy route.
- Deploy the `contracts/receipt-verifier` contract to testnet (Section 7A.4) and wire it in as the **light integration** (on-chain audit log alongside the hosted facilitator) — low risk, real "we have a deployed contract" story for judges.
- Once that's stable, consider the **full integration** — your contract becomes the source of truth for payment verification instead of the hosted facilitator. Deploy to mainnet only after this is well tested on testnet; mainnet deploys cost a small, one-time real XLM fee, not a subscription.
- Add the Pro Dashboard tier and directory-listing billing described in the business model — these can themselves be sold *through* your own x402 paywall, which is a nice demo-able bit of dogfooding.

---

## 13. Cost Reality Check

At hackathon and early-production scale, every piece of this stays inside free tiers:

- **Neon**: 100 CU-hours/month with scale-to-zero comfortably covers a low-traffic app; storage stays well under 0.5 GB for a schema this small until you have real volume.
- **Upstash**: 500K commands/month is generous for rate-limit checks + feed pushes at anything under a few requests/second sustained.
- **Vercel Hobby**: fine for a personal/demo deployment; move to a paid team plan only once you commercialize with a team.
- **Stellar testnet**: entirely free, unlimited faucet funds for development.
- **Facilitator**: the hosted public/OpenZeppelin facilitators are free to use; you only take on cost if you later choose to self-host one.

The only real dollar cost in this entire plan, if you go live on mainnet, is the actual USDC being transacted by real users — which is the point of the product, not an infrastructure cost.

---

## 14. Quick Reference — Install Commands

```bash
# core app
npx create-next-app@latest paygate --typescript --tailwind --app
cd paygate
npx shadcn@latest init

# data layer
npm install prisma @prisma/client
npm install @upstash/redis @upstash/ratelimit

# stellar / x402
npm install @stellar/stellar-sdk @x402/core @x402/stellar @x402/fetch

# auth (pick one)
npm install next-auth
# or
npm install iron-session
```

---

## 15. Testing Strategy — Contract, API, and End-to-End

You actually need four separate layers of tests here, because you have two different runtimes (Rust/Soroban and Node/Next.js) plus real network calls to Stellar. Don't try to test all of it with one tool — each layer has a natural, free way to test it.

### 15.1 Layer 1 — Soroban contract unit tests (fast, no network, run constantly)

This is the cheapest, fastest test loop you have — pure Rust, no testnet, no faucet, runs in-memory. Expand the single test from Section 7A.5 into a real suite covering the behaviors that actually matter:

```rust
// contracts/receipt-verifier/src/test.rs
#![cfg(test)]
use super::*;
use soroban_sdk::testutils::Address as _;

fn setup() -> (Env, ReceiptVerifierClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(ReceiptVerifier, ());
    let client = ReceiptVerifierClient::new(&env, &contract_id);
    (env, client)
}

#[test]
fn records_and_verifies_a_receipt() {
    let (env, client) = setup();
    let caller = Address::generate(&env);
    let api_id = String::from_str(&env, "cricket-predictor");

    let ts = client.record_receipt(&caller, &api_id, &2_000_000i128);
    assert!(client.has_receipt(&caller, &api_id, &ts));
}

#[test]
#[should_panic(expected = "duplicate receipt")]
fn rejects_duplicate_receipt_in_same_ledger() {
    let (env, client) = setup();
    let caller = Address::generate(&env);
    let api_id = String::from_str(&env, "cricket-predictor");

    client.record_receipt(&caller, &api_id, &2_000_000i128);
    client.record_receipt(&caller, &api_id, &2_000_000i128); // same timestamp -> should panic
}

#[test]
fn has_receipt_returns_false_for_unknown_call() {
    let (env, client) = setup();
    let caller = Address::generate(&env);
    let api_id = String::from_str(&env, "unknown-api");

    assert!(!client.has_receipt(&caller, &api_id, &0u64));
}

#[test]
#[should_panic] // require_auth fails without mock_all_auths for this specific caller
fn rejects_receipt_without_caller_authorization() {
    let env = Env::default(); // no mock_all_auths() here — auth is NOT mocked
    let contract_id = env.register(ReceiptVerifier, ());
    let client = ReceiptVerifierClient::new(&env, &contract_id);
    let caller = Address::generate(&env);
    let api_id = String::from_str(&env, "cricket-predictor");

    client.record_receipt(&caller, &api_id, &2_000_000i128); // should panic: no auth
}
```

Run them constantly during development:

```bash
cd contracts/receipt-verifier
cargo test              # fast, in-memory, no network — run this after every change
cargo test -- --nocapture   # if you need to see println! output for debugging
```

### 15.2 Layer 2 — Contract testnet smoke test (real network, still free)

Once unit tests pass, confirm the *deployed* contract actually behaves the same way on real testnet infrastructure — this catches things unit tests can't, like environment or serialization mismatches:

```bash
# after deploy-testnet.sh has run and you have a contract ID
stellar contract invoke \
  --id <CONTRACT_ID_FROM_.env.contracts.testnet> \
  --source deployer \
  --network testnet \
  -- record_receipt \
  --caller <CALLER_G_ADDRESS> \
  --api_id "cricket-predictor" \
  --amount 2000000

stellar contract invoke \
  --id <CONTRACT_ID> \
  --source deployer \
  --network testnet \
  -- has_receipt \
  --caller <CALLER_G_ADDRESS> \
  --api_id "cricket-predictor" \
  --timestamp <TS_FROM_PREVIOUS_CALL>
# should print: true
```

Do this once per deploy, not on every code change — it costs a (free, testnet) transaction each time, so it's a smoke test, not your main loop.

### 15.3 Layer 3 — Next.js API route tests (fast, mocked, run on every commit)

Install Vitest (free, works cleanly with Next.js route handlers since they're just exported functions):

```bash
npm install -D vitest @vitejs/plugin-react vitest-mock-extended
```

Mock Prisma, Redis, and the facilitator so these tests run in milliseconds with no real network or database calls — this is what you run on every save and in CI:

```ts
// src/app/api/x/[slug]/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { ratelimit } from "@/lib/ratelimit";

vi.mock("@/lib/prisma", () => ({
  prisma: { api: { findUnique: vi.fn() }, apiCall: { create: vi.fn() } },
}));
vi.mock("@/lib/ratelimit", () => ({ ratelimit: { limit: vi.fn() } }));
vi.mock("@/lib/redis", () => ({ redis: { lpush: vi.fn(), ltrim: vi.fn() } }));
vi.mock("@x402/stellar/exact/server", () => ({
  ExactStellarScheme: vi.fn().mockImplementation(() => ({
    verifyAndSettle: vi.fn(),
  })),
}));

function makeRequest(headers: Record<string, string> = {}) {
  return new Request("https://paygate.xyz/api/x/cricket-predictor", { headers }) as any;
}

describe("GET /api/x/[slug]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when the API slug doesn't exist", async () => {
    (prisma.api.findUnique as any).mockResolvedValue(null);
    const res = await GET(makeRequest(), { params: { slug: "does-not-exist" } });
    expect(res.status).toBe(404);
  });

  it("returns 402 with price info when no payment header is present", async () => {
    (prisma.api.findUnique as any).mockResolvedValue({ id: "1", priceUsdc: "0.002", isActive: true });
    const res = await GET(makeRequest(), { params: { slug: "cricket-predictor" } });
    const body = await res.json();
    expect(res.status).toBe(402);
    expect(body.price).toBe("$0.002");
  });

  it("returns 429 when the caller is rate limited", async () => {
    (prisma.api.findUnique as any).mockResolvedValue({ id: "1", priceUsdc: "0.002", isActive: true });
    (ratelimit.limit as any).mockResolvedValue({ success: false });
    const res = await GET(
      makeRequest({ "PAYMENT-SIGNATURE": "sig", "X-Caller-Wallet": "GABC..." }),
      { params: { slug: "cricket-predictor" } }
    );
    expect(res.status).toBe(429);
  });

  it("logs the call and returns 200 after a settled payment", async () => {
    (prisma.api.findUnique as any).mockResolvedValue({
      id: "1", priceUsdc: "0.002", isActive: true, targetUrl: "https://example.com/mock",
    });
    (ratelimit.limit as any).mockResolvedValue({ success: true });
    global.fetch = vi.fn().mockResolvedValue({ json: async () => ({ ok: true }) }) as any;

    // ...mock verifyAndSettle to resolve { settled: true, txHash: "abc123" } here

    const res = await GET(
      makeRequest({ "PAYMENT-SIGNATURE": "sig", "X-Caller-Wallet": "GABC..." }),
      { params: { slug: "cricket-predictor" } }
    );
    expect(res.status).toBe(200);
    expect(prisma.apiCall.create).toHaveBeenCalledOnce();
  });
});
```

Run it:

```bash
npx vitest run          # single run, e.g. for CI
npx vitest               # watch mode while developing
```

This is your main safety net — it should run in under a couple of seconds and needs zero external services, so you can run it dozens of times a day without touching your free-tier quotas at all.

### 15.4 Layer 4 — Real end-to-end test (slow, uses real testnet, run before every demo/deploy)

This is the one that actually proves the whole loop works, using real testnet Stellar accounts and the real hosted facilitator — not mocks. Keep it as a separate script, not part of your fast test suite, since it's genuinely slow (real network round trips) and depends on external services being up.

```ts
// scripts/e2e-demo.ts
import { x402HTTPClient } from "@x402/fetch";
import { createEd25519Signer } from "@x402/stellar";

async function main() {
  const signer = createEd25519Signer(process.env.AGENT_STELLAR_SECRET_KEY!, "stellar:testnet");
  const client = new x402HTTPClient({ signer });

  console.log("Calling paywalled endpoint...");
  const res = await client.fetch("http://localhost:3000/api/x/cricket-predictor");

  if (res.status !== 200) {
    throw new Error(`Expected 200 after payment, got ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  console.log("Success — got data after paying:", data);
}

main().catch((err) => {
  console.error("E2E demo failed:", err);
  process.exit(1);
});
```

```bash
npm run dev                       # in one terminal
npx tsx scripts/e2e-demo.ts       # in another
```

Run this before every demo and before every deploy to production — it's your proof that the 402 → pay → 200 loop is actually alive right now, not just passing mocks.

### 15.5 Isolating test data (Neon branching + a second Upstash database — both free)

Don't test against your real dev/prod Postgres or Redis. Both providers let you spin up an isolated copy for free:

- **Neon**: create a branch (`neondb_test`) from your main project — instant, copy-on-write, and free within the same 100 CU-hour/0.5 GB allowance. Point `DATABASE_URL` at the branch only while running tests, e.g. via a `.env.test` file.
- **Upstash**: the free tier allows up to 10 databases at no cost — create a second `paygate-test` Redis instance and point `UPSTASH_REDIS_REST_URL`/`TOKEN` at it in `.env.test`, so rate-limit and feed tests never touch your real counters.

```bash
# .env.test
DATABASE_URL="postgresql://.../neondb_test?sslmode=require"
UPSTASH_REDIS_REST_URL="https://<test-instance>.upstash.io"
UPSTASH_REDIS_REST_TOKEN="..."
```

### 15.6 Test case checklist

A concrete list to work through — treat this as your actual test plan, not just the code above:

| # | Behavior | Layer |
|---|---|---|
| 1 | Unknown slug returns 404 | Route (mocked) |
| 2 | No payment header returns 402 with correct price/facilitator/payTo | Route (mocked) |
| 3 | Invalid/garbage payment signature is rejected, not silently accepted | Route (mocked) + E2E |
| 4 | A caller over the rate limit gets 429, not 402/200 | Route (mocked) |
| 5 | A valid settled payment returns 200 and the proxied developer data | Route (mocked) + E2E |
| 6 | A settled payment creates exactly one `ApiCall` row with the right `txHash` | Route (mocked) |
| 7 | A settled payment pushes exactly one entry onto the Redis feed and trims to 50 | Route (mocked) |
| 8 | Contract rejects a second `record_receipt` for the same caller/api/timestamp | Contract unit test |
| 9 | Contract rejects `record_receipt` without the caller's authorization | Contract unit test |
| 10 | `has_receipt` returns `false` for a receipt that was never written | Contract unit test |
| 11 | Deployed contract on testnet behaves the same as the unit tests predict | Contract smoke test |
| 12 | Directory page only ever lists APIs with `isListed = true` | Route/page test |
| 13 | Dashboard earnings total matches the sum of `ApiCall.amountUsdc` for that API | Route/page test |
| 14 | Full agent script gets a real 402, pays on testnet, gets a real 200 | E2E script |

### 15.7 Optional: free CI (GitHub Actions)

GitHub Actions gives public and personal repos a generous free monthly minutes allowance, which is enough to run Layers 1 and 3 (the fast, mocked ones) on every push, without ever touching real testnet or your Neon/Upstash quotas:

```yaml
# .github/workflows/test.yml
name: test
on: [push, pull_request]
jobs:
  contract-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with: { targets: wasm32-unknown-unknown }
      - run: cd contracts/receipt-verifier && cargo test

  app-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm install
      - run: npx vitest run
```

Keep the real end-to-end script (15.4) as a manual step you run yourself before a demo or deploy — it depends on live testnet infra being up, so it's not a great candidate for blocking every single CI run.

---

---

This documentation gives you everything needed to start Phase 0 today — Neon and Upstash sign-ups, Stellar testnet funding, and the first paywalled route are all things you can have working before the end of a single sitting. Run the Layer 1 and Layer 3 tests (Sections 15.1 and 15.3) as you build each piece, and save the full end-to-end script (15.4) for whenever you're about to demo or deploy.