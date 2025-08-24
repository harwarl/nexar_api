import { Inject } from '@nestjs/common';
import { ProviderService } from '../providers/provider.service';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';

export class TokenAggregatorService {
  constructor(
    private readonly providerService: ProviderService,
    // private readonly token
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async aggregateTokens(): Promise<any[]> {
    const cacheKey = 'aggregated_tokens';
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return [];

    // Get all providers
    const providers = this.providerService.getAllProviders();

    // Fetch from all the providers in parallel
    const providerResults = await Promise.all(
      providers.map(async (provider) => {
        try {
          const tokens = await provider.fetchSupportedTokens();
          return { provider: provider.name, tokens };
        } catch (error) {
          console.error(`Error fetching from ${provider.name}:`, error);
          return { provider: provider.name, tokens: [] };
        }
      }),
    );

    // Get all networks from the database
    return [];
  }
}
