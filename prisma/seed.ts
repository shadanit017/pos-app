import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {

  // Clean existing data
  await prisma.idempotencyKey.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.userStore.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
  await prisma.store.deleteMany();
  await prisma.merchant.deleteMany();

  const passwordHash = await bcrypt.hash('password@123', 10);

  // 1. Merchant A
  const merchantA = await prisma.merchant.create({
    data: {
      name: 'Raj Electronics',
    },
  });

  const storeA1 = await prisma.store.create({
    data: {
      merchantId: merchantA.id,
      name: 'Store A1 - Mohali',
    },
  });

  const storeA2 = await prisma.store.create({
    data: {
      merchantId: merchantA.id,
      name: 'Store A2 - Chandigarh',
    },
  });

  const adminA = await prisma.user.create({
    data: {
      merchantId: merchantA.id,
      email: 'raj.admin@yopmail.com',
      passwordHash,
      role: Role.ADMIN,
    },
  });

  const managerA = await prisma.user.create({
    data: {
      merchantId: merchantA.id,
      email: 'raj.manager@yopmail.com',
      passwordHash,
      role: Role.MANAGER,
    },
  });

  const cashierA = await prisma.user.create({
    data: {
      merchantId: merchantA.id,
      email: 'akash.cashier@yopmail.com',
      passwordHash,
      role: Role.CASHIER,
    },
  });

  // Assign stores
  await prisma.userStore.createMany({
    data: [
      { userId: adminA.id, storeId: storeA1.id },
      { userId: adminA.id, storeId: storeA2.id },
      { userId: managerA.id, storeId: storeA1.id },
      { userId: managerA.id, storeId: storeA2.id },
      { userId: cashierA.id, storeId: storeA1.id },
    ],
  });

  // Products for Merchant A
  const productA1 = await prisma.product.create({
    data: {
      merchantId: merchantA.id,
      sku: 'SKU-A-001',
      name: 'iPhone 15',
      price: 999.99,
      isActive: true,
    },
  });

  const productA2 = await prisma.product.create({
    data: {
      merchantId: merchantA.id,
      sku: 'SKU-A-002',
      name: 'MacBook Pro',
      price: 1999.99,
      isActive: true,
    },
  });

  const productA3 = await prisma.product.create({
    data: {
      merchantId: merchantA.id,
      sku: 'SKU-A-003',
      name: 'AirPods Pro',
      price: 249.99,
      isActive: true,
    },
  });

  // Inventory for Merchant A stores
  await prisma.inventory.createMany({
    data: [
      { storeId: storeA1.id, productId: productA1.id, quantity: 10 },
      { storeId: storeA1.id, productId: productA2.id, quantity: 5 },
      { storeId: storeA1.id, productId: productA3.id, quantity: 20 },
      { storeId: storeA2.id, productId: productA1.id, quantity: 5 },
      { storeId: storeA2.id, productId: productA2.id, quantity: 2 },
      { storeId: storeA2.id, productId: productA3.id, quantity: 15 },
    ],
  });

  // 2. Merchant B
  const merchantB = await prisma.merchant.create({
    data: {
      name: 'King Electronics',
    },
  });

  const storeB1 = await prisma.store.create({
    data: {
      merchantId: merchantB.id,
      name: 'Store B1 - Dehli',
    },
  });

  const adminB = await prisma.user.create({
    data: {
      merchantId: merchantB.id,
      email: 'king.admin@yopmail.com',
      passwordHash,
      role: Role.ADMIN,
    },
  });

  const managerB = await prisma.user.create({
    data: {
      merchantId: merchantB.id,
      email: 'king.manager@yopmail.com',
      passwordHash,
      role: Role.MANAGER,
    },
  });

  const cashierB = await prisma.user.create({
    data: {
      merchantId: merchantB.id,
      email: 'king.cashier@yopmail.com',
      passwordHash,
      role: Role.CASHIER,
    },
  });

  await prisma.userStore.createMany({
    data: [
      { userId: adminB.id, storeId: storeB1.id },
      { userId: managerB.id, storeId: storeB1.id },
      { userId: cashierB.id, storeId: storeB1.id },
    ],
  });

  // Products for Merchant B 
  const productB1 = await prisma.product.create({
    data: {
      merchantId: merchantB.id,
      sku: 'SKU-B-001',
      name: 'Galaxy S24',
      price: 899.99,
      isActive: true,
    },
  });

  const productB2 = await prisma.product.create({
    data: {
      merchantId: merchantB.id,
      sku: 'SKU-B-002',
      name: 'Galaxy Tab',
      price: 649.99,
      isActive: true,
    },
  });

  await prisma.inventory.createMany({
    data: [
      { storeId: storeB1.id, productId: productB1.id, quantity: 15 },
      { storeId: storeB1.id, productId: productB2.id, quantity: 8 },
    ],
  });

  console.log('Seeding completed successfully!');
  console.log({
    merchantA: { id: merchantA.id, storeA1: storeA1.id, storeA2: storeA2.id },
    merchantB: { id: merchantB.id, storeB1: storeB1.id },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
