import { Injectable } from '@nestjs/common';
import { ProviderToken, TokenProvider } from './provider.interface';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { symbol } from 'joi';
import { ConfigService } from '@nestjs/config';
import { AFFILIATE_DATA } from './provider.data';

@Injectable()
export class ExolixProvider implements TokenProvider {
  readonly name = 'exolix';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

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
