// Prisma seed script (CommonJS for Node)
const { PrismaClient } = require("@prisma/client");
const { hashSync } = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding dev database...");

  const passwordHash = hashSync("password123", 10);

  const alice = await prisma.user.upsert({
    where: { email: "alice@example.com" },
    update: {},
    create: { email: "alice@example.com", name: "Alice", passwordHash },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@example.com" },
    update: {},
    create: { email: "bob@example.com" },
  }).catch(async () => {
    // Create Bob with password if not exists
    return prisma.user.create({
      data: { email: "bob@example.com", name: "Bob", passwordHash },
    });
  });

  const group = await prisma.group.create({
    data: {
      name: "Trip to Mountains",
      createdById: alice.id,
      members: {
        create: [
          { userId: alice.id, role: "OWNER" },
          { userId: bob.id, role: "MEMBER" },
        ],
      },
    },
  });

  // Create a sample expense paid by Alice, split equally between Alice and Bob
  const expense = await prisma.expense.create({
    data: {
      groupId: group.id,
      paidById: alice.id,
      amount: "25.00",
      currency: "USD",
      description: "Dinner",
      splitType: "EQUAL",
    },
  });

  await prisma.expenseSplit.createMany({
    data: [
      { expenseId: expense.id, userId: alice.id, amount: "12.50" },
      { expenseId: expense.id, userId: bob.id, amount: "12.50" },
    ],
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });