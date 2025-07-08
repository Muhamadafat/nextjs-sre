-- CreateTable
CREATE TABLE "analytics" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "document" TEXT,
    "userId" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_pkey" PRIMARY KEY ("id")
);
