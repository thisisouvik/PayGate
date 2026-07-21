// src/lib/db/developers.ts
// Query helpers for the Developer table.
// All mutations go through these functions — no raw Prisma in route handlers.

import { prisma } from "@/lib/prisma";
import type { Developer } from "@prisma/client";

/**
 * Find a developer by their Stellar wallet address.
 * Returns null if the wallet has never registered.
 */
export async function getDeveloperByWallet(
  stellarWallet: string
): Promise<Developer | null> {
  return prisma.developer.findUnique({ where: { stellarWallet } });
}

/**
 * Find or create a developer row for a given wallet.
 * Called on first login — creates the row if the wallet is new.
 */
export async function upsertDeveloper(
  stellarWallet: string,
  email?: string
): Promise<Developer> {
  return prisma.developer.upsert({
    where: { stellarWallet },
    update: email ? { email } : {},
    create: { stellarWallet, email },
  });
}

/**
 * Get a developer by their internal ID (used in session lookups).
 */
export async function getDeveloperById(
  id: string
): Promise<Developer | null> {
  return prisma.developer.findUnique({ where: { id } });
}

