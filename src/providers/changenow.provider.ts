import { Injectable } from '@nestjs/common';
import {
  FetchQuoteResponse,
  ProviderToken,
  QuoteData,
  TokenProvider,
} from './provider.interface';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PROVIDERS } from 'utils/constants';
import { ConfigService } from '@nestjs/config';
import { AFFILIATE_DATA } from './provider.data';

interface ChangeNowCurrency {
  ticker: string;
  name: string;
  image: string;
  hasExternalId: boolean;
  isExtraIdSupported: boolean;
  isFiat: boolean;
  featured: boolean;
  isStable: boolean;
  supportsFixedRate: boolean;
}

@Injectable()
export class ChangeNowProvider implements TokenProvider {
  readonly name = AFFILIATE_DATA.CHANGENOW.name;

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

      return this.transformResponse(data);
    } catch (error) {
      throw new Error(`Failed to fetch ${this.name} tokens: ${error.message}`);
    }
  }

  async fetchQuote(getQuoteData: QuoteData): Promise<FetchQuoteResponse> {
    try {
      // First get the minAmount
      const {
        data: { minAmount, maxAmount },
      } = await firstValueFrom(
        this.httpService.get(
          `${AFFILIATE_DATA.CHANGENOW.baseUrl}exchange-range/${getQuoteData.fromCurrency}_${getQuoteData.toCurrency}?api_key=${AFFILIATE_DATA.CHANGENOW.apiKey}`,
        ),
      );

      const { data: estimatedData } = await firstValueFrom(
        this.httpService.get(
          `${AFFILIATE_DATA.CHANGENOW.baseUrl}exchange-amount/${getQuoteData.amount}/${getQuoteData.fromCurrency}_${getQuoteData.toCurrency}?api_key=${AFFILIATE_DATA.CHANGENOW.apiKey}`,
        ),
      );

      return {
        isError: false,
        isMessage: false,
        minAmount: minAmount,
        maxAmount: maxAmount,
        fromAmount: getQuoteData.amount,
        toAmount: estimatedData.estimatedAmount,
        rate: estimatedData.estimatedAmount / getQuoteData.amount,
        message: estimatedData.warningMessage,
      };
    } catch (error) {
      console.log({ error });
      if (error.response.data.error) {
        return {
          isError: true,
          isMessage: true,
          minAmount: 0,
          maxAmount: 0,
          fromAmount: getQuoteData.amount,
          toAmount: 0,
          rate: 0,
          message: error.response.data.message ?? '',
        };
      }
    }
  }

  private transformResponse(currencies: ChangeNowCurrency[]): ProviderToken[] {
    const tokens: ProviderToken[] = [];

    for (const currency of currencies) {
      const { symbol, network, alias } = this.parseTicker(
        currency.ticker,
        currency.name,
      );

      if (symbol && network) {
        tokens.push({
          symbol: currency.ticker,
          network: network,
          alias: alias,
          iconUrl: currency.image,
          isActive: true,
        });
      }
    }
    return tokens;
  }

  private parseTicker(
    ticker: string,
    name: string,
  ): {
    symbol: string;
    network: string;
    alias?: string;
  } {
    // Change now ticker format
    // "btc" => Bitcoin native
    // "usdterc20" => USDT on ERC20
    // "etharb" => ETH on arbitrum
    // "bnbbsc" => BNB on BSC

    const networkMappings: { [key: string]: string } = {
      erc20: 'ETH',
      trc20: 'TRX',
      bsc: 'BSC',
      sol: 'SOL',
      matic: 'MATIC',
      algo: 'ALGO',
      arc20: 'AVAX',
      arb: 'ARBITRUM',
      op: 'OPTIMISM',
      ton: 'TON',
      celo: 'CELO',
      base: 'BASE',
      manta: 'MANTA',
      lna: 'LNA',
    };

    // Check if ticker contains a network suffix
    for (const [networkSuffix, networkName] of Object.entries(
      networkMappings,
    )) {
      if (
        ticker.endsWith(networkSuffix) ||
        name.toUpperCase().includes(networkSuffix.toUpperCase())
      ) {
        const symbol = ticker.slice(0, -networkSuffix.length).toUpperCase();
        return {
          symbol,
          network: networkName,
          alias: networkSuffix.toUpperCase(),
        };
      }
    }

    // Special Cases
    if (ticker === 'btc') return { symbol: 'BTC', network: 'BTC' };
    if (ticker === 'eth') return { symbol: 'ETH', network: 'ETH' };
    if (ticker === 'xrp') return { symbol: 'XRP', network: 'XRP' };
    if (ticker === 'sui') return { symbol: 'SUI', network: 'SUI' };
    if (ticker === 'vet') return { symbol: 'VECHAIN', network: 'VECHAIN' };
    if (ticker === 'bera') return { symbol: 'BERA', network: 'BERA' };
    if (ticker === 'qtum') return { symbol: 'QTUM', network: 'QTUM' };
    if (ticker === 'vanry') return { symbol: 'VANAR', network: 'VANAR' };
    if (ticker === 'arpa') return { symbol: 'ARPA', network: 'ARPA' };

    if (['xlm'].includes(ticker)) {
      return { symbol: ticker.toUpperCase(), network: name.toUpperCase() };
    } else {
      // Default case - assume it's a native token
      return { symbol: ticker.toUpperCase(), network: 'ETH' };
    }
  }
}
