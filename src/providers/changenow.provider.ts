import { Injectable } from '@nestjs/common';
import { ProviderToken, TokenProvider } from './provider.interface';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { symbol } from 'joi';
import { PROVIDERS } from 'utils/constants';
import { ConfigService } from '@nestjs/config';
import { AFFILIATE_DATA } from './provider.data';

@Injectable()
export class ChangeNowProvider implements TokenProvider {
  readonly name = 'changenow';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async fetchSupportedTokens(): Promise<ProviderToken[]> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get(
          `${AFFILIATE_DATA.CHANGENOW.baseUrl}/${AFFILIATE_DATA.CHANGENOW.endpoints.tokens}`,
        ),
      );

      console.log({ data });
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
