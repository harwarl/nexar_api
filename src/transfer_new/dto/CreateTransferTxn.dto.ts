import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateTransferTransactionDto {
  @IsString()
  token: string; // TOKEN TICKER

  @IsString()
  recipientAddress: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  isTestnet?: boolean;
}
