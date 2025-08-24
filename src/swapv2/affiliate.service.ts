import { HttpService } from '@nestjs/axios';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { Transaction } from './types/transaction.interface';
import { firstValueFrom, lastValueFrom } from 'rxjs';
import {
  AFFILIATE_PROVIDERS,
  AffiliateProviderConfig,
  AFFILIATES,
} from './affiliateData';

@Injectable()
export class AffiliateService {
  // The goal of this service is to handle all Api calls to the partners privix is affiliateed with.
  // This includes:
  // 1. Fetching affiliate links for a given token
  // 2. Making api calls to the affiliate partners to track swaps
  // 3. Handling any other affiliate related logic

  constructor(
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

    const { data } = await firstValueFrom(
      this.httpService.post(url, body, { headers, params: requestParams }),
    );

    return this.normalizeResults(providerName, data);
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
   * Fetches and returns a paginated list of all tokens supported by affiliate providers.
   * @param page - The page number for pagination (default is 1).
   * @returns An object containing the list of tokens and pagination info.
   */
  async getAllTokens(page: number = 1): Promise<{}> {
    return await this.getTokens(AFFILIATES.EXOLIX, page);
  }

  /**
   *
   * @returns Popular Tokens
   */
  async getPopularTokens(): Promise<{}> {
    const tokens = await this.getTokens(AFFILIATES.CHANGENOW);
    const normalizedTokens = tokens
      .map((token: any, index: number) => {
        if (
          token.name.includes('BNB') ||
          token.name.includes('XRP') ||
          token.ticker.includes('usdterc20') ||
          token.ticker === 'sui' ||
          token.ticker === 'shib' ||
          token.ticker === 'floki' ||
          token.ticker === 'bonk' ||
          token.ticker === 'op' ||
          token.ticker === 'wbtcmatic' ||
          token.ticker === 'maticusdce' ||
          token.ticker === 'usdtmatic' ||
          token.ticker === 'opusdce' ||
          token.ticker === 'usdtop' ||
          token.ticker === 'ethop' ||
          token.ticker === 'daiop' ||
          token.ticker === 'matic' ||
          token.ticker === 'doge' ||
          token.ticker === 'pepe' ||
          token.ticker === 'avax' ||
          token.name === 'Bitcoin' ||
          token.name === 'Solana' ||
          token.name === 'Ethereum' ||
          token.ticker === 'usdc' ||
          token.ticker === 'usdcbsc' ||
          token.ticker === 'usdctrc20' ||
          token.ticker === 'ton' ||
          token.ticker === 'xrp' ||
          token.ticker === 'near' ||
          token.ticker === 'ada' ||
          token.ticker === 'trump'
        ) {
          return token;
        }
        return null;
      })

      .map((token: any) => {
        if (token) {
          return {
            ticker: token.ticker,
            name: token.name,
            image: token.image,
          };
        }
        return null;
      })
      .filter((name: string | null) => name !== null);

    return normalizedTokens;
  }

  private async getTokens(providerName: AFFILIATES, page: number = 1) {
    return this.getFromProvider(providerName, 'tokens', {
      page,
      size: providerName === AFFILIATES.CHANGENOW ? null : 100,
    });
  }
}
