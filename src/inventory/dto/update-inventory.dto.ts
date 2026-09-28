import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateInventoryDto {
  @IsInt()
  @Min(0, { message: 'Quantity must be greater than or equal to 0' })
  @Type(() => Number)
  quantity: number;
}
