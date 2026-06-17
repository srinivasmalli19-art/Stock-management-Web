-- CreateTable AuditLog — centralised audit trail for all business events
CREATE TABLE "AuditLog" (
    "id"             TEXT NOT NULL,
    "organisationId" TEXT,
    "userId"         TEXT NOT NULL,
    "userName"       TEXT NOT NULL,
    "role"           TEXT NOT NULL,
    "action"         TEXT NOT NULL,
    "entityType"     TEXT NOT NULL,
    "entityId"       TEXT NOT NULL,
    "oldValue"       JSONB,
    "newValue"       JSONB,
    "ipAddress"      TEXT,
    "userAgent"      TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- Indexes for common query patterns
CREATE INDEX "AuditLog_organisationId_idx"           ON "AuditLog"("organisationId");
CREATE INDEX "AuditLog_userId_idx"                   ON "AuditLog"("userId");
CREATE INDEX "AuditLog_action_idx"                   ON "AuditLog"("action");
CREATE INDEX "AuditLog_entityType_idx"               ON "AuditLog"("entityType");
CREATE INDEX "AuditLog_createdAt_idx"                ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_organisationId_createdAt_idx" ON "AuditLog"("organisationId", "createdAt");
