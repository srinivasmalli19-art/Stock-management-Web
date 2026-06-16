/**
 * Phase C Backfill Script — run ONCE in Render Shell after Wave 1 deploys.
 *
 * What it does:
 *   1. Creates the default Organisation (idempotent — skips if siteCode already exists)
 *   2. Backfills orgId on all 11 entities using the default org
 *
 * All UPDATE statements include WHERE "orgId" IS NULL — safe to re-run.
 *
 * Usage (Render Shell):
 *   node scripts/seed-default-org.js
 *
 * Env required: DATABASE_URL (Render provides this automatically)
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ─── Configuration ────────────────────────────────────────────────────────────
// Adjust these values to match your real organisation before running.
const DEFAULT_ORG_NAME = "Logitask HQ";
const DEFAULT_SITE_CODE = "HQ-001";

async function main() {
  console.log("=== Phase C Backfill — seed-default-org.js ===");
  console.log("Timestamp:", new Date().toISOString());

  // ── Step 1: Create (or find existing) default Organisation ────────────────
  let org = await prisma.organisation.findUnique({
    where: { siteCode: DEFAULT_SITE_CODE },
  });

  if (org) {
    console.log(`\n[1] Organisation already exists — id: ${org.id} (${org.name})`);
  } else {
    org = await prisma.organisation.create({
      data: {
        name: DEFAULT_ORG_NAME,
        siteCode: DEFAULT_SITE_CODE,
        isActive: true,
      },
    });
    console.log(`\n[1] Created Organisation — id: ${org.id} (${org.name})`);
  }

  const orgId = org.id;

  // ── Step 2: Backfill each entity via raw SQL (idempotent) ─────────────────

  // 2a. User — backfill non-Super_Admin users only.
  //     Super_Admin gets orgId = NULL intentionally (global access).
  const userResult = await prisma.$executeRaw`
    UPDATE "User"
    SET "orgId" = ${orgId}, "updatedAt" = NOW()
    WHERE "orgId" IS NULL AND "role" != 'Super_Admin'
  `;
  console.log(`\n[2a] User — rows updated: ${userResult}`);

  // 2b. Sku — straightforward, all SKUs belong to the default org
  const skuResult = await prisma.$executeRaw`
    UPDATE "Sku"
    SET "orgId" = ${orgId}, "updatedAt" = NOW()
    WHERE "orgId" IS NULL
  `;
  console.log(`[2b] Sku — rows updated: ${skuResult}`);

  // 2c. MainInventory — inherit from Sku
  const miResult = await prisma.$executeRaw`
    UPDATE "MainInventory" mi
    SET "orgId" = ${orgId}, "updatedAt" = NOW()
    WHERE mi."orgId" IS NULL
  `;
  console.log(`[2c] MainInventory — rows updated: ${miResult}`);

  // 2d. EngineerStock — inherit from engineer's org
  const esResult = await prisma.$executeRaw`
    UPDATE "EngineerStock" es
    SET "orgId" = u."orgId", "updatedAt" = NOW()
    FROM "User" u
    WHERE es."engineerId" = u.id
      AND es."orgId" IS NULL
      AND u."orgId" IS NOT NULL
  `;
  console.log(`[2d] EngineerStock — rows updated: ${esResult}`);

  // 2e. ProductivityLog — inherit from engineer's org
  const plResult = await prisma.$executeRaw`
    UPDATE "ProductivityLog" pl
    SET "orgId" = u."orgId", "updatedAt" = NOW()
    FROM "User" u
    WHERE pl."engineerId" = u.id
      AND pl."orgId" IS NULL
      AND u."orgId" IS NOT NULL
  `;
  console.log(`[2e] ProductivityLog — rows updated: ${plResult}`);

  // 2f. Attendance — inherit from engineer's org
  const attResult = await prisma.$executeRaw`
    UPDATE "Attendance" a
    SET "orgId" = u."orgId"
    FROM "User" u
    WHERE a."engineerId" = u.id
      AND a."orgId" IS NULL
      AND u."orgId" IS NOT NULL
  `;
  console.log(`[2f] Attendance — rows updated: ${attResult}`);

  // 2g. StockRequest — inherit from engineer's org
  const srResult = await prisma.$executeRaw`
    UPDATE "StockRequest" sr
    SET "orgId" = u."orgId", "updatedAt" = NOW()
    FROM "User" u
    WHERE sr."engineerId" = u.id
      AND sr."orgId" IS NULL
      AND u."orgId" IS NOT NULL
  `;
  console.log(`[2g] StockRequest — rows updated: ${srResult}`);

  // 2h. RevokeRequest — inherit from parent StockRequest's org
  const rrResult = await prisma.$executeRaw`
    UPDATE "RevokeRequest" rr
    SET "orgId" = sr."orgId", "updatedAt" = NOW()
    FROM "StockRequest" sr
    WHERE rr."stockRequestId" = sr.id
      AND rr."orgId" IS NULL
      AND sr."orgId" IS NOT NULL
  `;
  console.log(`[2h] RevokeRequest — rows updated: ${rrResult}`);

  // 2i. PurchaseInward — all purchase inward belongs to the default org
  const piResult = await prisma.$executeRaw`
    UPDATE "PurchaseInward"
    SET "orgId" = ${orgId}, "updatedAt" = NOW()
    WHERE "orgId" IS NULL
  `;
  console.log(`[2i] PurchaseInward — rows updated: ${piResult}`);

  // 2j. LpRequest — derive org from TL's email
  const lpResult = await prisma.$executeRaw`
    UPDATE "LpRequest" lr
    SET "orgId" = u."orgId", "updatedAt" = NOW()
    FROM "User" u
    WHERE u.email = lr."tlEmail"
      AND lr."orgId" IS NULL
      AND u."orgId" IS NOT NULL
  `;
  console.log(`[2j] LpRequest — rows updated: ${lpResult}`);

  // 2k. ClaimRequest — inherit from parent LpRequest's org
  const crResult = await prisma.$executeRaw`
    UPDATE "ClaimRequest" cr
    SET "orgId" = lr."orgId", "updatedAt" = NOW()
    FROM "LpRequest" lr
    WHERE cr."lpRequestId" = lr.id
      AND cr."orgId" IS NULL
      AND lr."orgId" IS NOT NULL
  `;
  console.log(`[2k] ClaimRequest — rows updated: ${crResult}`);

  // ── Step 3: Verification ──────────────────────────────────────────────────
  console.log("\n=== VERIFICATION — NULL orgId counts after backfill ===");

  const checks = [
    ["User (non-Super_Admin)", prisma.$queryRaw`SELECT COUNT(*)::int AS cnt FROM "User" WHERE "orgId" IS NULL AND "role" != 'Super_Admin'`],
    ["Sku", prisma.$queryRaw`SELECT COUNT(*)::int AS cnt FROM "Sku" WHERE "orgId" IS NULL`],
    ["MainInventory", prisma.$queryRaw`SELECT COUNT(*)::int AS cnt FROM "MainInventory" WHERE "orgId" IS NULL`],
    ["EngineerStock", prisma.$queryRaw`SELECT COUNT(*)::int AS cnt FROM "EngineerStock" WHERE "orgId" IS NULL`],
    ["ProductivityLog", prisma.$queryRaw`SELECT COUNT(*)::int AS cnt FROM "ProductivityLog" WHERE "orgId" IS NULL`],
    ["Attendance", prisma.$queryRaw`SELECT COUNT(*)::int AS cnt FROM "Attendance" WHERE "orgId" IS NULL`],
    ["StockRequest", prisma.$queryRaw`SELECT COUNT(*)::int AS cnt FROM "StockRequest" WHERE "orgId" IS NULL`],
    ["RevokeRequest", prisma.$queryRaw`SELECT COUNT(*)::int AS cnt FROM "RevokeRequest" WHERE "orgId" IS NULL`],
    ["PurchaseInward", prisma.$queryRaw`SELECT COUNT(*)::int AS cnt FROM "PurchaseInward" WHERE "orgId" IS NULL`],
    ["LpRequest", prisma.$queryRaw`SELECT COUNT(*)::int AS cnt FROM "LpRequest" WHERE "orgId" IS NULL`],
    ["ClaimRequest", prisma.$queryRaw`SELECT COUNT(*)::int AS cnt FROM "ClaimRequest" WHERE "orgId" IS NULL`],
  ];

  let allClear = true;
  for (const [label, query] of checks) {
    const [{ cnt }] = await query;
    const status = cnt === 0 ? "OK" : `FAIL (${cnt} rows still NULL)`;
    console.log(`  ${label.padEnd(30)} ${status}`);
    if (cnt !== 0) allClear = false;
  }

  console.log("\n" + (allClear
    ? "ALL CLEAR — backfill complete. Proceed to Wave 2 deployment."
    : "WARNING — some rows still have NULL orgId. Investigate before Wave 2."));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("BACKFILL ERROR:", e.message);
  prisma.$disconnect();
  process.exit(1);
});
