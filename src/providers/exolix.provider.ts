import { Injectable } from '@nestjs/common';
import {
  FetchQuoteResponse,
  ProviderToken,
  QuoteData,
  TokenProvider,
} from './provider.interface';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { AFFILIATE_DATA } from './provider.data';

@Injectable()
export class ExolixProvider implements TokenProvider {
  readonly name = 'exolix';

  constructor(private readonly httpService: HttpService) {}

  async fetchSupportedTokens(): Promise<ProviderToken[]> {
    try {
      const pageSize = 100;
      let page = 1;
      let allTokens: any[] = [];
      let totalCount = 0;

      do {
        const { data } = await firstValueFrom(
          this.httpService.get(
            `${AFFILIATE_DATA.EXOLIX.baseUrl}${AFFILIATE_DATA.EXOLIX.endpoints.tokens}?withNetworks=true&page=${page}&size=${pageSize}`,
            {
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Authorization: AFFILIATE_DATA.EXOLIX.apiKey,
              },
            },
          ),
        );

        if (!data?.data) {
          throw new Error('Invalid response structure from Exolix');
        }

        if (page === 1) {
          totalCount = data.count;
        }

        allTokens = [...allTokens, ...data.data];
        page++;
      } while (allTokens.length < totalCount);

      return this.transformExolixData(allTokens);
    } catch (error) {
      throw new Error(`Failed to fetch ${this.name} tokens: ${error.message}`);
    }
  }

  async fetchQuote(getQuoteData: QuoteData): Promise<FetchQuoteResponse> {
    console.log(
      `${AFFILIATE_DATA.EXOLIX.baseUrl}${AFFILIATE_DATA.EXOLIX.endpoints.getRate}`,
    );
    try {
      const { data } = await firstValueFrom(
        this.httpService.get(
          `${AFFILIATE_DATA.EXOLIX.baseUrl}${AFFILIATE_DATA.EXOLIX.endpoints.getRate}?coinFrom=${getQuoteData.fromCurrency}&networkFrom=${getQuoteData.fromNetwork}&coinTo=${'USDT'}&networkTo=${'ETH'}&amount=${getQuoteData.amount}&rateType=fixed`,
          {
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Authorization: AFFILIATE_DATA.EXOLIX.apiKey,
            },
          },
        ),
      );

      //     data: {
      //   fromAmount: 7000,
      //   toAmount: 621.447083,
      //   rate: 0.08877815,
      //   message: null,
      //   minAmount: 545.05005562,
      //   withdrawMin: 0.175665991137243,
      //   maxAmount: 19017.11307216
      // }
      return {
        isError: false,
        isMessage: false,
        minAmount: data.minAmount,
        maxAmount: data.maxAmount,
        fromAmount: getQuoteData.amount,
        toAmount: data.toAmount,
        rate: data.rate,
        message: data.message ?? '',
      };
    } catch (error) {
      // ['message', 'name', 'code', 'config', 'request', 'response', 'status'];
      if (error.response.data.error) {
        return {
          isError: true,
          isMessage: true,
          minAmount: 0,
          maxAmount: 0,
          fromAmount: getQuoteData.amount,
          toAmount: 0,
          rate: 0,
          message: error.response.data.message ?? '',
        };
      } else {
        return {
          isError: true,
          isMessage: false,
          minAmount: 0,
          maxAmount: 0,
          fromAmount: getQuoteData.amount,
          toAmount: 0,
          rate: 0,
          message: error.response.data.error ?? '',
        };
      }
    }
  }

  private transformExolixData(exolixTokens: any[]): ProviderToken[] {
    const transformedTokens: ProviderToken[] = [];

    for (const token of exolixTokens) {
      if (!token.networks || token.networks.length === 0) continue;

      for (const network of token.networks) {
        transformedTokens.push({
          symbol: token.code,
          network: network.network,
          isActive: true,
          name: token.name,
          iconUrl: token.icon,
        });
      }
    }

    return transformedTokens;
  }
}
