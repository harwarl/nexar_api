import { Injectable, Logger } from '@nestjs/common';
import { CoingeckoProvider } from 'src/providers/coingecko.provider';
import { TokensService } from 'src/tokens/tokens.service';
import {
  ExchangeRequest,
  ExchangeResponse,
  ProviderQuote,
} from './exchange.interface';
import { TokenResponse } from 'src/tokens/tokens.interface';
import { AFFILIATES } from 'src/providers/provider.data';
import { ChangeNowProvider } from 'src/providers/changeNow.provider';
import { ExolixProvider } from 'src/providers/exolix.provider';
import { ProviderQuoteResponse } from 'src/providers/provider.interface';

export interface ProviderSupport {
  provider: string;
  isSupported: boolean;
  ticker: string | null;
}

@Injectable()
export class ExchangeService {
  private readonly logger = new Logger(ExchangeService.name);
  // Map of exchange requests
  private exchangeRequests: Map<string, ExchangeResponse> = new Map();

  constructor(
    private readonly tokensService: TokensService,
    private readonly coingeckoProvider: CoingeckoProvider,
    private readonly exolixProvider: ExolixProvider,
    private readonly changeNowProvider: ChangeNowProvider,
  ) {}

  // Calculates the exchnage rates
  async calculateExchangeRate(
    request: ExchangeRequest,
  ): Promise<ExchangeResponse> {
    return;
  }

  // Validate the currencies in the exchange request
  private async validateCurrencies(
    fromCurrency: string,
    toCurrency: string,
    fromNetwork: string,
    toNetwork: string,
  ): Promise<void> {
    // Checks if currencies exists on specified networks

    // Get all the tokens
    const tokens = this.tokensService.getAllTokens();

    // Check if the from token exists
    const fromTokenExists = tokens.some((token: TokenResponse) => {
      token.code === fromCurrency &&
        token.network_name.toUpperCase() === fromNetwork.toUpperCase();
    });

    // Check if the to token exists
    const toTokenExists = tokens.some((token: TokenResponse) => {
      token.code.toUpperCase() === toCurrency.toUpperCase() &&
        token.network_name.toUpperCase() === toNetwork.toUpperCase();
    });

    if (!fromTokenExists || !toTokenExists) {
      throw new Error('Invalid currency or network combination');
    }
  }

  // Get price in usdt using coingecko
  private async getPriceInUSDT(
    currency: string,
    network: string,
  ): Promise<number> {
    try {
      // this would call coingecko or other price providers
      const mockPrices: { [key: string]: number } = {
        ETH: 2500,
        BTC: 45000,
        SOL: 100,
        USDT: 1,
        BNB: 300,
        MATIC: 0.8,
        AVAX: 35,
        ADA: 0.5,
        DOT: 6,
        XRP: 0.6,
      };

      return mockPrices[currency] || 1;
    } catch (error) {
      this.logger.warn(`Failed to get price for ${currency}: ${error.message}`);
      return 1; // fallback price
    }
  }

  private async getProviderQuotes(
    fromCurrency: string,
    toCurrency: string,
    fromNetwork: string,
    toNetwork: string,
    fromAmount: number,
    // fromPriceInUsdt: number,
    // toPriceInUsdt: number,
  ): Promise<ProviderQuote[]> {
    // Get the quote from different Providers
    // Get the quote from the providers with Ticker_{providerName} != null

    const fromToken = this.getTokenFromTokens(fromCurrency, fromNetwork);
    if (!fromToken) {
      throw new Error('Could not get the tokens');
    }

    const toToken = this.getTokenFromTokens(toCurrency, toNetwork);
    if (!toToken) {
      throw new Error('Could not get the tokens');
    }

    // Check the providers if ticker_ is not null
    const fromProviders = this.checkProviders(fromToken);
    const toProviders = this.checkProviders(toToken);

    if (fromProviders.length === 0 || toProviders.length === 0)
      throw new Error(
        'No prorviders found for either the from or the to token',
      );

    // Get common providers
    const commonProviders = this.getCommonProviders(fromToken, toToken);

    if (commonProviders.length === 0)
      throw new Error('No Common providers found');

    const fromPriceInUsdt = await this.coingeckoProvider.getTokenPriceInUSD(
      fromToken.coingecko_id,
    );

    const toPriceInUsdt: number = 0;

    // Get the quote for the providers
    const quotePromises = commonProviders.map(async (providerName: any) => {
      try {
        let providerResponse: any;

        switch (providerName) {
          case AFFILIATES.CHANGENOW:
            // get the quote from change now provider
            providerResponse = await this.changeNowProvider.fetchQuote({
              fromCurrency: fromToken.ticker_changenow,
              toCurrency: toToken.ticker_changenow,
              amount: fromAmount,
            });

            // providerResponse.estimatedAmount
            // if The estimated amount is greater than the already stated, update
            break;

          // get the quote from exolix provider
          case AFFILIATES.EXOLIX:
            providerResponse = await this.exolixProvider.fetchQuote({
              fromCurrency: fromToken.ticker_exolix,
              fromNetwork: fromToken.network_name,
              toCurrency: toToken.ticker_exolix,
              toNetwork: toToken.ticker_exolix,
              amount: fromAmount,
            });

            // if The estimated amount is greater than the already stated, update
            break;

          // Add more quotes in here

          default:
            return null;
        }

        return this.transformToStandardQuote(
          providerResponse,
          providerName,
          fromAmount,
          Number(fromPriceInUsdt) * fromAmount,
          toPriceInUsdt,
        );
      } catch (error) {
        console.error(`Error fetching quote from ${providerName}:`, error);
        return null;
      }
    });

    return;
  }

