import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Swapv2Service } from './swapv2.service';
import { GetTokensQueryDto } from './dto/getTokensQuery.dto';
import { GetSwapRequestDto } from './dto/getSwapRequest.dto';

@Controller({ path: 'swap', version: '2' })
export class Swapv2Controller {
  constructor(private readonly swapv2Service: Swapv2Service) {}

  @Get('tokens')
  async getAllTokens(@Query() getTokensQuery: GetTokensQueryDto) {
    return this.swapv2Service.getTokens(getTokensQuery);
  }

  // Post Swap Request
  // This will return all the partners amounts
  // This also creates a transaction body that will be saved for the user
  @Post('swap_request')
  async postSwapRequest(@Body() swapRequestDto: GetSwapRequestDto) {
    return this.swapv2Service.swapRequest(swapRequestDto);
  }

  // Get the minimal Amount
  // This is needed to get the minial Amount for the transfer
  async getMinimalAmount() {}

  // Get the Exchange Amounts for all Exchanges
  async getExchangeAmount() {}

  // Get the transaction Id
  async getTransaction() {}

  // Create transaction
  async postCreateTransaction() {}
}
