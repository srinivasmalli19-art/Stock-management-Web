/**
 * Super Admin Bootstrap Script — run ONCE in Render Shell.
 *
 * Creates the first Super_Admin account. Super_Admin has orgId = null (global access).
 * This script is the ONLY way to create a Super_Admin — the API does not allow it.
 *
 * Usage (Render Shell):
 *   node scripts/create-super-admin.js <name> <email> <password>
 *
 * Example:
 *   node scripts/create-super-admin.js "Super Admin" superadmin@logitask.in MySecurePass123
 *
 * Recovery: If all Super_Admin accounts are locked, re-run this script with a new email.
 */

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const [, , name, email, password] = process.argv;

  if (!name || !email || !password) {
    console.error("Usage: node scripts/create-super-admin.js <name> <email> <password>");
    process.exit(1);
  }

  const emailLower = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: emailLower } });
  if (existing) {
    if (existing.role === "Super_Admin") {
      console.log(`Super_Admin already exists: ${existing.email} (id: ${existing.id})`);
      console.log("To update password, use a direct DB UPDATE or run this script with a different email.");
    } else {
      console.error(`Email already in use by role: ${existing.role}. Choose a different email.`);
      process.exit(1);
    }
    await prisma.$disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email: emailLower,
      passwordHash,
      role: "Super_Admin",
      isActive: true,
      orgId: null, // Super_Admin intentionally has no org — global access
    },
  });

  console.log("Super_Admin created successfully:");
  console.log(`  id:    ${user.id}`);
  console.log(`  name:  ${user.name}`);
  console.log(`  email: ${user.email}`);
  console.log(`  role:  ${user.role}`);
  console.log(`  orgId: ${user.orgId} (global access)`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  prisma.$disconnect();
  process.exit(1);
});