  // Get's the provider Quote
  private async transformToStandardQuote(
    providerResponse: any,
    providerName: string,
    fromAmount: number,
    fromPriceInUsdt: number,
    toPriceInUsdt: number,
  ): Promise<any> {
    // ToDO: use ProviderQuote Interface
    let estimatedAmountTo: number;
    let estimatedAmountFrom: number;
    let exchangeRate: number;

    switch (providerName) {
      case AFFILIATES.CHANGENOW:
        estimatedAmountTo = providerResponse.estimatedAmount;
        estimatedAmountFrom = fromAmount;
        exchangeRate = estimatedAmount / fromAmount;
        break;

      case AFFILIATES.EXOLIX:
        estimatedAmountTo = providerResponse.toAmount;
        estimatedAmountFrom = providerResponse.fromAmount;
        exchangeRate = providerResponse.rate;
        break;

      default:
        throw new Error(`Unsupported Provider ${providerName}`);
    }

    // Calculate USDT values
    const estimatedAmountToUsdt = estimatedAmountTo * toPriceInUsdt;
    const estimatedAmountFromUsdt = estimatedAmountFrom * fromPriceInUsdt;

    return {
      uid: this.generateUid(),
      provider: providerName,
      estimated_amount_to: estimatedAmountTo.toString(),
      estimated_amount_from: estimatedAmountFrom.toString(),
      estimated_amount_to_usdt: estimatedAmountToUsdt.toString(),
      estimated_amount_from_usdt: estimatedAmountFromUsdt.toString(),
      exchange_rate: exchangeRate.toString(),
      created_at: new Date().toISOString(),
    };
  }

  // Helper method to generate unique ID
  private generateUid(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // CHeck the supported providers for the token
  private checkProviders(token: any): ProviderSupport[] {
    const providers = ['exolix', 'swapuz', 'simpleswap', 'changenow'];

    return providers.map((provider) => {
      const tickerKey = `ticker_${provider}` as keyof typeof token;
      const ticker = token[tickerKey] as string | null;

      return {
        provider,
        isSupported: ticker !== null && ticker !== '',
        ticker: ticker,
      };
    });
  }

  // Get supported pprviders as a string
  private getSupportedProvider(token: any): string[] {
    const support = this.checkProviders(token);
    return support
      .filter((provider) => provider.isSupported)
      .map((provider) => provider.provider);
  }

  // Gets the common providers
  private getCommonProviders(tokenA: any, tokenB: any): string[] {
    const providersA = this.getSupportedProvider(tokenA);
    const providersB = this.getSupportedProvider(tokenB);

    return providersA.filter((provider) => providersB.includes(provider));
  }

  // Checks if a provider is supported
  // private isProviderSupported(token: any, providerName: string): boolean {
  //   const tickerKey = `ticker_${providerName}` as keyof typeof token;
  //   const ticker = token[tickerKey] as string | null;
  //   return ticker !== null && ticker !== '';
  // }

  private getTokenFromTokens(
    fromCurrency: string,
    fromNetwork: string,
  ): TokenResponse | null {
    const tokens = this.tokensService.getAllTokens();
    return tokens.find((token: TokenResponse) => {
      token.code === fromCurrency &&
        token.network_name.toUpperCase() === fromNetwork.toUpperCase();
    });
  }
}
