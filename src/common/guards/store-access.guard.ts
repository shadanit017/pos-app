import { Injectable, CanActivate, ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../types/auth-user.type';

@Injectable()
export class StoreAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;
    const storeId = request.params.storeId;

    if (!storeId) {
      return true;
    }

    if (!user || !user.merchantId || !user.userId) {
      throw new ForbiddenException('Authentication context missing');
    }

    // 1. Verify store belongs to authenticated merchant
    const store = await this.prisma.store.findFirst({
      where: {
        id: storeId,
        merchantId: user.merchantId,
      },
    });

    if (!store) {
      throw new NotFoundException('Store not found or does not belong to merchant');
    }

    // 2. Verify user has  access to this store
    const userStore = await this.prisma.userStore.findUnique({
      where: {
        userId_storeId: {
          userId: user.userId,
          storeId: storeId,
        },
      },
    });

    if (!userStore) {
      throw new ForbiddenException('User does not have access to requested store');
    }

    return true;
  }
}
