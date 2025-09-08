import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsEmail } from 'class-validator';

export class CreateTransactionDto {
  @ApiProperty({
    example: 'btc',
    description: 'The cryptocurrency to send',
  })
  @IsString()
  from: string;

  @ApiProperty({
    example: 'eth',
    description: 'The cryptocurrency to receive',
  })
  @IsString()
  to: string;

  @ApiProperty({
    example: '0x32Be343B94f860124dC4fEe278FDCBD38C102D88',
    description: 'The address to send the cryptocurrency to',
  })
  @IsString()
  address: string;

  @ApiProperty({
    example: 0.5,
    description: 'The amount of cryptocurrency to send',
  })
  @IsNumber()
  amount: number;

  @ApiProperty({
    example: 'optional-extra-id',
    description: 'An optional extra identifier for certain cryptocurrencies',
    required: false,
  })
  @IsOptional()
  @IsString()
  extraId?: string;

  @ApiProperty({
    example: 'optional-refund-address',
    description: 'An optional address for refunds if the transaction fails',
    required: false,
  })
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

  @IsOptional()
  @IsEmail()
  contactEmail?: string;
}
