import { Injectable } from '@nestjs/common';
import { TokenProvider } from './provider.interface';
import { ChangeNowProvider } from './changenow.provider';
import { ExolixProvider } from './exolix.provider';
import { CoingeckoProvider } from './coingecko.provider';
import { SwapuzProvider } from './swapuz.provider';
import { SimpleSwapProvider } from './simpleswap.provider';

@Injectable()
export class ProvidersService {
  private readonly providers: TokenProvider[];

  constructor(
    private readonly changeNowProvider: ChangeNowProvider,
    private readonly exolixProvider: ExolixProvider,
    private readonly coingeckoProvider: CoingeckoProvider,
    private readonly swapUzProvider: SwapuzProvider,
    private readonly simpleSwapProvider: SimpleSwapProvider,
    // Inject all other providers
  ) {
    this.providers = [
      this.coingeckoProvider,
      this.changeNowProvider,
      this.exolixProvider,
      this.swapUzProvider,
      this.simpleSwapProvider,
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
