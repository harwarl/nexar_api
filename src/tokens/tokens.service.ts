import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { NetworkDiscoveryService } from 'src/networks/network-discovery.service';
import { ProviderToken, TokenProvider } from 'src/providers/provider.interface';
import { ProvidersService } from 'src/providers/providers.service';
import { TokenData, TokenResponse } from './tokens.interface';

@Injectable()
export class TokensService implements OnModuleInit {
  private readonly logger = new Logger(TokensService.name);
  private tokenCounter = 1;
  private isNetworkDiscovered = false;

  constructor(
    private readonly providerService: ProvidersService,
    private readonly networkDiscovery: NetworkDiscoveryService,
  ) {}

  async onModuleInit() {
    await this.discoverNetworks();
  }

  private async discoverNetworks(): Promise<void> {
    if (!this.isNetworkDiscovered) {
      await this.networkDiscovery.discoverNetworks();
      this.isNetworkDiscovered = true;
      this.logger.log('Network discovery completed');
    }
  }

  async getTokens() {
    if (!this.isNetworkDiscovered) {
      await this.discoverNetworks();
    }

    const providers = this.providerService.getAllProviders();
    const providerResults = await Promise.allSettled(
      providers.map((provider: any) => this.fetchProviderTokens(provider)),
    );

    const allTokens = this.processProviderResults(providerResults);
    const aggregatedTokens = this.aggregateTokens(allTokens);
    const formattedResponse = this.formatTokenResponse(aggregatedTokens);

    return { results: formattedResponse };
  }

  private async fetchProviderTokens(provider: TokenProvider): Promise<{
    provider: string;
    tokens: ProviderToken[];
  }> {
    try {
      const tokens = await provider.fetchSupportedTokens();
      return { provider: provider.name, tokens };
    } catch (error) {
      this.logger.warn(
        `Failed to fetch from ${provider.name}: ${error.message}`,
      );
      return { provider: provider.name, tokens: [] };
    }
  }

  private processProviderResults(
    results: PromiseSettledResult<{
      provider: string;
      tokens: ProviderToken[];
    }>[],
  ): {
    provider: string;
    token: ProviderToken;
  }[] {
    return results
      .filter(
        (
          result,
        ): result is PromiseFulfilledResult<{
          provider: string;
          tokens: ProviderToken[];
        }> => result.status === 'fulfilled',
      )
      .flatMap((result) =>
        result.value.tokens.map((token) => ({
          provider: result.value.provider,
          token,
        })),
      );
  }

  private aggregateTokens(
    tokens: { provider: string; token: ProviderToken }[],
  ): Map<string, TokenData> {
    const tokenMap = new Map<string, TokenData>();

    for (const { provider, token } of tokens) {
      const network =
        this.networkDiscovery.findNetworkByAlias(token.network) ||
        this.networkDiscovery.findNetworkBySlug(token.network);

      if (!network) {
        this.logger.warn(
          `Unknown network: ${token.network} for token ${token.symbol}`,
        );
        continue;
      }

      const key = `${token.symbol}_${network.slug}`;

      if (!tokenMap.has(key)) {
        tokenMap.set(key, {
          code: token.symbol,
          name: token.name || token.symbol,
          networkSlug: network.slug,
          iconUrl: token.iconUrl,
          providers: {},
        });
      }

      const tokenData = tokenMap.get(key);
      tokenData.providers[provider] = {
        symbol: token.symbol,
        isActive: token.isActive !== false,
      };

      // Use first available icon
      if (token.iconUrl && !tokenData.iconUrl) {
        tokenData.iconUrl = token.iconUrl;
      }
    }

    return tokenMap;
  }

  private formatTokenResponse(
    tokenMap: Map<string, TokenData>,
  ): TokenResponse[] {
    const responses: TokenResponse[] = [];
    const now = new Date().toISOString();

    for (const [, tokenData] of tokenMap) {
      const network = this.networkDiscovery.findNetworkBySlug(
        tokenData.networkSlug,
      );
      if (!network) continue;

      const response: TokenResponse = {
        id: this.tokenCounter++,
        token_network: { ...network },
        url_icon: tokenData.iconUrl || null,
        code: tokenData.code,
        code_name: `${tokenData.name} (${network.name})`,
        network_name: network.name,
        is_active: true,
        created_at: now,
        updated_at: now,
        icon: tokenData.iconUrl || null,
        network: network.id,
        // Provider symbols
        ticker_fixedfloat: null,
        ticker_changehero: null,
        ticker_changenow: null,
        ticker_sideshift: null,
        ticker_simpleswap: null,
        ticker_swapuz: null,
        ticker_thechange: null,
        ticker_exolix: null,
        ticker_swaponix: null,
        ticker_nanswap: null,
        ticker_changelly: null,
        // Coingecko fields
        coingecko_id: null,
        coingecko_name: null,
        coingecko_symbol: null,
        coingecko_rank: null,
        last_coingecko_update: null,
      };

      // Set provider-specific symbols
      for (const [providerName, providerData] of Object.entries(
        tokenData.providers,
      )) {
        const symbolKey = `ticker_${providerName}` as keyof TokenResponse;
        if (symbolKey in response) {
          (response as any)[symbolKey] = providerData.symbol;
        }
      }

      responses.push(response);
    }

    return responses;
  }
}
