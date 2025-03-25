import { IsString, IsNumber } from 'class-validator';

export class CreateTransferTransactionDto {
  @IsString()
  from: string;

  @IsString()
  to: string;

  @IsString()
  address: string;

  @IsNumber()
  amount: number;
}
