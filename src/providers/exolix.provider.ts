import { Injectable } from '@nestjs/common';
import {
  FetchQuoteResponse,
  ProviderToken,
  QuoteData,
  TokenProvider,
  TransactionResponse,
} from './provider.interface';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AFFILIATE_DATA } from './provider.data';
import { CreateTransactionDto } from 'src/swapv2/dto/createTransaction.dto';
import { CreateTransactionPayload } from 'src/swapv2/types/transaction';

@Injectable()
export class ExolixProvider implements TokenProvider {
  readonly name = 'exolix';

  constructor(private readonly httpService: HttpService) {}

  async fetchSupportedTokens(): Promise<ProviderToken[]> {
    try {
      const pageSize = 100;
      let page = 1;
      let allTokens: any[] = [];
      let totalCount = 0;

      do {
        const { data } = await firstValueFrom(
          this.httpService.get(
            `${AFFILIATE_DATA.EXOLIX.baseUrl}${AFFILIATE_DATA.EXOLIX.endpoints.tokens}?withNetworks=true&page=${page}&size=${pageSize}`,
            {
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Authorization: AFFILIATE_DATA.EXOLIX.apiKey,
              },
            },
          ),
        );

        if (!data?.data) {
          throw new Error('Invalid response structure from Exolix');
        }

        if (page === 1) {
          totalCount = data.count;
        }

        allTokens = [...allTokens, ...data.data];
        page++;
      } while (allTokens.length < totalCount);

      return this.transformExolixData(allTokens);
    } catch (error) {
      throw new Error(`Failed to fetch ${this.name} tokens: ${error.message}`);
    }
  }

  async fetchQuote(getQuoteData: QuoteData): Promise<FetchQuoteResponse> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get(
          `${AFFILIATE_DATA.EXOLIX.baseUrl}${AFFILIATE_DATA.EXOLIX.endpoints.getRate}?coinFrom=${getQuoteData.fromCurrency}&networkFrom=${getQuoteData.fromNetwork}&coinTo=${getQuoteData.toCurrency}&networkTo=${getQuoteData.toNetwork}&amount=${getQuoteData.amount}&rateType=fixed`,
          {
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Authorization: AFFILIATE_DATA.EXOLIX.apiKey,
            },
          },
        ),
      );

      return {
        isError: false,
        isMessage: false,
        minAmount: data.minAmount,
        maxAmount: data.maxAmount,
        fromAmount: getQuoteData.amount,
        toAmount: data.toAmount,
        rate: data.rate,
        message: data.message ?? '',
      };
    } catch (error) {
      if (error.response.data.error) {
        return {
          isError: true,
          isMessage: true,
          minAmount: error.response.data.minAmount,
          maxAmount: error.response.data.maxAmount,
          fromAmount: getQuoteData.amount,
          toAmount: 0,
          rate: 0,
          message: error.response.data.error ?? '',
        };
      } else {
        return {
          isError: true,
          isMessage: true,
          fromAmount: getQuoteData.amount,
          minAmount: error.response.data.minAmount,
          maxAmount: error.response.data.maxAmount,
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
          `${AFFILIATE_DATA.EXOLIX.baseUrl}${AFFILIATE_DATA.EXOLIX.endpoints.getTransactions}/${tx_id}`,
          {
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Authorization: AFFILIATE_DATA.EXOLIX.apiKey,
            },
          },
        ),
      );

      console.log({ data });

      return {
        isError: false,
        error: null,
        txId: data.id,
        payinAddress: data.payinAddress,
        payoutAddress: data.payoutAddress,
        fromCurrency: data.fromCurrency,
        toCurrency: data.toCurrency,
        amount: data.amountSend ? data.amountSend : data.expectedSendAmount,
        amountToReceiver: data.amountReceive
          ? data.amountReceive
          : data.expectedReceiveAmount,
        refundAddress: data.refundAddress || null,
        payinHash: data.payinHash || null,
        payoutHash: data.payoutHash || null,
        fromNetwork: data.fromNetwork || null,
        toNetwork: data.toNetwork || null,
        status: data.status,
        receivingAddress: data.tokensDestination || null,
      };
    } catch (error) {
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

  async createTransaction(
    createTransactionPayload: CreateTransactionPayload,
  ): Promise<TransactionResponse> {
    try {
      const payload = {
        coinFrom: createTransactionPayload.fromToken.ticker_exolix,
        coinTo: createTransactionPayload.toToken.ticker_exolix,
        networkFrom:
          createTransactionPayload.fromToken.token_network.ticker_exolix,
        networkTo: createTransactionPayload.toToken.token_network.ticker_exolix,
        amount: createTransactionPayload.amount,
        withdrawalAddress: createTransactionPayload.recipient_address,
        refundAddress: createTransactionPayload.refund_address || '',
        rateType: 'float',
      };

      const { data } = await firstValueFrom(
        this.httpService.post(
          `${AFFILIATE_DATA.EXOLIX.baseUrl}${AFFILIATE_DATA.EXOLIX.endpoints.getTransactions}`,
          payload,
          {
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Authorization: AFFILIATE_DATA.EXOLIX.apiKey,
            },
          },
        ),
      );

      return {
        isError: false,
        txId: data.id,
        error: null,
        payinAddress: data.depositAddress,
        payoutAddress: data.withdrawalAddress,
        refundAddress: data.refundAddress || null,
        fromCurrency: data.coinFrom.coinCode,
        toCurrency: data.coinTo.coinCode,
        amount: data.amount,
        amountToReceiver: data.amountTo,
        status: data.status,
        payinHash: data.hashIn.hash,
        payoutHash: data.hashOut.hash,
        fromNetwork: '',
        toNetwork: '',
      };
    } catch (error) {
      return {
        isError: true,
        error: error.message,
        txId: null,
        payinAddress: null,
        payoutAddress: null,
        status: 'failed',
        fromCurrency: createTransactionPayload.fromToken.ticker_exolix,
        toCurrency: createTransactionPayload.toToken.ticker_exolix,
        amount: Number(createTransactionPayload.amount),
        refundAddress: createTransactionPayload.refund_address || null,
        payinHash: null,
        payoutHash: null,
        fromNetwork: '',
        toNetwork: '',
      };
    }
  }

  private transformExolixData(exolixTokens: any[]): ProviderToken[] {
    const transformedTokens: ProviderToken[] = [];

    for (const token of exolixTokens) {
      if (!token.networks || token.networks.length === 0) continue;

      for (const network of token.networks) {
        transformedTokens.push({
          symbol: token.code,
          network: network.network,
          isActive: true,
          name: token.name,
          iconUrl: token.icon,
        });
      }
    }

    return transformedTokens;
  }
}
