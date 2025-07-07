import { IsString, IsNumber } from 'class-validator';

export class StartTransferTxnDto {
  @IsString()
  transactionId: string;
}
