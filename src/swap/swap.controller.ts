import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { SwapServiceV1 } from './swap.service';
import { CreateTransactionDto } from './dto/createTransaction.dto';

@Controller({ path: 'swap', version: '1' })
export class SwapControllerV1 {
  constructor(private readonly swapService: SwapServiceV1) {}

  @Get('tokens')
  async getTokens() {
    return await this.swapService.getTokens();
  }

  @Get('min-amount/:from_to')
  async getMinimalAmount(@Param('from_to') tokens: string) {
    const [from, to] = tokens.split('_');
    return await this.swapService.getMinimalAmount(from, to);
  }

  @Get('exchange-amount/:amount/:from_to')
  async getExchangeAmount(
    @Param('amount') amount: number,
    @Param('from_to') tokens: string,
  ) {
    const [from, to] = tokens.split('_');
    return await this.swapService.getEstimatedExchangeAmount(amount, from, to);
  }

  @Get('transactions/:transactionId')
  async getTransactionDetails(@Param('transactionId') transactionId: string) {
    return await this.swapService.getTransactionFromId(transactionId);
  }

  @Get('transactions/inApp/:transactionId')
  async isInAppTx(@Param('transactionId') transactionId: string) {
    return await this.swapService.isInAppTx(transactionId);
  }

  @Post('transactions')
  async createTransaction(@Body() createTransactionDto: CreateTransactionDto) {
    return await this.swapService.createTransaction(createTransactionDto);
  }
}
