import { Injectable } from '@nestjs/common';
import { ProviderToken, TokenProvider } from './provider.interface';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { symbol } from 'joi';

@Injectable()
export class ExolixProvider implements TokenProvider {
  readonly name = 'exolix';

  constructor(private readonly httpService: HttpService) {}

  async fetchSupportedTokens(): Promise<ProviderToken[]> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get('', {
          params: {
            withNetworks: true,
            page: 1,
            size: 100,
          },
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }),
      );

      if (!data?.data) {
        throw new Error('Invalid response structure from Exolix');
      }

      return data.map((item: any) => ({
        symbol: item.code,
        network: item.network,
        name: item.name,
        isActive: item.status === 'active',
      }));
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
