import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import {
  ProviderNetwork,
  ProviderToken,
  TokenProvider,
} from './provider.interface';
import { firstValueFrom } from 'rxjs';
import { AFFILIATE_DATA, NETWORK_MAPPINGS } from './provider.data';

interface CoinGeckoCoin {
  id: string;
  symbol: string;
  name: string;
  platforms: { [platform: string]: string };
}

@Injectable()
export class CoingeckoProvider implements TokenProvider {
  private readonly logger = new Logger(CoingeckoProvider.name);
  readonly name = AFFILIATE_DATA.COINGECKO.name;

  constructor(private readonly httpService: HttpService) {}

  async fetchSupportedTokens(): Promise<ProviderToken[]> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<CoinGeckoCoin[]>(
          `${AFFILIATE_DATA.COINGECKO.baseUrl}/list?include_platform=true`,
          {
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              'x-cg-demo-api-key': AFFILIATE_DATA.COINGECKO.apiKey,
            },
          },
        ),
      );

      if (!data || data.length === 0) {
        throw new Error('Invalid response structure from Coingecko');
      }

      return this.transformCoinsToTokens(data);
    } catch (error) {
      this.logger.error(`Failed to fetch CoinGecko coins: ${error.message}`);
      throw new Error(`CoinGecko API error: ${error.message}`);
    }
  }

  async getTokenPriceInUSD(coingeckoId: string): Promise<{
    priceInUsd: string;
  }> {
    if (!coingeckoId) throw new Error('Invalid coingecko Id');

    try {
      const { data } = await firstValueFrom(
        this.httpService.get(
          `${AFFILIATE_DATA.COINGECKO.baseUrl}${coingeckoId}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false&dex_pair_format=symbol`,
          {
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              'x-cg-demo-api-key': AFFILIATE_DATA.COINGECKO.apiKey,
            },
          },
        ),
      );

      if (!data || !data?.market_data?.current_price?.usd) {
        throw new Error('Invalid response structure from Coingecko');
      }

      return {
        priceInUsd: data.market_data.current_price.usd,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch CoinGecko coins: ${error.message}`);
      throw new Error(`CoinGecko API error: ${error.message}`);
    }
  }

  private async transformCoinsToTokens(
    coins: CoinGeckoCoin[],
  ): Promise<ProviderToken[]> {
    const tokens: ProviderToken[] = [];

    for (const coin of coins) {
      if (!coin.platforms || Object.keys(coin.platforms).length === 0) {
        tokens.push({
          symbol: coin.symbol.toUpperCase(),
          network: coin.symbol.toUpperCase(),
          iconUrl: '',
          isActive: true,
          providerMetadata: {
            coingecko_id: coin.id,
            coingecko_name: coin.name,
            coingecko_symbol: coin.symbol,
          },
        });
        continue;
      }

      for (const [platform, contractAddress] of Object.entries(
        coin.platforms,
      )) {
        if (contractAddress && contractAddress.trim() !== '') {
          const network = this.normalizePlatformName(platform);
          const alias = platform; // Return the platform name as the alias

          tokens.push({
            symbol: coin.symbol.toUpperCase(),
            network: network,
            aliasNetwork: alias,
            name: coin.name,
            iconUrl: '',
            isActive: true,
            providerMetadata: {
              coingecko_id: coin.id,
              coingecko_name: coin.name,
              coingecko_symbol: coin.symbol,
            },
          });
        }
      }
    }
    this.logger.log(
      `Transformed ${coins.length} CoinGecko coins to ${tokens.length} tokens`,
    );

    // console.log({ tokens });
    return tokens;
  }

  private normalizePlatformName(platform: string): string | null {
    // Direct mapping from known platforms
    if (NETWORK_MAPPINGS[platform]) {
      return NETWORK_MAPPINGS[platform];
    }

    // Try to infer from platform name
    const lowerPlatform = platform.toLowerCase();

    if (lowerPlatform.includes('ethereum')) return 'ETH';
    if (lowerPlatform.includes('binance')) return 'BSC';
    if (lowerPlatform.includes('polygon')) return 'POLYGON';
    if (lowerPlatform.includes('arbitrum')) return 'ARBITRUM';
    if (lowerPlatform.includes('optimism')) return 'OPTIMISM';
    if (lowerPlatform.includes('avalanche')) return 'AVAX';
    if (lowerPlatform.includes('fantom')) return 'FANTOM';
    if (lowerPlatform.includes('solana')) return 'SOL';
    if (lowerPlatform.includes('cardano')) return 'CARDANO';
    if (lowerPlatform.includes('polkadot')) return 'POLKADOT';
    if (lowerPlatform.includes('cosmos')) return 'COSMOS';
    if (lowerPlatform.includes('tron')) return 'TRX';
    if (lowerPlatform.includes('bitcoin')) return 'BTC';
    if (lowerPlatform.includes('litecoin')) return 'LTC';
    if (lowerPlatform.includes('ripple')) return 'XRP';
    if (lowerPlatform.includes('dogecoin')) return 'DOGE';
    if (lowerPlatform.includes('monero')) return 'XMR';

    // If no mapping found, return null or the original platform in uppercase
    return platform.toUpperCase();
  }
}
