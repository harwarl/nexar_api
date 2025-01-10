import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { SwapServiceV1 } from './swap.service';
import { CreateTransactionDto } from './dto/createTransaction.dto';

@Controller({ path: 'swap', version: '1' })
export class SwapControllerV1 {
  constructor(private readonly swapService: SwapServiceV1) {}

  @Get('tokens')
  async getTokens() {
    return this.swapService.getTokens();
  }

  @Get('min-amount/:from_to')
  async getMinimalAmount(@Param('from_to') tokens: string) {
    const [from, to] = tokens.split('_');
    return this.swapService.getMinimalAmount(from, to);
  }

  @Get('exchange-amount/:amount/:from_to')
  async getExchangeAmount(
    @Param('amount') amount: number,
    @Param('from_to') tokens: string,
  ) {
    const [from, to] = tokens.split('_');
    return this.swapService.getEstimatedExchangeAmount(amount, from, to);
  }

  @Get('transactions/:transactionId')
  async getTransactionDetails(@Param('transactionId') transactionId: string) {
    return this.swapService.getTransactionFromId(transactionId);
  }

  @Post('transactions')
  async createTransaction(@Body() createTransactionDto: CreateTransactionDto) {
    return this.swapService.createTransaction(createTransactionDto);
  }
}
