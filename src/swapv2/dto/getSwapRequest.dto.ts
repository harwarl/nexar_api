import { IsNumber, IsString } from 'class-validator';

export class GetSwapRequestDto {
  @IsString()
  direction: string;

  @IsString()
  from_amount: string;

  @IsString()
  from_currency: string;

  @IsString()
  from_network: string;

  @IsString()
  to_currency: string;

  @IsString()
  to_network: string;

  @IsString()
  uuid_request: string;
}
