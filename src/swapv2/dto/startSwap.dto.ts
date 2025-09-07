import { IsOptional, IsString } from 'class-validator';

export class StartSwapDto {
  @IsString()
  uuid_request: string;

  @IsString()
  recipient_address: string;

  @IsString()
  selected_provider: string;

  @IsString()
  selected_quote_uid: string;

  @IsString()
  @IsOptional()
  refund_address?: string;
}
