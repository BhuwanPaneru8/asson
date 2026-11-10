-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "check" TEXT NOT NULL,
    "critical" BOOLEAN NOT NULL,
    "detail" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "alertedAt" TIMESTAMP(3),
    "recoveryAlertAt" TIMESTAMP(3),

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Incident_check_resolvedAt_idx" ON "Incident"("check", "resolvedAt");

-- CreateIndex
CREATE INDEX "Incident_startedAt_idx" ON "Incident"("startedAt");

