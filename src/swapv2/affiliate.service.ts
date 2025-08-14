import { HttpService } from '@nestjs/axios';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { Transaction } from './types/transaction.interface';
import { firstValueFrom, lastValueFrom } from 'rxjs';
import {
  AFFILIATE_PROVIDERS,
  AffiliateProviderConfig,
  AFFILIATES,
} from './affiliateData';
import crypto from 'crypto';

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
    providerName: AFFILIATES,
    endpointKey: keyof (typeof AFFILIATE_PROVIDERS)[number]['endpoints'],
    params?: Record<string, any>,
  ): Promise<any> {
    const provider = this.getProviderConfig(providerName);
    const endpoint = provider.endpoints[endpointKey];

    console.log({ endpointKey });

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
    // Set up Request Params
    let requestParams = { ...params };

    // Provider Specific Adjustments
    switch (providerName) {
      case AFFILIATES.EXOLIX:
        headers['Authorization'] = `Bearer ${provider.apiKey}`;
        break;

      // case AFFILIATES.FIXED_FLOAT:
      //   headers['X-API-KEY'] = provider.apiKey; // TODO: A function to get the API Sign
      //   headers['X-API-SIGN'] = provider.apiSecret!;
      //   break;

      case AFFILIATES.SWAPUZ:
        headers['Api-key'] = provider.apiKey;
        break;

      case AFFILIATES.SIMPLE_SWAP:
      case AFFILIATES.CHANGENOW:
        requestParams = { ...requestParams, api_key: provider.apiKey };
        break;

      default:
        break;
    }

    // Make the HTTP Get request
    const { data } = await lastValueFrom(
      this.httpService.get(url, { params: requestParams, headers }),
    );

    return this.normalizeResults(providerName, data);
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
    // Set up Request Params
    let requestParams = {};

    // Provider Specific Adjustments
    switch (providerName) {
      case AFFILIATES.EXOLIX:
        headers['Authorization'] = `Bearer ${provider.apiKey}`;
        break;

      // case AFFILIATES.FIXED_FLOAT: // TODO: fix the call
      //   headers['X-API-KEY'] = provider.apiKey; // TODO: A function to get the API Sign
      //   headers['X-API-SIGN'] = this.getHmacSign({}, provider.apiSecret!);
      //   break;

      case AFFILIATES.SWAPUZ:
        headers['Api-key'] = provider.apiKey;
        break;

      case AFFILIATES.SIMPLE_SWAP:
      case AFFILIATES.CHANGENOW:
        console.log({ provider, url });
        requestParams = { ...requestParams, api_key: provider.apiKey };
        break;

      default:
        break;
    }

    // const { data } = await firstValueFrom(
    //   this.httpService.post(url, body, { headers, params: requestParams }),
    // );

    // return this.normalizeResults(providerName, data);
  }

  /**
   * Normalize get Response
   */
  private normalizeResults(providerName: string, rawData: any) {
    switch (providerName) {
      case AFFILIATES.SWAPUZ:
        return rawData.result;

      case AFFILIATES.SIMPLE_SWAP:
      case AFFILIATES.EXOLIX:
      case AFFILIATES.CHANGENOW:
        return rawData;
      default:
        return rawData;
    }
  }

  /**
   * Get tokens from the specified affiliate provider.
   */

  async getAllTokens(): Promise<Tokens[]> {
    const results = await Promise.all(
      AFFILIATE_PROVIDERS.map(async (provider) => {
        try {
          const data = await this.getFromProvider(
            provider.name as AFFILIATES,
            'tokens',
          );

          return { provider: provider.name, tokens: data.data || data };
        } catch (error) {
          console.error(`Error fetching tokens from ${provider.name}:`, error);
          return {
            provider: provider.name,
            error: error.message || 'Failed to fetch tokens',
          };
        }
      }),
    );

    return results as Tokens[];
  }

  // function to get the X-API-SIGN of fixed float
  private getHmacSign(payload: any, secret: string) {
    let message: string;

    if (!payload || Object.keys(payload).length === 0) {
      message = '';
    } else {
      message = JSON.stringify(payload);
    }

    return crypto.createHmac('sha256', secret).update(message).digest('hex');
  }
}
