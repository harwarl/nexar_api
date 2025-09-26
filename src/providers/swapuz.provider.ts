import { Injectable } from '@nestjs/common';
import {
  ProviderNetwork,
  ProviderToken,
  QuoteData,
  TokenProvider,
  TransactionResponse,
} from './provider.interface';
import { AFFILIATE_DATA, AFFILIATES } from './provider.data';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SwapuzProvider implements TokenProvider {
  readonly name: string = AFFILIATE_DATA.SWAPUZ.name;

  constructor(private readonly httpService: HttpService) {}

  async fetchSupportedTokens(): Promise<ProviderToken[]> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get(`
        ${AFFILIATE_DATA.SWAPUZ.baseUrl}${AFFILIATE_DATA.SWAPUZ.endpoint.tokens}
        `),
      );

      return this.transformSwapUzResponse(data.result);
    } catch (error) {
      throw new Error(`Failed to fetch ${this.name} tokens: ${error.message}`);
    }
  }

  async fetchQuote(getQuoteData: QuoteData): Promise<any> {
    return;
  }

  async fetchSupportedNetworks(): Promise<ProviderNetwork[]> {
    return;
  }

  async fetchTransactionByTransactionId(
    tx_id: string,
  ): Promise<TransactionResponse> {
    return;
  }

  private transformSwapUzResponse(swapuzTokens: any[]): ProviderToken[] {
    const transformedTokens: ProviderToken[] = [];

    for (const token of swapuzTokens) {
      if (!token.network || token.network.length === 0) continue;

      for (const network of token.network) {
        transformedTokens.push({
          symbol: token.shortName,
          network: network.shortName,
          isActive: network.isActive,
          name: token.name,
          iconUrl: token.image,
        });
      }
    }

    return transformedTokens;
  }
}
