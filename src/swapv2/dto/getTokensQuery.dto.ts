import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class GetTokensQueryDto {
  @ApiProperty({
    example: 1,
    description: 'The page number for pagination',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  page: number;

  @ApiProperty({
    example: 'ETH',
    description: 'A search term to filter tokens by name or symbol',
    required: false,
  })
  @IsString()
  @IsOptional()
  search: string;

  @ApiProperty({
    example: 'ETH',
    description: 'The network to filter tokens by (e.g., ETH, BSC, BTC)',
    required: false,
  })
  @IsString()
  @IsOptional()
  network: string;

  @ApiProperty({
    example: true,
    description: 'Indicates whether to fetch only active tokens',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive: boolean;
}
