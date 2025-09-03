import { Injectable, Logger } from '@nestjs/common';
import { CoingeckoProvider } from 'src/providers/coingecko.provider';
import { TokensService } from 'src/tokens/tokens.service';
import {
  ExchangeQuote,
  ExchangeRequest,
  ExchangeResponse,
  ProviderQuote,
} from './exchange.interface';
import { TokenResponse } from 'src/tokens/tokens.interface';
import { AFFILIATES } from 'src/providers/provider.data';
import { ChangeNowProvider } from 'src/providers/changeNow.provider';
import { ExolixProvider } from 'src/providers/exolix.provider';

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
  async getExchangeRate(request: ExchangeRequest): Promise<ExchangeResponse> {
    // ValidateCurrencies and get Rates
    this.validateCurrencies(
      request.from_currency,
      request.to_currency,
      request.from_network,
      request.to_network,
    );

    // Get the provider quotes
    const providerQuotes = await this.getProviderQuotes(
      request.from_currency,
      request.to_currency,
      request.from_network,
      request.to_network,
      Number(request.from_amount),
    );

    // const bestQuote = await this.getBestQuote();

    return {
      uid: this.generateUid(),
      from_currency: request.from_currency,
      to_currency: request.to_currency,
      from_network: request.from_network,
      to_network: request.to_network,
      from_amount: request.from_amount,
      to_amount: '',
      from_amount_usdt: ',',
      to_amount_usdt: ',',
      direction: 'SEND',
      status: 'PENDING',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      quotes: providerQuotes,
      uuid_request: request.uuid_request,
    };
  }

  // Validate the currencies in the exchange request
  private async validateCurrencies(
    fromCurrency: string,
    toCurrency: string,
    fromNetwork: string,
    toNetwork: string,
  ): Promise<void> {
    // Checks if currencies exists on specified networks

    // Check if the from token exists
    const fromTokenExists = this.getTokenFromTokens(fromCurrency, fromNetwork);

    // Check if the to token exists
    const toTokenExists = this.getTokenFromTokens(toCurrency, toNetwork);

    if (!fromTokenExists || !toTokenExists) {
      throw new Error('Invalid currency or network combination');
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
  ): Promise<ExchangeQuote[]> {
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

    console.log({ fromProviders, toProviders });

    if (fromProviders.length === 0 || toProviders.length === 0)
      throw new Error(
        'No prorviders found for either the from or the to token',
      );

    // Get common providers
    const commonProviders = this.getCommonProviders(fromToken, toToken);
    console.log({ commonProviders });

    if (commonProviders.length === 0)
      throw new Error('No Common providers found');

    console.log({ fromToken, toToken });
    const fromPriceInUsdt = await this.coingeckoProvider.getTokenPriceInUSD(
      fromToken.coingecko_id,
    );

    const toPriceInUsdt = await this.coingeckoProvider.getTokenPriceInUSD(
      toToken.coingecko_id,
    );

    let toAmount: number = 1;
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
            if (providerResponse.estimatedAmount && !providerResponse.warning) {
              toAmount = providerResponse.estimatedAmount;
            }

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
            if (providerResponse.toAmount) {
              toAmount = providerResponse.toAmount;
            }

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
          Number(toPriceInUsdt),
        );
      } catch (error) {
        console.error(`Error fetching quote from ${providerName}:`, error);
        return null;
      }
    });

    // Wait for all quotes and filter out failed ones
    const quotes = await Promise.all(quotePromises);
    return quotes.filter((quote): quote is ExchangeQuote => quote !== null);
  }

  // Get's the provider Quote
  private async transformToStandardQuote(
    providerResponse: any,
    providerName: string,
    fromAmount: number,
    fromPriceInUsdt: number,
    toPriceInUsdt: number,
  ): Promise<ExchangeQuote> {
    // ToDO: use ProviderQuote Interface
    let estimatedAmountTo: number;
    let estimatedAmountFrom: number;
    let exchangeRate: number;

    switch (providerName) {
      case AFFILIATES.CHANGENOW:
        estimatedAmountTo = providerResponse.estimatedAmount;
        estimatedAmountFrom = fromAmount;
        exchangeRate = estimatedAmountTo / fromAmount;
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
      if (
        token.code === fromCurrency &&
        token.token_network.slug === fromNetwork
      )
        return token;
    });
  }
}
