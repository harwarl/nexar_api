import { Controller, Get, Query } from '@nestjs/common';
import { Swapv2Service } from './swapv2.service';
import { GetTokensQuery } from './dto/getTokensQuery.dto';

@Controller({ path: 'swap', version: '2' })
export class Swapv2Controller {
  constructor(private readonly swapv2Service: Swapv2Service) {}

  @Get('all_tokens')
  async getAllTokens(@Query() getTokensQuery: GetTokensQuery) {
    return this.swapv2Service.getTokens(getTokensQuery);
  }
}
