import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SalesRepository } from './sales.repository';
import { PaymentService } from '../payments/payment.service';
import { InventoryService } from '../inventory/inventory.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SaleQueryDto } from './dto/sale-query.dto';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly salesRepository: SalesRepository,
    private readonly paymentService: PaymentService,
    private readonly inventoryService: InventoryService,
  ) { }

  async createSale(
    user: AuthenticatedUser,
    storeId: string,
    idempotencyKey: string,
    dto: CreateSaleDto,
  ) {
    if (!idempotencyKey || !idempotencyKey.trim()) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    const requestHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(dto))
      .digest('hex');

    // is idempotency key already exist
    let keyRecord = await this.prisma.idempotencyKey.findUnique({
      where: {
        storeId_key: {
          storeId,
          key: idempotencyKey,
        },
      },
    });

    if (keyRecord) {
      if (keyRecord.requestHash !== requestHash) {
        throw new ConflictException(
          'Same idempotency key cannot be used with a different request',
        );
      }
      if (keyRecord.status === 'COMPLETED' && keyRecord.responseBody) {
        return JSON.parse(keyRecord.responseBody);
      }
      if (keyRecord.status === 'PROCESSING') {
        throw new ConflictException('Concurrent or duplicate in-flight idempotency request');
      }
    }

    // create idempotency Key
    try {
      keyRecord = await this.prisma.idempotencyKey.create({
        data: {
          merchantId: user.merchantId,
          storeId,
          userId: user.userId,
          key: idempotencyKey,
          requestHash,
          status: 'PROCESSING',
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {

        const existing = await this.prisma.idempotencyKey.findUnique({
          where: { storeId_key: { storeId, key: idempotencyKey } },
        });
        if (existing) {
          if (existing.requestHash !== requestHash) {
            throw new ConflictException(
              'Same idempotency key cannot be used with a different request',
            );
          }
          if (existing.status === 'COMPLETED' && existing.responseBody) {
            return JSON.parse(existing.responseBody);
          }
        }
        throw new ConflictException('Concurrent idempotency request in progress');
      }
      throw err;
    }

    try {
      // transaction usin  locking
      const completedSale = await this.prisma.$transaction(async (tx) => {
        const productIds = Array.from(new Set(dto.items.map((i) => i.productId))).sort();

        // Row-level lock on inventory rows for requested store & products
        const lockedInventories: Array<{ id: string; store_id: string; product_id: string; quantity: number }> =
          await tx.$queryRaw`
            SELECT id, store_id, product_id, quantity
            FROM inventory
            WHERE store_id = ${storeId}::uuid
              AND product_id IN (${Prisma.join(productIds.map((id) => Prisma.sql`${id}::uuid`))})
            FOR UPDATE;
          `;

        const inventoryMap = new Map<string, number>();
        lockedInventories.forEach((inv) => {
          inventoryMap.set(inv.product_id, inv.quantity);
        });

        // Load active products belonging to current merchant
        const products = await tx.product.findMany({
          where: {
            id: { in: productIds },
            merchantId: user.merchantId,
          },
        });

        if (products.length !== productIds.length) {
          throw new NotFoundException('One or more products were not found or belong to another merchant');
        }

        const productMap = new Map(products.map((p) => [p.id, p]));

        let subtotalNum = 0;
        const itemCalculations: Array<{
          productId: string;
          quantity: number;
          unitPrice: number;
          itemTotal: number;
        }> = [];

        for (const item of dto.items) {
          const product = productMap.get(item.productId);
          if (!product) {
            throw new NotFoundException(`Product ${item.productId} not found`);
          }

          if (!product.isActive) {
            throw new BadRequestException(`Product '${product.name}' is inactive`);
          }

          const currentStock = inventoryMap.get(item.productId) ?? 0;
          if (currentStock < item.quantity) {
            throw new ConflictException(`Insufficient stock for product '${product.name}'`);
          }

          const unitPrice = Number(product.price);
          const itemTotal = unitPrice * item.quantity;
          subtotalNum += itemTotal;

          itemCalculations.push({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice,
            itemTotal,
          });
        }

        const totalNum = subtotalNum;

        // Process payment via provider abstraction
        const paymentResult = await this.paymentService.processPayment(
          totalNum,
          `sale_${storeId}_${Date.now()}`,
          dto.payment,
        );

        if (paymentResult.status === 'FAILED') {
          throw new BadRequestException(
            paymentResult.errorMessage || 'Payment processing failed',
          );
        }

        // Create Sale
        const sale = await tx.sale.create({
          data: {
            merchantId: user.merchantId,
            storeId,
            userId: user.userId,
            subtotal: subtotalNum,
            total: totalNum,
            status: 'COMPLETED',
          },
        });

        // Create SaleItems and update stock
        for (const calc of itemCalculations) {
          await tx.saleItem.create({
            data: {
              saleId: sale.id,
              productId: calc.productId,
              quantity: calc.quantity,
              unitPrice: calc.unitPrice,
              total: calc.itemTotal,
            },
          });

          await tx.inventory.update({
            where: {
              storeId_productId: {
                storeId,
                productId: calc.productId,
              },
            },
            data: {
              quantity: {
                decrement: calc.quantity,
              },
            },
          });
        }

        // Record Payment
        await tx.payment.create({
          data: {
            saleId: sale.id,
            provider: paymentResult.provider,
            transactionId: paymentResult.transactionId,
            amount: totalNum,
            status: 'SUCCESS',
          },
        });

        return tx.sale.findUnique({
          where: { id: sale.id },
          include: {
            saleItems: {
              include: {
                product: true,
              },
            },
            payments: true,
          },
        });
      });

      // update idempotency key record
      const serializedSale = JSON.stringify(completedSale);
      await this.prisma.idempotencyKey.update({
        where: { id: keyRecord.id },
        data: {
          status: 'COMPLETED',
          saleId: completedSale.id,
          responseBody: serializedSale,
        },
      });

      // remove store items from redis
      await this.inventoryService.invalidateCache(user.merchantId, storeId);

      return completedSale;
    } catch (err) {
      // delete idempotency key if we face any failure
      if (keyRecord && keyRecord.id) {
        await this.prisma.idempotencyKey
          .delete({
            where: { id: keyRecord.id },
          })
          .catch(() => { });
      }
      throw err;
    }
  }

  async findAllByStore(merchantId: string, storeId: string, query: SaleQueryDto = {}) {
    return this.salesRepository.findAllByStore(merchantId, storeId, query);
  }

  async findOne(merchantId: string, storeId: string, saleId: string) {
    const sale = await this.salesRepository.findById(merchantId, storeId, saleId);
    if (!sale) {
      throw new NotFoundException('Sale not found');
    }
    return sale;
  }
}
