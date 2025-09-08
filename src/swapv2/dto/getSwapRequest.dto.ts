import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsString } from 'class-validator';

export class GetSwapRequestDto {
  @ApiProperty({
    example: 'SEND',
    description: 'The direction of the swap, either "send" or "receive"',
  })
  @IsString()
  direction: string;

  @ApiProperty({
    example: '0.5',
    description:
      'The amount to swap, represented as a string to preserve precision',
  })
  @IsString()
  from_amount: string;

  @ApiProperty({
    example: 'BTC',
    description: 'The code of the currency to swap from',
  })
  @IsString()
  from_currency: string;

  @ApiProperty({
    example: 'BTC',
    description: 'The slug of the network to swap from (e.g., ETH, BSC, BTC)',
  })
  @IsString()
  from_network: string;

  @ApiProperty({
    example: 'ETH',
    description: 'The code of the currency to swap to',
  })
  @IsString()
  to_currency: string;

  @ApiProperty({
    example: 'ETH',
    description: 'The slug of the network to swap to (e.g., ETH, BSC, BTC)',
  })
  @IsString()
  to_network: string;

  @ApiProperty({
    example: 'unique-request-id-123',
    description: 'A unique identifier for the swap request',
  })
  @IsString()
  uuid_request: string;

  @ApiProperty({
    example: true,
    description: 'Indicates whether this is an initial request or a follow-up',
  })
  @IsBoolean()
  init: boolean;
}
