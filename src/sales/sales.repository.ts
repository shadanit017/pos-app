import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SaleQueryDto } from './dto/sale-query.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { Sale, Prisma } from '@prisma/client';

@Injectable()
export class SalesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByStore(
    merchantId: string,
    storeId: string,
    query: SaleQueryDto = {},
  ): Promise<PaginatedResult<Sale>> {
    const page = query.page && query.page > 0 ? Number(query.page) : 1;
    const limit = query.limit && query.limit > 0 ? Number(query.limit) : 10;
    const skip = (page - 1) * limit;

    const where: Prisma.SaleWhereInput = {
      merchantId,
      storeId,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      const searchTerm = query.search.trim();
      if (searchTerm) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(searchTerm);
        const orConditions: Prisma.SaleWhereInput[] = [
          {
            saleItems: {
              some: {
                product: {
                  OR: [
                    { name: { contains: searchTerm, mode: 'insensitive' } },
                    { sku: { contains: searchTerm, mode: 'insensitive' } },
                  ],
                },
              },
            },
          },
          {
            payments: {
              some: {
                transactionId: { contains: searchTerm, mode: 'insensitive' },
              },
            },
          },
        ];

        if (isUuid) {
          orConditions.push({ id: searchTerm });
        }

        where.OR = orConditions;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        skip,
        take: limit,
        include: {
          saleItems: {
            include: {
              product: true,
            },
          },
          payments: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.sale.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findById(merchantId: string, storeId: string, saleId: string) {
    return this.prisma.sale.findFirst({
      where: {
        id: saleId,
        merchantId,
        storeId,
      },
      include: {
        saleItems: {
          include: {
            product: true,
          },
        },
        payments: true,
      },
    });
  }
}
