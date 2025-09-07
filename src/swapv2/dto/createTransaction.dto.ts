import { IsString, IsNumber, IsOptional, IsEmail } from 'class-validator';

export class CreateTransactionDto {
  @IsString()
  from: string;

  @IsString()
  to: string;

  @IsString()
  address: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  extraId?: string;

  @IsOptional()
  @IsString()
  refundAddress?: string;

  @IsOptional()
  @IsString()
  refundExtraId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  payload?: string;
}
