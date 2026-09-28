import { IsInt, IsNotEmpty, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInventoryDto {
  @IsUUID('4', { message: 'productId must be a valid UUID' })
  @IsNotEmpty()
  productId: string;

  @IsInt()
  @Min(0, { message: 'Quantity must be greater than or equal to 0' })
  @Type(() => Number)
  quantity: number;
}
