import { BadRequestException, Injectable, Query } from '@nestjs/common';
import { GetTokensQueryDto } from './dto/getTokensQuery.dto';
import { GetSwapRequestDto } from './dto/getSwapRequest.dto';
import { TokensService } from 'src/tokens/tokens.service';
import { ExchangeService } from 'src/exchange/exchange.service';

@Injectable()
export class Swapv2Service {
  constructor(
    private readonly tokenService: TokensService,
    private readonly exchangeService: ExchangeService,
  ) {}

  // TODO: Paginate this, let there be the next, previous
  async getTokens(getTokensQuery: GetTokensQueryDto) {
    return this.tokenService.getTokens(getTokensQuery);
  }

  async swapRequest(getSwapRequest: GetSwapRequestDto) {
    return this.exchangeService.getExchangeRate(getSwapRequest);
  }
}
