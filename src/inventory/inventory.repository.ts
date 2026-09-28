import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InventoryRepository {
  constructor(private readonly prisma: PrismaService) { }

  async createOrUpdate(storeId: string, productId: string, quantity: number) {
    return this.prisma.inventory.upsert({
      where: {
        storeId_productId: {
          storeId,
          productId,
        },
      },
      create: {
        storeId,
        productId,
        quantity,
      },
      update: {
        quantity,
      },
      include: {
        product: true,
      },
    });
  }

  async findAllByStore(storeId: string) {
    return this.prisma.inventory.findMany({
      where: { storeId },
      include: {
        product: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByStoreAndProduct(storeId: string, productId: string) {
    return this.prisma.inventory.findUnique({
      where: {
        storeId_productId: {
          storeId,
          productId,
        },
      },
      include: {
        product: true,
      },
    });
  }
}
