const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  const passwordHash = await bcrypt.hash("password", 12);

  // Users
  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin@fieldops.com" },
      update: {},
      create: { name: "Raj Kumar", email: "admin@fieldops.com", passwordHash, role: "Admin" },
    }),
    prisma.user.upsert({
      where: { email: "store@fieldops.com" },
      update: {},
      create: { name: "Priya Sharma", email: "store@fieldops.com", passwordHash, role: "Store_Manager" },
    }),
    prisma.user.upsert({
      where: { email: "leader@fieldops.com" },
      update: {},
      create: { name: "Anand Mehta", email: "leader@fieldops.com", passwordHash, role: "Team_Leader" },
    }),
    prisma.user.upsert({
      where: { email: "eng01@fieldops.com" },
      update: {},
      create: { name: "Rahul Singh", email: "eng01@fieldops.com", passwordHash, role: "Engineer" },
    }),
    prisma.user.upsert({
      where: { email: "eng02@fieldops.com" },
      update: {},
      create: { name: "Deepa Nair", email: "eng02@fieldops.com", passwordHash, role: "Engineer" },
    }),
    prisma.user.upsert({
      where: { email: "eng03@fieldops.com" },
      update: {},
      create: { name: "Suresh Reddy", email: "eng03@fieldops.com", passwordHash, role: "Engineer" },
    }),
    prisma.user.upsert({
      where: { email: "eng04@fieldops.com" },
      update: {},
      create: { name: "Kavita Iyer", email: "eng04@fieldops.com", passwordHash, role: "Engineer" },
    }),
    prisma.user.upsert({
      where: { email: "eng05@fieldops.com" },
      update: {},
      create: { name: "Arun Patel", email: "eng05@fieldops.com", passwordHash, role: "Engineer" },
    }),
  ]);

  const [admin, store, leader, eng01, eng02, eng03, eng04, eng05] = users;

  // SKUs
  const skuData = [
    { id: "SKU-001", name: "AC Filter 1 Ton", lowStockAlert: 50 },
    { id: "SKU-002", name: "AC Filter 1.5 Ton", lowStockAlert: 40 },
    { id: "SKU-003", name: "Capacitor 25MFD", lowStockAlert: 60 },
    { id: "SKU-004", name: "Remote Control Universal", lowStockAlert: 30 },
    { id: "SKU-005", name: "Gas Refill Kit R32", lowStockAlert: 20 },
    { id: "SKU-006", name: 'Copper Pipe 1/4"', lowStockAlert: 80 },
    { id: "SKU-007", name: "Drainage Pipe 10m", lowStockAlert: 50 },
    { id: "SKU-008", name: "Stabilizer 5kVA", lowStockAlert: 10 },
  ];

  for (const sku of skuData) {
    await prisma.sku.upsert({ where: { id: sku.id }, update: {}, create: sku });
  }

  // Main Inventory
  const invData = [
    { skuId: "SKU-001", qty: 240, unitPrice: 450 },
    { skuId: "SKU-002", qty: 180, unitPrice: 550 },
    { skuId: "SKU-003", qty: 320, unitPrice: 380 },
    { skuId: "SKU-004", qty: 95, unitPrice: 650 },
    { skuId: "SKU-005", qty: 60, unitPrice: 1200 },
    { skuId: "SKU-006", qty: 400, unitPrice: 320 },
    { skuId: "SKU-007", qty: 220, unitPrice: 280 },
    { skuId: "SKU-008", qty: 28, unitPrice: 2800 },
  ];

  for (const inv of invData) {
    await prisma.mainInventory.upsert({
      where: { skuId: inv.skuId },
      update: {},
      create: inv,
    });
  }

  // Engineer Stock
  const engStockData = [
    { engineerId: eng01.id, items: [{ skuId: "SKU-001", qty: 12 }, { skuId: "SKU-002", qty: 8 }, { skuId: "SKU-003", qty: 15 }, { skuId: "SKU-004", qty: 5 }, { skuId: "SKU-005", qty: 3 }] },
    { engineerId: eng02.id, items: [{ skuId: "SKU-001", qty: 9 }, { skuId: "SKU-002", qty: 6 }, { skuId: "SKU-006", qty: 20 }, { skuId: "SKU-007", qty: 12 }] },
    { engineerId: eng03.id, items: [{ skuId: "SKU-003", qty: 18 }, { skuId: "SKU-004", qty: 7 }, { skuId: "SKU-005", qty: 2 }, { skuId: "SKU-008", qty: 1 }] },
    { engineerId: eng04.id, items: [{ skuId: "SKU-001", qty: 14 }, { skuId: "SKU-002", qty: 10 }, { skuId: "SKU-006", qty: 15 }] },
    { engineerId: eng05.id, items: [{ skuId: "SKU-003", qty: 20 }, { skuId: "SKU-004", qty: 8 }, { skuId: "SKU-005", qty: 4 }] },
  ];

  for (const eng of engStockData) {
    for (const item of eng.items) {
      await prisma.engineerStock.upsert({
        where: { engineerId_skuId: { engineerId: eng.engineerId, skuId: item.skuId } },
        update: {},
        create: { engineerId: eng.engineerId, skuId: item.skuId, qty: item.qty },
      });
    }
  }

  // Productivity Logs
  const pl1 = await prisma.productivityLog.upsert({
    where: { engineerId_date: { engineerId: eng01.id, date: new Date("2025-06-01") } },
    update: {},
    create: {
      engineerId: eng01.id, date: new Date("2025-06-01"), callsClosed: 5, status: "Approved", tlNote: "",
      items: { create: [
        { skuId: "SKU-001", qty: 2, saleValue: 900, adminIncentive: 60 },
        { skuId: "SKU-003", qty: 1, saleValue: 380, adminIncentive: 25 },
      ]},
    },
  });

  const pl2 = await prisma.productivityLog.upsert({
    where: { engineerId_date: { engineerId: eng01.id, date: new Date("2025-06-02") } },
    update: {},
    create: {
      engineerId: eng01.id, date: new Date("2025-06-02"), callsClosed: 4, status: "Approved",
      items: { create: [{ skuId: "SKU-004", qty: 1, saleValue: 650, adminIncentive: 50 }] },
    },
  });

  const pl3 = await prisma.productivityLog.upsert({
    where: { engineerId_date: { engineerId: eng02.id, date: new Date("2025-06-01") } },
    update: {},
    create: {
      engineerId: eng02.id, date: new Date("2025-06-01"), callsClosed: 6, status: "Approved",
      items: { create: [{ skuId: "SKU-001", qty: 1, saleValue: 450, adminIncentive: 30 }] },
    },
  });

  await prisma.productivityLog.upsert({
    where: { engineerId_date: { engineerId: eng01.id, date: new Date("2025-06-03") } },
    update: {},
    create: {
      engineerId: eng01.id, date: new Date("2025-06-03"), callsClosed: 3, status: "Validated", tlNote: "Good work",
      items: { create: [{ skuId: "SKU-005", qty: 1, saleValue: 1200 }] },
    },
  });

  await prisma.productivityLog.upsert({
    where: { engineerId_date: { engineerId: eng02.id, date: new Date("2025-06-03") } },
    update: {},
    create: {
      engineerId: eng02.id, date: new Date("2025-06-03"), callsClosed: 7, status: "Pending",
      items: { create: [{ skuId: "SKU-002", qty: 2, saleValue: 1100 }] },
    },
  });

  await prisma.productivityLog.upsert({
    where: { engineerId_date: { engineerId: eng03.id, date: new Date("2025-06-02") } },
    update: {},
    create: { engineerId: eng03.id, date: new Date("2025-06-02"), callsClosed: 4, status: "Pending" },
  });

  await prisma.productivityLog.upsert({
    where: { engineerId_date: { engineerId: eng04.id, date: new Date("2025-06-03") } },
    update: {},
    create: {
      engineerId: eng04.id, date: new Date("2025-06-03"), callsClosed: 5, status: "Pending",
      items: { create: [{ skuId: "SKU-001", qty: 3, saleValue: 1350 }] },
    },
  });

  // Attendance for approved logs
  await prisma.attendance.upsert({
    where: { engineerId_date: { engineerId: eng01.id, date: new Date("2025-06-01") } },
    update: {},
    create: { engineerId: eng01.id, date: new Date("2025-06-01"), status: "Present", productivityLogId: pl1.id },
  });

  await prisma.attendance.upsert({
    where: { engineerId_date: { engineerId: eng01.id, date: new Date("2025-06-02") } },
    update: {},
    create: { engineerId: eng01.id, date: new Date("2025-06-02"), status: "Present", productivityLogId: pl2.id },
  });

  await prisma.attendance.upsert({
    where: { engineerId_date: { engineerId: eng02.id, date: new Date("2025-06-01") } },
    update: {},
    create: { engineerId: eng02.id, date: new Date("2025-06-01"), status: "Present", productivityLogId: pl3.id },
  });

  // Stock Requests
  await prisma.stockRequest.upsert({
    where: { id: "sr-seed-001" },
    update: {},
    create: { id: "sr-seed-001", engineerId: eng01.id, skuId: "SKU-001", qty: 10, status: "Approved", createdAt: new Date("2025-06-03") },
  });

  await prisma.stockRequest.upsert({
    where: { id: "sr-seed-002" },
    update: {},
    create: { id: "sr-seed-002", engineerId: eng02.id, skuId: "SKU-005", qty: 5, status: "Pending", createdAt: new Date("2025-06-03") },
  });

  await prisma.stockRequest.upsert({
    where: { id: "sr-seed-003" },
    update: {},
    create: { id: "sr-seed-003", engineerId: eng03.id, skuId: "SKU-004", qty: 8, status: "Pending", createdAt: new Date("2025-06-04") },
  });

  // Purchase Inward
  await prisma.purchaseInward.upsert({
    where: { id: "pi-seed-001" },
    update: {},
    create: { id: "pi-seed-001", skuId: "SKU-001", qty: 100, unitPrice: 400, vendor: "ABC Traders", invoiceNo: "INV-4521", date: new Date("2025-05-28"), status: "Approved" },
  });

  await prisma.purchaseInward.upsert({
    where: { id: "pi-seed-002" },
    update: {},
    create: { id: "pi-seed-002", skuId: "SKU-005", qty: 20, unitPrice: 1100, vendor: "Cool Gas Pvt Ltd", invoiceNo: "INV-9874", date: new Date("2025-06-01"), status: "Approved" },
  });

  console.log("✅ Database seeded successfully!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
