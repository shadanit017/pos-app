import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { Product, Prisma } from '@prisma/client';

@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(merchantId: string, dto: CreateProductDto) {
    return this.prisma.product.create({
      data: {
        merchantId,
        sku: dto.sku,
        name: dto.name,
        price: dto.price,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findAll(merchantId: string, query: ProductQueryDto = {}): Promise<PaginatedResult<Product>> {
    const page = query.page && query.page > 0 ? Number(query.page) : 1;
    const limit = query.limit && query.limit > 0 ? Number(query.limit) : 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      merchantId,
    };

    if (query.search) {
      const searchTerm = query.search.trim();
      if (searchTerm) {
        where.OR = [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { sku: { contains: searchTerm, mode: 'insensitive' } },
        ];
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
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

  async findById(merchantId: string, id: string) {
    return this.prisma.product.findFirst({
      where: {
        id,
        merchantId,
      },
    });
  }

  async findBySku(merchantId: string, sku: string) {
    return this.prisma.product.findUnique({
      where: {
        merchantId_sku: {
          merchantId,
          sku,
        },
      },
    });
  }

  async update(merchantId: string, id: string, dto: UpdateProductDto) {
    return this.prisma.product.updateMany({
      where: {
        id,
        merchantId,
      },
      data: dto,
    });
  }

  async delete(merchantId: string, id: string) {
    return this.prisma.product.deleteMany({
      where: {
        id,
        merchantId,
      },
    });
  }
}
