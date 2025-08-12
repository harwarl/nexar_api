import { HttpService } from '@nestjs/axios';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { Transaction } from './types/transaction.interface';
import { firstValueFrom } from 'rxjs';
import { AFFILIATE_PROVIDERS, AffiliateProviderConfig } from './affiliateData';

@Injectable()
export class AffiliateService {
  // The goal of this service is to handle all Api calls to the partners privix is affiliateed with.
  // This includes:
  // 1. Fetching affiliate links for a given token
  // 2. Making api calls to the affiliate partners to track swaps
  // 3. Handling any other affiliate related logic

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    @Inject('TRANSACTION_MODEL_V2')
    private transactionModel: Model<Transaction>,
  ) {}

  /**
   * Get provider configuration by name.
   * @param providerName - The name of the affiliate provider.
   * @returns The configuration object for the specified provider.
   * @throws HttpException if the provider is not found.
   */
  getProviderConfig(providerName: string): AffiliateProviderConfig {
    const providers: AffiliateProviderConfig[] = AFFILIATE_PROVIDERS;
    const provider = providers.find((p) => p.name === providerName);

    if (!provider) {
      throw new HttpException(`Provider ${providerName} not found`, 404);
    }

    return provider;
  }

  /**
   * Make API Get request to the specified provider's endpoint.
   */
  private async getFromProvider(
    providerName: string,
    endpointKey: keyof (typeof AFFILIATE_PROVIDERS)[number]['endpoints'],
    params?: Record<string, any>,
  ): Promise<any> {
    const provider = this.getProviderConfig(providerName);
    const endpoint = provider.endpoints[endpointKey];

    if (!endpoint) {
      throw new HttpException(
        `Endpoint ${endpointKey} not found for provider ${providerName}`,
        404,
      );
    }

    // Get the url
    const url = `${provider.baseUrl}${endpoint}`;

    // Set up headers
    const headers: Record<string, string> = {};
    if (provider.apiKey) {
      headers['Authorization'] = `Bearer ${provider.apiKey}`;
    }
    if (provider.apiSecret) {
      headers['x-api-key'] = provider.apiSecret;
    }

    // Make the HTTP Get request
    const data = await firstValueFrom(
      this.httpService.get(url, { params, headers }),
    );

    console.log({ data });
    return data;
  }

  /**
   * Make API Post request to the specified provider's endpoint.
   */
  private async postToProvider(
    providerName: string,
    endpointKey: keyof (typeof AFFILIATE_PROVIDERS)[number]['endpoints'],
    body: any,
  ) {
    const provider = this.getProviderConfig(providerName);
    const endpoint = provider.endpoints[endpointKey];

    if (!endpoint) {
      throw new HttpException(
        `Endpoint ${endpointKey} not found for provider ${providerName}`,
        404,
      );
    }

    // Get the url
    const url = `${provider.baseUrl}${endpoint}`;

    // Set up headers
    const headers: Record<string, string> = {};

    if (provider.apiKey) {
      body = { ...body, apiKey: provider.apiKey };
    }

    if (provider.apiSecret) {
      headers['x-api-key'] = provider.apiSecret;
    }

    const { data } = await firstValueFrom(
      this.httpService.post(url, body, { headers }),
    );

    console.log({ data });
    return data;
  }
}
