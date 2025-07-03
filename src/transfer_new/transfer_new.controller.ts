import { Body, Controller, Post } from '@nestjs/common';
import { TransferNewService } from './transfer_new.service';
import { CreateTransferTransactionDto } from './dto/CreateTransferTxn.dto';

@Controller('transfer-new')
export class TransferNewController {
  constructor(private readonly transferNewService: TransferNewService) {}

  @Post('/create_transaction')
  async createTransaction(
    @Body() createTransactionPayload: CreateTransferTransactionDto,
  ) {
    const transactionDetails = await this.transferNewService.createTransaction(
      createTransactionPayload,
    );

    return transactionDetails;
  }
}
