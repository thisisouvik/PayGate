import { PublicNav } from "@/components/PublicNav";
import { Shield, Zap, Coins, KeyRound } from "lucide-react";

export const metadata = {
  title: "Developer Guide — PayGate",
  description: "Learn how PayGate uses x402 and Stellar to solve API monetization.",
};

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-[#080810] text-zinc-50 font-sans">
      <PublicNav />
      
      <main className="max-w-4xl mx-auto px-4 pt-32 pb-24 space-y-16">
        
        {/* Header */}
        <section className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-300 mb-2">
            Protocol Overview
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-br from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            The Future of API Monetization
          </h1>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            How x402 and Stellar micro-payments eliminate API keys, subscriptions, and billing platforms.
          </p>
        </section>

        <hr className="border-zinc-800/50" />

        {/* The Problem */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 text-red-400 mb-2">
            <KeyRound className="w-6 h-6" />
            <h2 className="text-2xl font-bold text-zinc-100">The Problem: API Keys & Subscriptions</h2>
          </div>
          <div className="prose prose-invert prose-zinc max-w-none text-zinc-300">
            <p className="text-lg">
              Today, monetizing an API is a massive engineering headache. Developers have to:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-4 marker:text-zinc-600">
              <li>Integrate heavy payment processors (like Stripe).</li>
              <li>Build user management systems to issue and rotate API keys.</li>
              <li>Track usage quotas, handle rate limiting, and manage monthly billing cycles.</li>
              <li>Force consumers to put down a credit card and commit to a monthly subscription, even if they only need to make a few calls.</li>
            </ul>
            <p className="mt-6 text-lg">
              For AI Agents, this model is completely broken. An autonomous agent traversing the web cannot sign up for 15 different subscriptions and manage 15 different API keys just to complete a task.
            </p>
          </div>
        </section>

        {/* The Solution */}
        <section className="space-y-6 bg-zinc-900/30 border border-zinc-800 rounded-3xl p-8 md:p-10">
          <div className="flex items-center gap-3 text-teal-400 mb-2">
            <Zap className="w-6 h-6" />
            <h2 className="text-2xl font-bold text-zinc-100">The Solution: x402 Protocol</h2>
          </div>
          <div className="prose prose-invert prose-zinc max-w-none text-zinc-300">
            <p className="text-lg leading-relaxed">
              <strong>HTTP 402 Payment Required</strong> was defined in 1999 as a standard status code for digital payments, but it was never implemented because internet money didn&apos;t exist yet. 
            </p>
            <p className="text-lg leading-relaxed mt-4">
              <strong>x402</strong> brings it to life. It is an open protocol that standardizes how clients and servers negotiate payments over HTTP. When a client requests a resource, the server replies with a `402` and a `Payment-Required` header detailing the price and destination wallet.
            </p>
            <p className="text-lg leading-relaxed mt-4">
              The client (or their wallet) automatically signs a transaction for that exact amount, attaches the cryptographic signature in a `Payment-Signature` header, and retries the request. The server verifies the signature, broadcasts it to the blockchain, and returns the requested data.
            </p>
          </div>
        </section>

        {/* How PayGate Fits In */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 text-violet-400 mb-2">
            <Shield className="w-6 h-6" />
            <h2 className="text-2xl font-bold text-zinc-100">Why PayGate?</h2>
          </div>
          <div className="prose prose-invert prose-zinc max-w-none text-zinc-300">
            <p className="text-lg">
              Building the x402 flow from scratch requires blockchain expertise. You need to write smart contracts to settle payments and run heavy infrastructure to verify Ed25519 signatures on every request.
            </p>
            <p className="text-lg mt-4 text-white font-medium">
              PayGate is a turnkey, hosted proxy that does it all for you.
            </p>
            
            <div className="grid md:grid-cols-2 gap-6 mt-8">
              <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-2xl">
                <h3 className="text-violet-300 font-semibold mb-2">For Developers</h3>
                <p className="text-sm leading-relaxed">
                  Register your existing free API endpoint on PayGate, set a price in USDC, and you instantly get a paywalled `paygate.xyz/api/x/...` endpoint. We handle the `402` negotiation, verify the signatures, settle the Stellar transactions, and proxy the clean request to your backend.
                </p>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-2xl">
                <h3 className="text-teal-300 font-semibold mb-2">For Callers & AI Agents</h3>
                <p className="text-sm leading-relaxed">
                  No signups, no API keys. You just wrap your standard `fetch()` call with the x402 client SDK. It intercepts `402` responses, automatically builds and signs the required Stellar micro-payment using your wallet, and completes the request seamlessly.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Powered by Stellar */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 text-zinc-400 mb-2">
            <Coins className="w-6 h-6" />
            <h2 className="text-2xl font-bold text-zinc-100">Powered by Stellar</h2>
          </div>
          <div className="prose prose-invert prose-zinc max-w-none text-zinc-300">
            <p className="text-lg leading-relaxed">
              PayGate utilizes the <strong>Stellar network</strong> and <strong>Soroban smart contracts</strong> because micro-payments require high throughput, immediate finality (under 5 seconds), and negligible fees (fractions of a cent).
            </p>
            <p className="text-lg leading-relaxed mt-4">
              Payments are settled in <strong>USDC</strong>, ensuring developers earn stable value rather than volatile cryptocurrencies. The entire flow happens on-chain, meaning developers have complete transparency and instant access to their earnings without relying on a centralized treasury.
            </p>
          </div>
        </section>

      </main>
    </div>
  );
}
