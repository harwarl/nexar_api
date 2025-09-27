import { Injectable } from '@nestjs/common';
import {
  FetchQuoteResponse,
  ProviderNetwork,
  ProviderToken,
  QuoteData,
  TokenProvider,
  TransactionResponse,
} from './provider.interface';
import { AFFILIATE_DATA, AFFILIATES } from './provider.data';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SwapuzProvider implements TokenProvider {
  readonly name: string = AFFILIATE_DATA.SWAPUZ.name;

  constructor(private readonly httpService: HttpService) {}

  async fetchSupportedTokens(): Promise<ProviderToken[]> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get(`
        ${AFFILIATE_DATA.SWAPUZ.baseUrl}${AFFILIATE_DATA.SWAPUZ.endpoint.tokens}
        `),
      );

      return this.transformSwapUzResponse(data.result);
    } catch (error) {
      throw new Error(`Failed to fetch ${this.name} tokens: ${error.message}`);
    }
  }

  async fetchQuote(getQuoteData: QuoteData): Promise<FetchQuoteResponse> {
    try {
      // First get the minAmount
      const { data } = await firstValueFrom(
        this.httpService.get(
          `${AFFILIATE_DATA.SWAPUZ.baseUrl}home/v1/rate/?from=${getQuoteData.fromCurrency}&to=${getQuoteData.toCurrency}&amount=${getQuoteData.amount}&fromNetwork=${getQuoteData.fromNetwork}&toNetwork=${getQuoteData.toNetwork}&mode=float`,
        ),
      );

      if (data.status === 200) {
        return {
          isError: false,
          isMessage: false,
          minAmount: data.result.minAmount,
          maxAmount: data.result.maxAmount,
          fromAmount: getQuoteData.amount,
          toAmount: data.result.result,
          rate: data.result.rate,
          message: '',
        };
      }
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
          `${AFFILIATE_DATA.SWAPUZ.baseUrl}order/uid/${tx_id}`,
        ),
      );

      if (data.status === 200) {
        return {
          isError: false,
          error: null,
          txId: data.result.uid,
          payinAddress: data.result.addressFrom,
          payoutAddress: null,
          fromCurrency: data.result.from.shortName,
          toCurrency: data.result.to.shortName,
          amount: data.result.amount,
          amountToReceiver: data.result.amountResult,
          refundAddress: data.result.addressRefund || null,
          payinHash: data.result.depositTransactionID || null,
          payoutHash: data.result.withdrawalTransactionID || null,
          fromNetwork: data.result.addressFromNetwork || null,
          toNetwork: data.result.addressToNetwork || null,
          status: data.result.status, // TODO: some form of mapping for rthe 0s and 1s of the status
          receivingAddress: data.result.addressTo || null,
        };
      }
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

  private transformSwapUzResponse(swapuzTokens: any[]): ProviderToken[] {
    const transformedTokens: ProviderToken[] = [];

    for (const token of swapuzTokens) {
      if (!token.network || token.network.length === 0) continue;

      for (const network of token.network) {
        transformedTokens.push({
          symbol: token.shortName,
          network: network.shortName,
          isActive: network.isActive,
          name: token.name,
          iconUrl: token.image,
        });
      }
    }

    return transformedTokens;
  }
}
