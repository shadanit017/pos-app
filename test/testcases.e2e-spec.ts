import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { Role } from '@prisma/client';

describe('Multi-Tenant POS E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let tokenA: string;
  let tokenB: string;
  let merchantAId: string;
  let merchantBId: string;
  let storeA1Id: string;
  let storeB1Id: string;
  let productB1Id: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);

    const passwordHash = await bcrypt.hash('Password123!', 10);

    // Setup Merchant A & User A
    let merchantA = await prisma.merchant.findFirst({ where: { name: 'Merchant A Corp' } });
    if (!merchantA) {
      merchantA = await prisma.merchant.create({ data: { name: 'Merchant A Corp' } });
    }
    merchantAId = merchantA.id;

    let storeA1 = await prisma.store.findFirst({ where: { merchantId: merchantAId } });
    if (!storeA1) {
      storeA1 = await prisma.store.create({ data: { merchantId: merchantAId, name: 'Store A1' } });
    }
    storeA1Id = storeA1.id;

    let userA = await prisma.user.findFirst({ where: { email: 'admin-a@example.com' } });
    if (!userA) {
      userA = await prisma.user.create({
        data: {
          merchantId: merchantAId,
          email: 'admin-a@example.com',
          passwordHash,
          role: Role.ADMIN,
        },
      });
      await prisma.userStore.create({ data: { userId: userA.id, storeId: storeA1Id } });
    }

    // Setup Merchant B & User B
    let merchantB = await prisma.merchant.findFirst({ where: { name: 'Merchant B Corp' } });
    if (!merchantB) {
      merchantB = await prisma.merchant.create({ data: { name: 'Merchant B Corp' } });
    }
    merchantBId = merchantB.id;

    let storeB1 = await prisma.store.findFirst({ where: { merchantId: merchantBId } });
    if (!storeB1) {
      storeB1 = await prisma.store.create({ data: { merchantId: merchantBId, name: 'Store B1' } });
    }
    storeB1Id = storeB1.id;

    let userB = await prisma.user.findFirst({ where: { email: 'admin-b@example.com' } });
    if (!userB) {
      userB = await prisma.user.create({
        data: {
          merchantId: merchantBId,
          email: 'admin-b@example.com',
          passwordHash,
          role: Role.ADMIN,
        },
      });
      await prisma.userStore.create({ data: { userId: userB.id, storeId: storeB1Id } });
    }

    let productB1 = await prisma.product.findFirst({ where: { merchantId: merchantBId } });
    if (!productB1) {
      productB1 = await prisma.product.create({
        data: {
          merchantId: merchantBId,
          sku: `SKU-B1-${Date.now()}`,
          name: 'Product B1',
          price: 50.0,
          isActive: true,
        },
      });
    }
    productB1Id = productB1.id;

    // Login as Merchant A Admin
    const loginA = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin-a@example.com', password: 'Password123!' })
      .expect(200);
    tokenA = loginA.body.accessToken;

    // Login as Merchant B Admin
    const loginB = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin-b@example.com', password: 'Password123!' })
      .expect(200);
    tokenB = loginB.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Successful sale', () => {
    it('should create a sale, deduct inventory, and record payment successfully', async () => {
      const product = await prisma.product.create({
        data: {
          merchantId: merchantAId,
          sku: `SKU-TEST-1-${Date.now()}`,
          name: 'Test Product 100',
          price: 100.0,
          isActive: true,
        },
      });

      await prisma.inventory.create({
        data: {
          storeId: storeA1Id,
          productId: product.id,
          quantity: 10,
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/stores/${storeA1Id}/sales`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('idempotency-key', `key-success-${Date.now()}`)
        .send({
          items: [{ productId: product.id, quantity: 2 }],
          payment: { simulate: 'SUCCESS' },
        })
        .expect(201);

      expect(res.body.status).toBe('COMPLETED');
      expect(Number(res.body.subtotal)).toBe(200);
      expect(Number(res.body.total)).toBe(200);
      expect(res.body.saleItems).toHaveLength(1);
      expect(Number(res.body.saleItems[0].unitPrice)).toBe(100);
      expect(Number(res.body.saleItems[0].total)).toBe(200);
      expect(res.body.payments).toHaveLength(1);
      expect(res.body.payments[0].status).toBe('SUCCESS');

      // Verify updated inventory in DB is 8
      const inv = await prisma.inventory.findUnique({
        where: { storeId_productId: { storeId: storeA1Id, productId: product.id } },
      });
      expect(inv?.quantity).toBe(8);
    });
  });

  describe('2. Failed sale / payment failure', () => {
    it('should not complete sale when payment fails and return failure response', async () => {
      const product = await prisma.product.create({
        data: {
          merchantId: merchantAId,
          sku: `SKU-TEST-FAIL-${Date.now()}`,
          name: 'Test Payment Fail Product',
          price: 50.0,
          isActive: true,
        },
      });

      await prisma.inventory.create({
        data: {
          storeId: storeA1Id,
          productId: product.id,
          quantity: 10,
        },
      });

      await request(app.getHttpServer())
        .post(`/api/stores/${storeA1Id}/sales`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('idempotency-key', `key-fail-pay-${Date.now()}`)
        .send({
          items: [{ productId: product.id, quantity: 2 }],
          payment: { simulate: 'FAILED' },
        })
        .expect(400);

      // Verify inventory remains 10
      const inv = await prisma.inventory.findUnique({
        where: { storeId_productId: { storeId: storeA1Id, productId: product.id } },
      });
      expect(inv?.quantity).toBe(10);
    });
  });

  describe('3. Insufficient inventory', () => {
    it('should reject sale when requested quantity is greater than available stock', async () => {
      const product = await prisma.product.create({
        data: {
          merchantId: merchantAId,
          sku: `SKU-TEST-STOCK-${Date.now()}`,
          name: 'Low Stock Product',
          price: 30.0,
          isActive: true,
        },
      });

      await prisma.inventory.create({
        data: {
          storeId: storeA1Id,
          productId: product.id,
          quantity: 2,
        },
      });

      await request(app.getHttpServer())
        .post(`/api/stores/${storeA1Id}/sales`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('idempotency-key', `key-low-stock-${Date.now()}`)
        .send({
          items: [{ productId: product.id, quantity: 5 }],
          payment: { simulate: 'SUCCESS' },
        })
        .expect(409);

      // Inventory must remain 2
      const inv = await prisma.inventory.findUnique({
        where: { storeId_productId: { storeId: storeA1Id, productId: product.id } },
      });
      expect(inv?.quantity).toBe(2);
    });
  });

  describe('4. Cross-tenant access rejected', () => {
    it('should reject User from Merchant A from accessing Merchant B products/inventory/sales', async () => {
      // Merchant A trying to get Merchant B product -> 404
      await request(app.getHttpServer())
        .get(`/api/products/${productB1Id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      // Merchant A trying to access Merchant B store inventory -> 404
      await request(app.getHttpServer())
        .get(`/api/stores/${storeB1Id}/inventory`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      // Merchant A trying to create sale in Merchant B store -> 404
      await request(app.getHttpServer())
        .post(`/api/stores/${storeB1Id}/sales`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('idempotency-key', `key-cross-tenant-${Date.now()}`)
        .send({
          items: [{ productId: productB1Id, quantity: 1 }],
        })
        .expect(404);
    });
  });

  describe('5. Duplicate request / idempotency', () => {
    it('should not create a second sale when sending the same sale request twice', async () => {
      const product = await prisma.product.create({
        data: {
          merchantId: merchantAId,
          sku: `SKU-IDEM-${Date.now()}`,
          name: 'Idempotency Test Product',
          price: 40.0,
          isActive: true,
        },
      });

      await prisma.inventory.create({
        data: {
          storeId: storeA1Id,
          productId: product.id,
          quantity: 10,
        },
      });

      const idempotencyKey = `idempotency-key-test-${Date.now()}`;
      const payload = {
        items: [{ productId: product.id, quantity: 2 }],
        payment: { simulate: 'SUCCESS' as const },
      };

      // First Request
      const res1 = await request(app.getHttpServer())
        .post(`/api/stores/${storeA1Id}/sales`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('idempotency-key', idempotencyKey)
        .send(payload)
        .expect(201);

      // Second Request with identical Idempotency-Key
      const res2 = await request(app.getHttpServer())
        .post(`/api/stores/${storeA1Id}/sales`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('idempotency-key', idempotencyKey)
        .send(payload)
        .expect(201);

      expect(res1.body.id).toBe(res2.body.id);

      // Stock must be 8 (deducted ONLY once)
      const inv = await prisma.inventory.findUnique({
        where: { storeId_productId: { storeId: storeA1Id, productId: product.id } },
      });
      expect(inv?.quantity).toBe(8);
    });

    it('should reject request when using same idempotency key with a different payload', async () => {
      const product = await prisma.product.create({
        data: {
          merchantId: merchantAId,
          sku: `SKU-HASH-${Date.now()}`,
          name: 'Hash Test Product',
          price: 50.0,
          isActive: true,
        },
      });

      await prisma.inventory.create({
        data: {
          storeId: storeA1Id,
          productId: product.id,
          quantity: 10,
        },
      });

      const idempotencyKey = `idempotency-key-diff-payload-${Date.now()}`;
      const payload1 = {
        items: [{ productId: product.id, quantity: 1 }],
        payment: { simulate: 'SUCCESS' as const },
      };
      const payload2 = {
        items: [{ productId: product.id, quantity: 2 }],
        payment: { simulate: 'SUCCESS' as const },
      };

      // First request
      await request(app.getHttpServer())
        .post(`/api/stores/${storeA1Id}/sales`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('idempotency-key', idempotencyKey)
        .send(payload1)
        .expect(201);

      // Second request with SAME idempotency key but DIFFERENT payload
      const res = await request(app.getHttpServer())
        .post(`/api/stores/${storeA1Id}/sales`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('idempotency-key', idempotencyKey)
        .send(payload2)
        .expect(409);

      expect(res.body.message).toBe('Same idempotency key cannot be used with a different request');
    });
  });
});
