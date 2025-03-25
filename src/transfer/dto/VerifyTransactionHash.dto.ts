import { IsString, IsNumber } from 'class-validator';

export class VerifyTransactionHashDto {
  @IsString()
  transactionId: string;

  @IsString()
  transactionHash: string;
}
