import { BadRequestException, Injectable, Query } from '@nestjs/common';
import { GetTokensQueryDto } from './dto/getTokensQuery.dto';
import { GetSwapRequestDto } from './dto/getSwapRequest.dto';
import { TokensService } from 'src/tokens/tokens.service';

@Injectable()
export class Swapv2Service {
  constructor(private readonly tokenService: TokensService) {}

  // TODO: Paginate this, let there be the next, previous
  async getTokens(getTokensQuery: GetTokensQueryDto) {
    return this.tokenService.getTokens(getTokensQuery);
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
