import { IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SaleItemDto {
  @IsUUID('4', { message: 'productId must be a valid UUID' })
  @IsNotEmpty()
  productId: string;

  @IsInt()
  @Min(1, { message: 'Quantity must be at least 1' })
  @Type(() => Number)
  quantity: number;
}

export class PaymentOptionsDto {
  @IsEnum(['SUCCESS', 'FAILED'], { message: 'payment must be SUCCESS or FAILED' })
  @IsOptional()
  simulate?: 'SUCCESS' | 'FAILED';
}

export class CreateSaleDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  @IsNotEmpty()
  items: SaleItemDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentOptionsDto)
  payment?: PaymentOptionsDto;
}
