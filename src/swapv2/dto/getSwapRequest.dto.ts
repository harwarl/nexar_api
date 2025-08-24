import { IsNumber, IsString } from 'class-validator';

export class GetSwapRequestDto {
  @IsString()
  from_currency: string;
  @IsString()
  to_currency: string;
  @IsString()
  from_network: string;
  @IsString()
  to_network: string;
  @IsNumber()
  amount: number;
}
