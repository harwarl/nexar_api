import { Injectable } from '@nestjs/common';
import { ProviderToken, TokenProvider } from './provider.interface';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { symbol } from 'joi';

@Injectable()
export class ChangeNowProvider implements TokenProvider {
  readonly name = 'changenow';

  constructor(private readonly httpService: HttpService) {}

  async fetchSupportedTokens(): Promise<ProviderToken[]> {
    try {
      const { data } = await firstValueFrom(this.httpService.get(''));

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
}
