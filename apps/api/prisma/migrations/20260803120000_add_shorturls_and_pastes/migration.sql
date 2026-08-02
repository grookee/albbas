-- CreateTable
CREATE TABLE "pastes" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "language" TEXT NOT NULL DEFAULT 'text',
    "filename" TEXT,
    "s3Key" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "visits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pastes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "short_urls" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "visits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "short_urls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pastes_slug_key" ON "pastes"("slug");

-- CreateIndex
CREATE INDEX "pastes_userId_createdAt_idx" ON "pastes"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "pastes_slug_idx" ON "pastes"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "short_urls_slug_key" ON "short_urls"("slug");

-- CreateIndex
CREATE INDEX "short_urls_userId_createdAt_idx" ON "short_urls"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "short_urls_slug_idx" ON "short_urls"("slug");

-- AddForeignKey
ALTER TABLE "pastes" ADD CONSTRAINT "pastes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "short_urls" ADD CONSTRAINT "short_urls_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
