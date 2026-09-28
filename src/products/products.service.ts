import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { ProductsRepository } from './products.repository';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly repository: ProductsRepository) {}

  async create(merchantId: string, createDto: CreateProductDto) {
    const existing = await this.repository.findBySku(merchantId, createDto.sku);
    if (existing) {
      throw new ConflictException(`Product with SKU '${createDto.sku}' already exists for this merchant`);
    }

    return this.repository.create(merchantId, createDto);
  }

  async findAll(merchantId: string, query: ProductQueryDto = {}) {
    return this.repository.findAll(merchantId, query);
  }

  async findOne(merchantId: string, id: string) {
    const product = await this.repository.findById(merchantId, id);
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async update(merchantId: string, id: string, updateDto: UpdateProductDto) {
    await this.findOne(merchantId, id);

    if (updateDto.sku) {
      const existingSku = await this.repository.findBySku(merchantId, updateDto.sku);
      if (existingSku && existingSku.id !== id) {
        throw new ConflictException(`Product with SKU '${updateDto.sku}' already exists`);
      }
    }

    await this.repository.update(merchantId, id, updateDto);
    return this.findOne(merchantId, id);
  }

  async remove(merchantId: string, id: string) {
    await this.findOne(merchantId, id);
    await this.repository.delete(merchantId, id);
    return { success: true, message: 'Product deleted successfully' };
  }
}
