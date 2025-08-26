import { Injectable } from '@nestjs/common';
import { TokenProvider } from './provider.interface';
import { ChangeNowProvider } from './changeNow.provider';
import { ExolixProvider } from './exolix.provider';

@Injectable()
export class ProvidersService {
  private readonly providers: TokenProvider[];

  constructor(
    private readonly changeNowProvider: ChangeNowProvider,
    private readonly exolixProvider: ExolixProvider,
    // Inject all other providers
  ) {
    this.providers = [
      changeNowProvider,
      exolixProvider,
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
