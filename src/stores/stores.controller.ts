import { Controller, Get, Param } from '@nestjs/common';
import { StoresService } from './stores.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';

@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.storesService.findAllForUser(user.userId, user.merchantId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.storesService.findOneForUser(id, user.userId, user.merchantId);
  }
}
