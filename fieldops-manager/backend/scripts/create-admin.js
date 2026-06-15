// Usage: node scripts/create-admin.js --email=you@example.com --name="Your Name" --password=SecurePass123
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  const args = {};
  process.argv.slice(2).forEach((arg) => {
    const match = arg.match(/^--([^=]+)=(.+)$/);
    if (match) args[match[1]] = match[2];
  });

  const { email, name, password } = args;

  if (!email || !name || !password) {
    console.error(
      "\nUsage:\n  node scripts/create-admin.js --email=you@example.com --name=\"Your Name\" --password=YourPassword\n"
    );
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { name, passwordHash, role: "Admin", isActive: true },
    create: { email: email.toLowerCase(), name, passwordHash, role: "Admin", isActive: true },
  });

  console.log("\nAdmin account ready:");
  console.log(`  Name:  ${user.name}`);
  console.log(`  Email: ${user.email}`);
  console.log(`  Role:  ${user.role}`);
  console.log("\nLog in at: https://logitask.in/login\n");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
