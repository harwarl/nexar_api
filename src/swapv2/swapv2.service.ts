import { BadRequestException, Injectable, Query } from '@nestjs/common';
import { GetTokensQuery } from './dto/getTokensQuery.dto';
import { GetSwapRequestDto } from './dto/getSwapRequest.dto';
import { TokensService } from 'src/tokens/tokens.service';

@Injectable()
export class Swapv2Service {
  constructor(private readonly tokenService: TokensService) {}

  async getTokens(getTokensQuery: GetTokensQuery) {
    return this.tokenService.getTokens();
  }

  async swapRequest(getSwapRequest: GetSwapRequestDto) {
    const { from_currency, to_currency, from_network, to_network, amount } =
      getSwapRequest;

    if (
      !from_currency ||
      !to_currency ||
      !from_network ||
      !to_network ||
      !amount
    ) {
      throw new BadRequestException('Incomplete parameters');
    }

    // Check one of the partners for the prices
  }
}
