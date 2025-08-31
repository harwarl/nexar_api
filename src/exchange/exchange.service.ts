import { Injectable, Logger } from '@nestjs/common';
import { CoingeckoProvider } from 'src/providers/coingecko.provider';
import { TokensService } from 'src/tokens/tokens.service';
import {
  ExchangeRequest,
  ExchangeResponse,
  ProviderQuote,
} from './exchange.interface';
import { TokenResponse } from 'src/tokens/tokens.interface';

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
    // fromAmount: number,
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

    // Get the quote for the providers
    return;
  }

  // Gets the provider Quote
  private getQuote(
    providerName: string,
    tokenA: TokenResponse,
    tokenB: TokenResponse,
  ) {}

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
