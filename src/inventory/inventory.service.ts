import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InventoryRepository } from './inventory.repository';
import { ProductsRepository } from '../products/products.repository';
import { RedisService } from '../redis/redis.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';

@Injectable()
export class InventoryService {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly productsRepository: ProductsRepository,
    private readonly redisService: RedisService,
  ) { }

  private getCacheKey(merchantId: string, storeId: string): string {
    return `inventory:${merchantId}:${storeId}`;
  }

  async createOrUpdate(merchantId: string, storeId: string, dto: CreateInventoryDto) {
    const product = await this.productsRepository.findById(merchantId, dto.productId);
    if (!product) {
      throw new NotFoundException('Product not found or does not belong to merchant');
    }

    const inventory = await this.inventoryRepository.createOrUpdate(storeId, dto.productId, dto.quantity);
    await this.redisService.del(this.getCacheKey(merchantId, storeId));
    return inventory;
  }

  async getStoreInventory(merchantId: string, storeId: string) {
    const cacheKey = this.getCacheKey(merchantId, storeId);
    const cached = await this.redisService.get<any[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const inventories = await this.inventoryRepository.findAllByStore(storeId);
    await this.redisService.set(cacheKey, inventories, 300);
    return inventories;
  }

  async getProductInventory(merchantId: string, storeId: string, productId: string) {
    const product = await this.productsRepository.findById(merchantId, productId);
    if (!product) {
      throw new NotFoundException('Product not found or does not belong to merchant');
    }

    const inventory = await this.inventoryRepository.findByStoreAndProduct(storeId, productId);
    if (!inventory) {
      throw new NotFoundException('Inventory record not found for this product in store');
    }
    return inventory;
  }

  async updateInventory(
    merchantId: string,
    storeId: string,
    productId: string,
    dto: UpdateInventoryDto,
  ) {
    const product = await this.productsRepository.findById(merchantId, productId);
    if (!product) {
      throw new NotFoundException('Product not found or does not belong to merchant');
    }

    const updated = await this.inventoryRepository.createOrUpdate(storeId, productId, dto.quantity);
    await this.redisService.del(this.getCacheKey(merchantId, storeId));
    return updated;
  }

  async invalidateCache(merchantId: string, storeId: string): Promise<void> {
    await this.redisService.del(this.getCacheKey(merchantId, storeId));
  }
}
