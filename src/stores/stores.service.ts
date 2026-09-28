import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForUser(userId: string, merchantId: string) {
    const userStores = await this.prisma.userStore.findMany({
      where: {
        userId,
        store: {
          merchantId,
        },
      },
      include: {
        store: true,
      },
    });

    return userStores.map((us) => us.store);
  }

  async findOneForUser(id: string, userId: string, merchantId: string) {
    const userStore = await this.prisma.userStore.findFirst({
      where: {
        storeId: id,
        userId,
        store: {
          merchantId,
        },
      },
      include: {
        store: true,
      },
    });

    if (!userStore) {
      throw new NotFoundException('Store not found or access denied');
    }

    return userStore.store;
  }
}
