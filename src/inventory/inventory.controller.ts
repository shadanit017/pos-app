import { Controller, Get, Post, Patch, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { StoreAccessGuard } from '../common/guards/store-access.guard';
import { Role } from '@prisma/client';

@Controller('stores/:storeId/inventory')
@UseGuards(RolesGuard, StoreAccessGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) { }

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER)
  async createOrUpdate(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: CreateInventoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.createOrUpdate(user.merchantId, storeId, dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.MANAGER, Role.CASHIER)
  async findAll(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.getStoreInventory(user.merchantId, storeId);
  }

  @Get(':productId')
  @Roles(Role.ADMIN, Role.MANAGER, Role.CASHIER)
  async findOne(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.getProductInventory(user.merchantId, storeId, productId);
  }

  @Patch(':productId')
  @Roles(Role.ADMIN, Role.MANAGER)
  async update(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: UpdateInventoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.updateInventory(user.merchantId, storeId, productId, dto);
  }
}
