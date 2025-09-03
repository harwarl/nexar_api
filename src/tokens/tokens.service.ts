import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { NetworkDiscoveryService } from 'src/networks/network-discovery.service';
import { ProviderToken, TokenProvider } from 'src/providers/provider.interface';
import { ProvidersService } from 'src/providers/providers.service';
import { TokenData, TokenResponse } from './tokens.interface';
import { AFFILIATE_DATA } from 'src/providers/provider.data';

@Injectable()
export class TokensService implements OnModuleInit {
  private readonly logger = new Logger(TokensService.name);
  private tokenCounter = 1;
  private isNetworkDiscovered = false;
  private allTokens: any[] = [];
  private lastUpdated: Date | null = null;

  constructor(
    private readonly providerService: ProvidersService,
    private readonly networkDiscovery: NetworkDiscoveryService,
  ) {}

  async onModuleInit() {
    this.logger.log('---- Loading the networks -----');
    await this.discoverNetworks();
    this.logger.log('---- Networks Loaded ----');
    this.logger.log('Start Token Aggregation ...');
    await this.loadAllTokens();
    this.logger.log(
      `Token aggregation completed. Loaded ${this.allTokens.length} tokens.`,
    );
  }

  private async discoverNetworks(): Promise<void> {
    if (!this.isNetworkDiscovered) {
      await this.networkDiscovery.discoverNetworks();
      this.isNetworkDiscovered = true;
      this.logger.log('Network discovery completed');
    }
  }

  async loadAllTokens() {
    if (!this.isNetworkDiscovered) {
      await this.discoverNetworks();
    }

    const providers = this.providerService.getAllProviders();
    const providerResults = await Promise.allSettled(
      providers.map((provider: any) => this.fetchProviderTokens(provider)),
    );

    const allTokens = this.processProviderResults(providerResults);
    const aggregatedTokens = this.aggregateTokens(allTokens);
    const formattedTokens = this.formatTokenResponse(aggregatedTokens);
    this.allTokens = this.filterTokensWithProvider(formattedTokens);

    // Remove tokens without provider backing
    this.lastUpdated = new Date();
  }

  getAllTokens(): TokenResponse[] {
    return this.allTokens;
  }

  async getTokens(query: any): Promise<{
    results: TokenResponse[];
    pagination: any;
    last_updated: string;
  }> {
    const { page = 1, limit = 100, search, network, isActive } = query;

    // Filter tokens based on query parameters
    let filteredTokens = this.allTokens;

    if (search) {
      const searchLower = search.toLowerCase();
      filteredTokens = filteredTokens.filter((token: any) => {
        token.code.toLowerCase().includes(searchLower) ||
          token.code_name.toLowerCase().includes(searchLower);
      });
    }

    if (network) {
      filteredTokens = filteredTokens.filter((token: any) => {
        token.token_network.slug.toLowerCase() === network.toLowerCase() ||
          token.token_network.aliases.some(
            (alias: string) => alias.toLowerCase() === network.toLowerCase(),
          );
      });
    }

    if (isActive !== undefined) {
      filteredTokens = filteredTokens.filter(
        (token) => token.is_active === isActive,
      );
    }

    // Calculate pagination
    const total = filteredTokens.length;
    const totalPages = Math.ceil(total / limit);
    const currentPage = Math.min(Math.max(page, 1), totalPages || 1);
    const startIndex = (currentPage - 1) * limit;
    const endIndex = Math.min(startIndex + limit, total);

    // Get paginated result
    const paginatedResults = filteredTokens.slice(startIndex, endIndex);

    return {
      results: paginatedResults,
      pagination: {
        total,
        page: currentPage,
        limit,
        total_pages: totalPages,
        has_next: currentPage < totalPages,
        has_prev: currentPage > 1,
        next_page: currentPage < totalPages ? currentPage + 1 : null,
        prev_page: currentPage > 1 ? currentPage - 1 : null,
      },
      last_updated: this.lastUpdated?.toISOString() || new Date().toISOString(),
    };
  }

  async refreshTokens(): Promise<void> {
    this.logger.log('Refreshing tokens');
    await this.loadAllTokens();
    this.logger.log(
      `Tokens refreshed. Now have ${this.allTokens.length} tokens.`,
    );
  }

  private getTokenCount(): number {
    return this.allTokens.length || 0;
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

      const key = `${token.symbol.toUpperCase()}_${network.slug.toUpperCase()}`;

      if (!tokenMap.has(key)) {
        tokenMap.set(key, {
          code: token.symbol,
          name: token.name || token.symbol,
          networkSlug: network.slug,
          iconUrl: token.iconUrl,
          providers: {},
          coingecko_id:
            provider === AFFILIATE_DATA.COINGECKO.name
              ? token.providerMetadata.coingecko_id
              : null,
          coingecko_name:
            provider === AFFILIATE_DATA.COINGECKO.name
              ? token.providerMetadata.coingecko_name
              : null,
          coingecko_symbol:
            provider === AFFILIATE_DATA.COINGECKO.name
              ? token.providerMetadata.coingecko_symbol
              : null,
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
        code: tokenData.code.toUpperCase(),
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
        coingecko_id: tokenData.coingecko_id,
        coingecko_name: tokenData.coingecko_name,
        coingecko_symbol: tokenData.coingecko_symbol,
        coingecko_rank: null,
        last_coingecko_update: tokenData.coingecko_id
          ? new Date().toISOString()
          : null,
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

  filterTokensWithProvider(tokens: any[]): TokenResponse[] {
    const providerKeys = [
      'ticker_fixedfloat',
      'ticker_changehero',
      'ticker_changenow',
      'ticker_sideshift',
      'ticker_simpleswap',
      'ticker_swapuz',
      'ticker_thechange',
      'ticker_exolix',
      'ticker_swaponix',
      'ticker_nanswap',
      'ticker_changelly',
    ];

    return tokens.filter((token) =>
      providerKeys.some((key) => token[key] !== null),
    );
  }
}
