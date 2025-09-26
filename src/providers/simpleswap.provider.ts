import { Injectable } from '@nestjs/common';
import { ProviderToken, TokenProvider } from './provider.interface';
import { AFFILIATE_DATA } from './provider.data';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { networkMappings } from 'utils/constants';
import { symbol } from 'joi';

@Injectable()
export class SimpleSwapProvider implements TokenProvider {
  readonly name: string = AFFILIATE_DATA.SIMPLESWAP.name;

  constructor(private readonly httpService: HttpService) {}

  async fetchSupportedTokens(): Promise<ProviderToken[]> {
    console.log(
      `${AFFILIATE_DATA.SIMPLESWAP.baseUrl}${AFFILIATE_DATA.SIMPLESWAP.endpoint.tokens}?api_key=${AFFILIATE_DATA.SIMPLESWAP.apiKey}`,
    );
    try {
      const { data } = await firstValueFrom(
        this.httpService.get(`
          ${AFFILIATE_DATA.SIMPLESWAP.baseUrl}${AFFILIATE_DATA.SIMPLESWAP.endpoint.tokens}?api_key=${AFFILIATE_DATA.SIMPLESWAP.apiKey}
          `),
      );

      return this.transformSimpleSwapResponse(data);
    } catch (error) {
      throw new Error(`Failed to fetch ${this.name} tokens: ${error.message}`);
    }
  }

  private transformSimpleSwapResponse(
    simpleSwapTokens: any[],
  ): ProviderToken[] {
    const transformedTokens: ProviderToken[] = [];

    for (const token of simpleSwapTokens) {
      if (!token.network) continue;

      const { symbol, network, alias } = this.parseTicker(
        token.symbol,
        token.network,
      );

      if (symbol && network) {
        transformedTokens.push({
          symbol,
          aliasSymbol: token.symbol,
          network: network,
          aliasNetwork: network,
          iconUrl: token.image,
          isActive: true,
        });
      }
    }

    return transformedTokens;
  }

  private parseTicker(
    origSymbol: string,
    origNetwork: string,
  ): {
    symbol: string;
    network: string;
    alias?: string; // Alias for the network
  } {
    for (const [networkSuffix, networkName] of Object.entries(
      networkMappings,
    )) {
      if (origSymbol.endsWith(networkSuffix)) {
        const symbol = origSymbol.slice(0, -networkSuffix.length).toUpperCase();
        return {
          symbol,
          network: origNetwork,
          alias: networkSuffix.toUpperCase(),
        };
      }
    }
    return {
      symbol: origSymbol,
      network: origNetwork,
    };
  }
}
