import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CoingeckoProvider } from 'src/providers/coingecko.provider';
import { TokensService } from 'src/tokens/tokens.service';
import {
  ExchangeQuote,
  ExchangeRequest,
  ExchangeResponse,
} from './exchange.interface';
import { TokenResponse } from 'src/tokens/tokens.interface';
import { AFFILIATES } from 'src/providers/provider.data';
import { ChangeNowProvider } from 'src/providers/changeNow.provider';
import { ExolixProvider } from 'src/providers/exolix.provider';
import { FetchQuoteResponse } from 'src/providers/provider.interface';

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
    const currencyValidated = await this.validateCurrencies(
      request.from_currency,
      request.to_currency,
      request.from_network,
      request.to_network,
    );

    if (currencyValidated?.error) {
      throw new BadRequestException(currencyValidated.message);
    }

    // Get the provider quotes
    const providerQuotes = await this.getProviderQuotes(
      request.from_currency,
      request.to_currency,
      request.from_network,
      request.to_network,
      Number(request.from_amount),
    );

    if (providerQuotes.isError) {
      throw new BadRequestException(providerQuotes.error);
    }

    // find the best quote
    const bestQuote: ExchangeQuote = this.findBestQuote(providerQuotes.quotes);

    if (!bestQuote) {
      throw new BadRequestException('No quotes found');
    }

    return {
      uid: this.generateUid(),
      from_currency: request.from_currency,
      to_currency: request.to_currency,
      from_network: request.from_network,
      to_network: request.to_network,
      from_amount: request.from_amount,
      to_amount: bestQuote.estimated_amount_to,
      from_amount_usdt: bestQuote.estimated_amount_from_usdt,
      to_amount_usdt: bestQuote.estimated_amount_to_usdt,
      direction: 'SEND',
      status: 'PENDING',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // quotes: providerQuotes.quotes,
      quotes: [bestQuote],
      uuid_request: request.uuid_request,
      errors: providerQuotes.error,
    };
  }

  // Validate the currencies in the exchange request
  private async validateCurrencies(
    fromCurrency: string,
    toCurrency: string,
    fromNetwork: string,
    toNetwork: string,
  ): Promise<{
    error: boolean;
    message: string;
  }> {
    // Checks if currencies exists on specified networks

    // Check if the from token exists
    const fromTokenExists = this.getTokenFromTokens(fromCurrency, fromNetwork);

    // Check if the to token exists
    const toTokenExists = this.getTokenFromTokens(toCurrency, toNetwork);

    console.log({ fromTokenExists, toTokenExists });

    if (!fromTokenExists || !toTokenExists) {
      return {
        error: true,
        message: 'Invalid currency or network combination',
      };
    }
  }

  private async getProviderQuotes(
    fromCurrency: string,
    toCurrency: string,
    fromNetwork: string,
    toNetwork: string,
    fromAmount: number,
  ): Promise<{
    quotes: ExchangeQuote[];
    isError: boolean;
    error: Record<string, string>;
  }> {
    try {
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

      console.log({ fromToken, toToken });

      // Check the providers if ticker_ is not null
      const fromProviders = this.checkProviders(fromToken);
      const toProviders = this.checkProviders(toToken);

      // console.log({ fromProviders, toProviders });

      if (fromProviders.length === 0 || toProviders.length === 0)
        throw new Error(
          'No prorviders found for either the from or the to token',
        );

      // Get common providers
      const commonProviders = this.getCommonProviders(fromToken, toToken);
      console.log({ commonProviders });

      if (commonProviders.length === 0)
        throw new Error('No Common providers found');

      console.log({
        fromToken: fromToken.coingecko_id,
        toToken: toToken.coingecko_id,
      });

      const fromPriceInUsdt = await this.coingeckoProvider.getTokenPriceInUSD(
        fromToken.coingecko_id,
      );

      const toPriceInUsdt = await this.coingeckoProvider.getTokenPriceInUSD(
        toToken.coingecko_id,
      );

      console.log({ fromPriceInUsdt, toPriceInUsdt });
      const errorObj: Record<string, string> = {};

      // let toAmount: number = 1;
      // Get the quote for the providers
      const quotePromises: any = commonProviders.map(
        async (providerName: any) => {
          try {
            let providerResponse: FetchQuoteResponse;

            switch (providerName) {
              case AFFILIATES.CHANGENOW:
                // get the quote from change now provider
                providerResponse = await this.changeNowProvider.fetchQuote({
                  fromCurrency: fromToken.ticker_changenow,
                  toCurrency: toToken.ticker_changenow,
                  amount: fromAmount,
                });
                break;

              // get the quote from exolix provider
              case AFFILIATES.EXOLIX:
                providerResponse = await this.exolixProvider.fetchQuote({
                  fromCurrency: fromToken.ticker_exolix,
                  fromNetwork: fromToken.network_name,
                  toCurrency: toToken.ticker_exolix,
                  toNetwork: toToken.network_name,
                  amount: fromAmount,
                });
                break;

              // Add more quotes in here
              default:
                return null;
            }

            if (providerResponse.isError) {
              console.error(
                `Error fetching quote from ${providerName}:`,
                providerResponse.message,
              );
              errorObj[providerName] = providerResponse.message;
              // return null;
            }

            // console.log({
            //   fromPriceInUsdt,
            //   toPriceInUsdt,
            //   fromAmount,
            //   toAmount: providerResponse.toAmount,
            // });

            return this.transformToStandardQuote(
              providerResponse,
              providerName,
              Number(fromPriceInUsdt.priceInUsd) * Number(fromAmount),
              Number(toPriceInUsdt.priceInUsd) *
                Number(providerResponse.toAmount),
            );
          } catch (error) {
            console.error(`Error fetching quote from ${providerName}:`, error);
            return null;
          }
        },
      );

      // Wait for all quotes and filter out failed ones
      const quotes = await Promise.all(quotePromises);
      const filteredQuotes = quotes.filter(
        (quote): quote is ExchangeQuote => quote !== null,
      );

      return {
        isError: false,
        quotes: filteredQuotes,
        error: errorObj, // {provider, error}
      };
    } catch (error) {
      return {
        isError: true,
        quotes: [],
        error: error.message ?? 'Unknown error',
      };
    }
  }

  // Get's the provider Quote
  private async transformToStandardQuote(
    providerResponse: FetchQuoteResponse,
    providerName: string,
    estimatedAmountFromUsdt: number,
    estimatedAmountToUsdt: number,
  ): Promise<ExchangeQuote> {
    let estimatedAmountTo: number = providerResponse.toAmount;
    let estimatedAmountFrom: number = providerResponse.fromAmount;
    let exchangeRate: number = providerResponse.rate ?? 0;

    // // Calculate USDT values
    // const estimatedAmountToUsdt = estimatedAmountTo * toPriceInUsdt;
    // const estimatedAmountFromUsdt = estimatedAmountFrom * fromPriceInUsdt;

    return {
      uid: this.generateUid(),
      provider: providerName,
      estimated_amount_to: estimatedAmountTo.toString(),
      estimated_amount_from: estimatedAmountFrom.toString(),
      estimated_amount_to_usdt: estimatedAmountToUsdt.toString(),
      estimated_amount_from_usdt: estimatedAmountFromUsdt.toString(),
      exchange_rate: exchangeRate.toString(),
      created_at: new Date().toISOString(),
      minAmount: providerResponse.minAmount.toString(),
      maxAmount:
        providerResponse.maxAmount !== null
          ? providerResponse.maxAmount.toString()
          : '0',
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

  // Finds the best quote
  private findBestQuote(quotes: ExchangeQuote[]) {
    if (!quotes || quotes.length === 0) return null;

    return quotes.reduce((best, current): ExchangeQuote => {
      if (
        Number(current.estimated_amount_to_usdt) >
        Number(best.estimated_amount_to_usdt)
      ) {
        return current;
      }

      if (
        Number(current.estimated_amount_to_usdt) ===
          Number(best.estimated_amount_to_usdt) &&
        Number(current.estimated_amount_to) > Number(best.estimated_amount_to)
      ) {
        return current;
      }

      return best;
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
