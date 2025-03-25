import { IsString, IsNumber } from 'class-validator';

export class StartTransferTransactionDto {
  @IsString()
  transactionId: string;
}
