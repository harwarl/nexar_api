import { Injectable } from '@nestjs/common';
import {
  FetchQuoteResponse,
  ProviderToken,
  QuoteData,
  TokenProvider,
  TransactionResponse,
} from './provider.interface';
import { AFFILIATE_DATA } from './provider.data';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { networkMappings } from 'utils/constants';
import { symbol } from 'joi';

@Injectable()
export class SimpleSwapProvider implements TokenProvider {
  readonly name: string = AFFILIATE_DATA.SIMPLESWAP.name;

  constructor(private readonly httpService: HttpService) {}

  async fetchSupportedTokens(): Promise<ProviderToken[]> {
    console.log(
      `${AFFILIATE_DATA.SIMPLESWAP.baseUrl}${AFFILIATE_DATA.SIMPLESWAP.endpoint.tokens}?api_key=${AFFILIATE_DATA.SIMPLESWAP.apiKey}`,
    );
    try {
      const { data } = await firstValueFrom(
        this.httpService.get(`
          ${AFFILIATE_DATA.SIMPLESWAP.baseUrl}${AFFILIATE_DATA.SIMPLESWAP.endpoint.tokens}?api_key=${AFFILIATE_DATA.SIMPLESWAP.apiKey}
          `),
      );

      return this.transformSimpleSwapResponse(data);
    } catch (error) {
      throw new Error(`Failed to fetch ${this.name} tokens: ${error.message}`);
    }
  }

  async fetchQuote(getQuoteData: QuoteData): Promise<FetchQuoteResponse> {
    try {
      // Get teh Min Max Amount
      const { data: minMaxAmount } = await firstValueFrom(
        this.httpService.get(
          `${AFFILIATE_DATA.SIMPLESWAP.baseUrl}get_ranges?api_key=${AFFILIATE_DATA.SIMPLESWAP.apiKey}&fixed=false&currency_from=${getQuoteData.fromCurrency}&currency_to=${getQuoteData.toCurrency}`,
        ),
      );

      // Get the rate
      const { data: rate } = await firstValueFrom(
        this.httpService.get(
          `${AFFILIATE_DATA.SIMPLESWAP.baseUrl}get_exchange?api_key=${AFFILIATE_DATA.SIMPLESWAP.apiKey}`,
        ),
      );

      // Get Estimated Amount
      const { data: estimatedAmount } = await firstValueFrom(
        this.httpService.get(
          `${AFFILIATE_DATA.SIMPLESWAP.baseUrl}get_ranges?api_key=${AFFILIATE_DATA.SIMPLESWAP.apiKey}&fixed=false&currency_from=${getQuoteData.fromCurrency}&currency_to=${getQuoteData.toCurrency}&amount=${getQuoteData.amount.toString()}`,
        ),
      );

      return {
        isError: false,
        isMessage: false,
        minAmount: minMaxAmount.min,
        maxAmount: minMaxAmount.max,
        fromAmount: getQuoteData.amount,
        toAmount: estimatedAmount,
        rate: 0,
        message: '',
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

  async fetchTransactionByTransactionId(
    tx_id: string,
  ): Promise<TransactionResponse> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get(
          `${AFFILIATE_DATA.SIMPLESWAP.baseUrl}get_exchange?api_key=${AFFILIATE_DATA.SIMPLESWAP.apiKey}&id=${tx_id}`,
        ),
      );

      return {
        isError: false,
        error: null,
        txId: data.id,
        payinAddress: data.address_from,
        payoutAddress: data.payoutAddress ?? null,
        fromCurrency: data.currency_from,
        toCurrency: data.currency_to,
        amount: data.expected_amount ? data.expected_amount : data.amount_from,
        amountToReceiver: data.amount_to,
        refundAddress: data.user_refund_address || null,
        payinHash: data.tx_from || null,
        payoutHash: data.tx_to || null,
        fromNetwork: data[data.currency_from]['network'] || null,
        toNetwork: data[data.currency_to]['network'] || null,
        status: data.status,
        receivingAddress: data.address_to || null,
      };
    } catch (error) {
      console.log({ error });
      console.log({ error: error.message });
      return {
        isError: true,
        error: error.response?.data?.message || 'Failed to fetch transaction',
        txId: null,
        payinAddress: null,
        payoutAddress: null,
        fromCurrency: null,
        toCurrency: null,
        amount: null,
        amountToReceiver: null,
        refundAddress: null,
        payinHash: null,
        payoutHash: null,
        fromNetwork: null,
        toNetwork: null,
        status: 'failed',
        receivingAddress: null,
      };
    }
  }

  private transformSimpleSwapResponse(
    simpleSwapTokens: any[],
  ): ProviderToken[] {
    const transformedTokens: ProviderToken[] = [];

    for (const token of simpleSwapTokens) {
      if (!token.network) continue;

      const { symbol, network, alias } = this.parseTicker(
        token.symbol,
        token.network,
      );

      if (symbol && network) {
        transformedTokens.push({
          symbol,
          aliasSymbol: token.symbol,
          network: network,
          aliasNetwork: network,
          iconUrl: token.image,
          isActive: true,
        });
      }
    }

    return transformedTokens;
  }

  private parseTicker(
    origSymbol: string,
    origNetwork: string,
  ): {
    symbol: string;
    network: string;
    alias?: string; // Alias for the network
  } {
    for (const [networkSuffix, networkName] of Object.entries(
      networkMappings,
    )) {
      if (origSymbol.endsWith(networkSuffix)) {
        const symbol = origSymbol.slice(0, -networkSuffix.length).toUpperCase();
        return {
          symbol,
          network: origNetwork,
          alias: networkSuffix.toUpperCase(),
        };
      }
    }
    return {
      symbol: origSymbol,
      network: origNetwork,
    };
  }
}
