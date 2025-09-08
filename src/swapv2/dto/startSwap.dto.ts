import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class StartSwapDto {
  @ApiProperty({
    example: 'unique-request-id-123',
    description: 'A unique identifier for the swap request',
  })
  @IsString()
  uuid_request: string;

  @ApiProperty({
    example: '0x32Be343B94f860124dC4fEe278FDCBD38C102D88',
    description: 'The address to receive the swapped cryptocurrency',
  })
  @IsString()
  recipient_address: string;

  @ApiProperty({
    example: 'ETH',
    description: 'The slug of the network to swap from (e.g., ETH, BSC, BTC)',
  })
  @IsString()
  from_network: string;

  @ApiProperty({
    example: 'BTC',
    description: 'The slug of the network to swap to (e.g., ETH, BSC, BTC)',
  })
  @IsString()
  to_network: string;

  @ApiProperty({
    example: 'ProviderX',
    description: 'The selected provider for the swap',
  })
  @IsString()
  selected_provider: string;

  @ApiProperty({
    example: 'quote-uid-456',
    description: 'The unique identifier for the selected quote',
  })
  @IsString()
  selected_quote_uid: string;

  @ApiProperty({
    example: 'optional-refund-address',
    description: 'An optional address for refunds if the swap fails',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsOptional()
  refund_address?: string;
}
