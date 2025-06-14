import { Body, Controller, Post } from '@nestjs/common';
import { TransferService } from './transfer.service';
import { CreateTransferTransactionDto } from './dto/CreateTransferTransaction.dto';
import { VerifyTransactionHashDto } from './dto/VerifyTransactionHash.dto';
import { StartTransferTransactionDto } from './dto/StartTransferProcess.dto';

@Controller({ path: 'transfer', version: '1' })
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  // @Post('/')
  async createTransferTransaction(
    @Body() createTransferTransactionDto: CreateTransferTransactionDto,
  ) {
    return await this.transferService.createTransaction(
      createTransferTransactionDto,
    );
  }

  // @Post('/verify-hash')
  async verifyTransactionHash(
    @Body() verifyTransactionHashDto: VerifyTransactionHashDto,
  ) {
    return await this.transferService.verifyTransactionHash(
      verifyTransactionHashDto,
    );
  }

  // @Post('/start-transfer')
  async startTransfer(@Body() startTransferDto: StartTransferTransactionDto) {
    return await this.transferService.startTransferProcess(startTransferDto);
  }
}
