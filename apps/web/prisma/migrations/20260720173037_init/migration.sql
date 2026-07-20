-- CreateTable
CREATE TABLE "Developer" (
    "id" TEXT NOT NULL,
    "stellarWallet" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Developer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Api" (
    "id" TEXT NOT NULL,
    "developerId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetUrl" TEXT NOT NULL,
    "priceUsdc" DECIMAL(65,30) NOT NULL,
    "isListed" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Api_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiCall" (
    "id" TEXT NOT NULL,
    "apiId" TEXT NOT NULL,
    "callerWallet" TEXT NOT NULL,
    "amountUsdc" DECIMAL(65,30) NOT NULL,
    "txHash" TEXT NOT NULL,
    "network" TEXT NOT NULL DEFAULT 'testnet',
    "status" TEXT NOT NULL,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Developer_stellarWallet_key" ON "Developer"("stellarWallet");

-- CreateIndex
CREATE UNIQUE INDEX "Developer_email_key" ON "Developer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Api_slug_key" ON "Api"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ApiCall_txHash_key" ON "ApiCall"("txHash");

-- CreateIndex
CREATE INDEX "ApiCall_apiId_createdAt_idx" ON "ApiCall"("apiId", "createdAt");

-- CreateIndex
CREATE INDEX "ApiCall_callerWallet_idx" ON "ApiCall"("callerWallet");

-- AddForeignKey
ALTER TABLE "Api" ADD CONSTRAINT "Api_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "Developer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiCall" ADD CONSTRAINT "ApiCall_apiId_fkey" FOREIGN KEY ("apiId") REFERENCES "Api"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
