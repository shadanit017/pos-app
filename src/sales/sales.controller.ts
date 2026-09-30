import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  UseGuards,
  Query,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SaleQueryDto } from './dto/sale-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { StoreAccessGuard } from '../common/guards/store-access.guard';
import { Role } from '@prisma/client';

@Controller('stores/:storeId/sales')
@UseGuards(RolesGuard, StoreAccessGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER, Role.CASHIER)
  async create(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: CreateSaleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    return this.salesService.createSale(user, storeId, idempotencyKey, dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.MANAGER, Role.CASHIER)
  async findAll(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SaleQueryDto,
  ) {
    return this.salesService.findAllByStore(user.merchantId, storeId, query);
  }

  @Get(':saleId')
  @Roles(Role.ADMIN, Role.MANAGER, Role.CASHIER)
  async findOne(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('saleId', ParseUUIDPipe) saleId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salesService.findOne(user.merchantId, storeId, saleId);
  }
}
