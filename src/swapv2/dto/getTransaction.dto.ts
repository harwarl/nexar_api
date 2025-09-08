import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class GetTransactionDto {
  @ApiProperty({
    example: 'unique-request-id-123',
    description: 'A unique identifier for the swap request',
  })
  @IsString()
  uuid_request: string;
}
