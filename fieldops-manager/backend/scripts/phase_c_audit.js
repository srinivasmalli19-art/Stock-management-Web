/* Phase C Readiness Audit Script — read-only, no schema changes */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("=== PHASE C READINESS AUDIT — LIVE DATABASE ===");
  console.log("Timestamp:", new Date().toISOString());

  // ── LP REQUESTS (raw SQL — bypasses stale local LpStatus enum in Prisma client)
  const lpTotal = await prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM "LpRequest"`;
  const lpRows  = await prisma.$queryRaw`SELECT status, COUNT(*)::int AS cnt FROM "LpRequest" GROUP BY status ORDER BY cnt DESC`;
  console.log("\n[7] LP REQUESTS");
  console.log("  Total:", lpTotal[0].total);
  lpRows.forEach((r) => console.log("  Status", r.status, "->", r.cnt));

  // ── CLAIM REQUESTS
  const claimTotal = await prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM "ClaimRequest"`;
  const claimRows  = await prisma.$queryRaw`SELECT status, COUNT(*)::int AS cnt FROM "ClaimRequest" GROUP BY status ORDER BY cnt DESC`;
  console.log("\n[8] CLAIM REQUESTS");
  console.log("  Total:", claimTotal[0].total);
  claimRows.forEach((r) => console.log("  Status", r.status, "->", r.cnt));

  // ── PURCHASE INWARD
  const piTotal = await prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM "PurchaseInward"`;
  const piRows  = await prisma.$queryRaw`SELECT status, COUNT(*)::int AS cnt FROM "PurchaseInward" GROUP BY status ORDER BY cnt DESC`;
  console.log("\n[9] PURCHASE INWARD");
  console.log("  Total:", piTotal[0].total);
  piRows.forEach((r) => console.log("  Status", r.status, "->", r.cnt));

  // ══════════════════════════════════════════════════════
  // ORPHAN DETECTION
  // ══════════════════════════════════════════════════════
  console.log("\n=== ORPHAN DETECTION ===");

  // A) LP requests — tlEmail does not match any active user
  const lpOrphanActive = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS cnt FROM "LpRequest" lr
    WHERE NOT EXISTS (
      SELECT 1 FROM "User" u WHERE u.email = lr."tlEmail" AND u."isActive" = true
    )`;
  const lpOrphanAny = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS cnt FROM "LpRequest" lr
    WHERE NOT EXISTS (
      SELECT 1 FROM "User" u WHERE u.email = lr."tlEmail"
    )`;
  const lpOrphanInactive = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS cnt FROM "LpRequest" lr
    WHERE EXISTS (
      SELECT 1 FROM "User" u WHERE u.email = lr."tlEmail" AND u."isActive" = false
    )`;
  console.log("\nA) LP Requests — orphan by tlEmail:");
  console.log("  tlEmail matches no ACTIVE user:", lpOrphanActive[0].cnt);
  console.log("  tlEmail matches NO user at all (deleted):", lpOrphanAny[0].cnt);
  console.log("  tlEmail matches an INACTIVE user:", lpOrphanInactive[0].cnt);

  if (lpOrphanActive[0].cnt > 0) {
    const details = await prisma.$queryRaw`
      SELECT lr.id, lr."requestId", lr."tlEmail", lr.status, lr."createdAt"
      FROM "LpRequest" lr
      WHERE NOT EXISTS (
        SELECT 1 FROM "User" u WHERE u.email = lr."tlEmail" AND u."isActive" = true
      ) LIMIT 20`;
    console.log("  Orphan LP Request details:");
    details.forEach((r) =>
      console.log(`    ${r.requestId} | tlEmail: ${r.tlEmail} | status: ${r.status} | created: ${r.createdAt}`)
    );
  }

  // B) Stock requests — missing engineer
  const srOrphan = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS cnt FROM "StockRequest" sr
    WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = sr."engineerId")`;
  console.log("\nB) StockRequest — missing engineer:", srOrphan[0].cnt);

  // C) Productivity logs — missing engineer
  const prodOrphan = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS cnt FROM "ProductivityLog" pl
    WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = pl."engineerId")`;
  console.log("C) ProductivityLog — missing engineer:", prodOrphan[0].cnt);

  // D) Attendance — missing engineer
  const attOrphan = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS cnt FROM "Attendance" a
    WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = a."engineerId")`;
  console.log("D) Attendance — missing engineer:", attOrphan[0].cnt);

  // E) Purchase inward — missing SKU
  const piSkuOrphan = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS cnt FROM "PurchaseInward" pi
    WHERE NOT EXISTS (SELECT 1 FROM "Sku" s WHERE s.id = pi."skuId")`;
  console.log("E) PurchaseInward — missing SKU:", piSkuOrphan[0].cnt);

  // F) MainInventory — missing SKU
  const invSkuOrphan = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS cnt FROM "MainInventory" mi
    WHERE NOT EXISTS (SELECT 1 FROM "Sku" s WHERE s.id = mi."skuId")`;
  console.log("F) MainInventory — missing SKU:", invSkuOrphan[0].cnt);

  // G) EngineerStock — missing SKU or engineer
  const esSkuOrphan = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS cnt FROM "EngineerStock" es
    WHERE NOT EXISTS (SELECT 1 FROM "Sku" s WHERE s.id = es."skuId")`;
  const esEngOrphan = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS cnt FROM "EngineerStock" es
    WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = es."engineerId")`;
  console.log("G) EngineerStock — missing SKU:", esSkuOrphan[0].cnt);
  console.log("G) EngineerStock — missing engineer:", esEngOrphan[0].cnt);

  // H) ClaimRequest — missing LpRequest
  const claimOrphan = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS cnt FROM "ClaimRequest" cr
    WHERE NOT EXISTS (SELECT 1 FROM "LpRequest" lr WHERE lr.id = cr."lpRequestId")`;
  console.log("H) ClaimRequest — missing LpRequest:", claimOrphan[0].cnt);

  // I) RevokeRequest — missing StockRequest
  const revokeOrphan = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS cnt FROM "RevokeRequest" rr
    WHERE NOT EXISTS (SELECT 1 FROM "StockRequest" sr WHERE sr.id = rr."stockRequestId")`;
  console.log("I) RevokeRequest — missing StockRequest:", revokeOrphan[0].cnt);

  // J) ProductivityItem — missing log
  const piLogOrphan = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS cnt FROM "ProductivityItem" pi
    WHERE NOT EXISTS (SELECT 1 FROM "ProductivityLog" pl WHERE pl.id = pi."productivityLogId")`;
  console.log("J) ProductivityItem — missing parent log:", piLogOrphan[0].cnt);

  // K) Inactive user records still in active use (stock requests, etc.)
  const inactiveEng = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS cnt FROM "User" u WHERE u."isActive" = false`;
  const inactiveEngStockRequests = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS cnt FROM "StockRequest" sr
    JOIN "User" u ON u.id = sr."engineerId"
    WHERE u."isActive" = false AND sr.status = 'Pending'`;
  console.log("\nK) Inactive users:", inactiveEng[0].cnt);
  console.log("   Pending stock requests from inactive engineers:", inactiveEngStockRequests[0].cnt);

  // ══════════════════════════════════════════════════════
  // DATABASE METADATA
  // ══════════════════════════════════════════════════════
  console.log("\n=== DATABASE METADATA ===");

  const dbSize = await prisma.$queryRaw`SELECT pg_size_pretty(pg_database_size(current_database())) AS size`;
  console.log("Database size:", dbSize[0].size);

  const tableList = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
  console.log("Tables:", tableList.map((t) => t.tablename).join(", "));

  const enumTypes = await prisma.$queryRaw`
    SELECT typname FROM pg_type WHERE typtype = 'e' ORDER BY typname`;
  console.log("Enum types in DB:", enumTypes.map((e) => e.typname).join(", ") || "(none)");

  const lpStatusEnum = await prisma.$queryRaw`
    SELECT typname FROM pg_type WHERE typname = 'LpStatus'`;
  console.log("LpStatus enum still in DB:", lpStatusEnum.length > 0 ? "YES (unexpected)" : "NO (correct — was dropped by migration)");

  const lpStatusColType = await prisma.$queryRaw`
    SELECT data_type, udt_name FROM information_schema.columns
    WHERE table_name = 'LpRequest' AND column_name = 'status'`;
  console.log("LpRequest.status column type:", JSON.stringify(lpStatusColType));

  // Check if 'orgId' column already exists on any table (pre-existing partial migration check)
  const orgIdCols = await prisma.$queryRaw`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE column_name = 'orgId' AND table_schema = 'public'`;
  console.log("orgId columns already present:", orgIdCols.length > 0 ? JSON.stringify(orgIdCols) : "NONE (expected)");

  const orgTable = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS cnt FROM information_schema.tables
    WHERE table_name = 'Organisation' AND table_schema = 'public'`;
  console.log("Organisation table already exists:", orgTable[0].cnt > 0 ? "YES (unexpected)" : "NO (expected)");

  // Check migration history
  const migrations = await prisma.$queryRaw`
    SELECT migration_name, started_at, finished_at, applied_steps_count
    FROM "_prisma_migrations"
    ORDER BY started_at ASC`;
  console.log("\n=== MIGRATION HISTORY ===");
  migrations.forEach((m) =>
    console.log(`  ${m.migration_name} | applied_steps: ${m.applied_steps_count} | finished: ${m.finished_at}`)
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("AUDIT ERROR:", e.message);
  process.exit(1);
});
