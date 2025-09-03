import { Injectable } from '@nestjs/common';
import { TokenProvider } from './provider.interface';
import { ChangeNowProvider } from './changeNow.provider';
import { ExolixProvider } from './exolix.provider';
import { CoingeckoProvider } from './coingecko.provider';

@Injectable()
export class ProvidersService {
  private readonly providers: TokenProvider[];

  constructor(
    private readonly changeNowProvider: ChangeNowProvider,
    private readonly exolixProvider: ExolixProvider,
    private readonly coingeckoProvider: CoingeckoProvider,
    // Inject all other providers
  ) {
    this.providers = [
      this.changeNowProvider,
      this.exolixProvider,
      this.coingeckoProvider,
      // Add all other providers
    ];
  }

  getAllProviders(): TokenProvider[] {
    return this.providers;
  }

  getProvider(name: string): TokenProvider | undefined {
    return this.providers.find((p) => p.name === name);
  }
}
