import { BadRequestException, Injectable, Query } from '@nestjs/common';
import { GetTokensQueryDto } from './dto/getTokensQuery.dto';
import { GetSwapRequestDto } from './dto/getSwapRequest.dto';
import { TokensService } from 'src/tokens/tokens.service';
import { ExchangeService } from 'src/exchange/exchange.service';
import { StartSwapDto } from './dto/startSwap.dto';

@Injectable()
export class Swapv2Service {
  constructor(
    private readonly tokenService: TokensService,
    private readonly exchangeService: ExchangeService,
  ) {}

  async getTokens(getTokensQuery: GetTokensQueryDto) {
    return this.tokenService.getTokens(getTokensQuery);
  }

  async swapRequest(getSwapRequest: GetSwapRequestDto) {
    return this.exchangeService.getExchangeRate(getSwapRequest);
  }

  async startSwap(startSwapDto: StartSwapDto) {
    return this.exchangeService.startSwap(startSwapDto);
  }
}
