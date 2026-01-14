-- CreateTable
CREATE TABLE "AggregatedInteropTransfer" (
    "timestamp" TIMESTAMP(6) NOT NULL,
    "id" VARCHAR(255) NOT NULL,
    "srcChain" VARCHAR(255),
    "dstChain" VARCHAR(255),
    "srcAbstractTokenId" VARCHAR(255),
    "dstAbstractTokenId" VARCHAR(255),
    "transferCount" INTEGER NOT NULL,
    "totalDurationSum" INTEGER NOT NULL,
    "srcValueUsd" REAL,
    "dstValueUsd" REAL,

    CONSTRAINT "AggregatedInteropTransfer_pkey" PRIMARY KEY ("id")
);
