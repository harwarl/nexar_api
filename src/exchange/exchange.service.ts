import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { CoingeckoProvider } from 'src/providers/coingecko.provider';
import { TokensService } from 'src/tokens/tokens.service';
import {
  ExchangeQuote,
  ExchangeRequest,
  ExchangeResponse,
  ExchangeResponseInit,
} from './exchange.interface';
import { TokenResponse } from 'src/tokens/tokens.interface';
import { AFFILIATES } from 'src/providers/provider.data';
import { ChangeNowProvider } from 'src/providers/changeNow.provider';
import { ExolixProvider } from 'src/providers/exolix.provider';
import {
  FetchQuoteResponse,
  QuoteData,
  TransactionResponse,
} from 'src/providers/provider.interface';
import { StartSwapDto } from 'src/swapv2/dto/startSwap.dto';
import { Model } from 'mongoose';
import {
  CreateTransactionPayload,
  TransactionExchange,
} from 'src/swapv2/types/transaction';
import { Quote } from 'src/swapv2/types/quote';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface ProviderSupport {
  provider: string;
  isSupported: boolean;
  ticker: string | null;
}

@Injectable()
export class ExchangeService {
  // Map of exchange requests
  private exchangeRequests: Map<string, ExchangeResponse> = new Map();

  constructor(
    private readonly tokensService: TokensService,
    private readonly coingeckoProvider: CoingeckoProvider,
    private readonly exolixProvider: ExolixProvider,
    private readonly changeNowProvider: ChangeNowProvider,
    @Inject('QUOTE_MODEL') private quoteModel: Model<Quote>,
    @Inject('TRANSACTION_MODEL_V2')
    private transactionModelV2: Model<TransactionExchange>,
  ) {}

  // Start swap
  async startSwap(startSwap: StartSwapDto) {
    // Check for uuid_request, recipient_address, selected_provider, selected_quote_uid
    if (
      !startSwap.uuid_request ||
      !startSwap.recipient_address ||
      !startSwap.selected_provider ||
      !startSwap.selected_quote_uid
    ) {
      throw new BadRequestException('Missing required fields');
    }

    // check if the exchange request exists
    const exchangeRequest = this.exchangeRequests.get(startSwap.uuid_request);

    if (!exchangeRequest) {
      throw new BadRequestException(
        `Could not found the exchange with uuid ${startSwap.uuid_request}`,
      );
    }

    // Update the exchange request
    const updatedExchangeRequest: ExchangeResponse = {
      ...exchangeRequest,
      verified_txn: true,
      recipient_address: startSwap.recipient_address,
      selected_provider: startSwap.selected_provider,
      selected_quote_uid: startSwap.selected_quote_uid,
      refund_address: startSwap.refund_address || null,
      updated_at: new Date().toISOString(),
    };

    // Update the exchange request in the map
    this.exchangeRequests.set(startSwap.uuid_request, updatedExchangeRequest);

    // Start the transaction with the selected QuoteId
    // FIrst get the selected Quote
    const selectedQuote = updatedExchangeRequest.quotes.find(
      (quote: ExchangeQuote) => quote.uid === startSwap.selected_quote_uid,
    );

    if (!selectedQuote) {
      throw new BadRequestException('Selected quote not found');
    }

    if (selectedQuote.provider !== startSwap.selected_provider) {
      throw new BadRequestException(
        'Selected provider does not match the quote provider',
      );
    }

    // Get the transaction Details from the provider and in it includes the transactionId
    const exchangeTransactionDetails: TransactionResponse =
      await this.getExchangeDetails(selectedQuote, updatedExchangeRequest);

    if (exchangeTransactionDetails.isError === true) {
      throw new BadRequestException(exchangeTransactionDetails.error);
    }

    // I actually do not need the quote Id anymore
    // //Save the quote to the quote DB
    const quote = new this.quoteModel({
      uuid_request: updatedExchangeRequest.uuid_request,
      uid: selectedQuote.uid,
      provider: selectedQuote.provider,
      from_currency: updatedExchangeRequest.from_currency,
      to_currency: updatedExchangeRequest.to_currency,
      from_network: updatedExchangeRequest.from_network,
      to_network: updatedExchangeRequest.to_network,
      from_amount: updatedExchangeRequest.from_amount,
      to_amount: updatedExchangeRequest.to_amount,
      exchange_rate: selectedQuote.exchange_rate,
      created_at: new Date(selectedQuote.created_at),
      amount_to_usdt: selectedQuote.estimated_amount_to_usdt,
      amount_from_usdt: selectedQuote.estimated_amount_from_usdt,
      minAmount: selectedQuote.minAmount,
      maxAmount: selectedQuote.maxAmount,
    });

    // Save the selected quote to the database in here with ExchnageQuoteWithTxId type
    const savedQuote = await quote.save();

    // Save the entire Transaction to the transaction DB
    // Save the exchange request to the database  in here
    // Saving the exchange request to the database
    const transaction = new this.transactionModelV2({
      uuid_request: updatedExchangeRequest.uuid_request,
      status: this.generalizeStatus(updatedExchangeRequest.status),
      from_currency: updatedExchangeRequest.from_currency,
      to_currency: updatedExchangeRequest.to_currency,
      from_network: updatedExchangeRequest.from_network,
      to_network: updatedExchangeRequest.to_network,
      from_amount: updatedExchangeRequest.from_amount,
      to_amount: updatedExchangeRequest.to_amount,
      direction: updatedExchangeRequest.direction,
      recipient_address: updatedExchangeRequest.recipient_address,
      selected_provider: updatedExchangeRequest.selected_provider,
      selected_quote_uid: updatedExchangeRequest.selected_quote_uid,
      exchange_rate: updatedExchangeRequest.bestQuote.exchange_rate,
      tx_id: exchangeTransactionDetails?.txId,
      amount: exchangeTransactionDetails?.amount,
      amount_to_receiver: exchangeTransactionDetails?.amountToReceiver,
      refund_address: exchangeTransactionDetails?.refundAddress,
      payinHash: exchangeTransactionDetails?.payinHash,
      payoutHash: exchangeTransactionDetails?.payoutHash,
      quote_db_id: savedQuote.id,
      payin_address: exchangeTransactionDetails.payinAddress,
      payout_address: exchangeTransactionDetails.payoutAddress,
    });

    await transaction.save();
    // Delete the exchange request in memory using cron job, only leave those within 12 hours below the current date

    // return the payment info back to the user.
    return {
      success: true,
      uuid_request: startSwap.uuid_request,
      from_currency: updatedExchangeRequest.from_currency,
      to_currency: updatedExchangeRequest.to_currency,
      from_network: updatedExchangeRequest.from_network,
      to_network: updatedExchangeRequest.to_network,
      from_amount: updatedExchangeRequest.from_amount,
      to_amount: updatedExchangeRequest.to_amount,
      recipient_address: updatedExchangeRequest.recipient_address,
      selected_provider: updatedExchangeRequest.selected_provider,
      selected_quote_uid: updatedExchangeRequest.selected_quote_uid,
      payin_address: exchangeTransactionDetails.payinAddress,
      payout_address: exchangeTransactionDetails.payoutAddress,
    };
  }

  // Calculates the exchnage rates
  async getExchangeRate(
    request: ExchangeRequest,
  ): Promise<ExchangeResponse | ExchangeResponseInit> {
    if (request.init === false) {
      // Get the exchange response and pad with more information
      // Get the data from the exchange requests
      // Check if the exchange request already exists
      const exchangeResponse = this.exchangeRequests.get(request.uuid_request);
      if (!exchangeResponse) {
        throw new BadRequestException(
          `Could not found the exchange with uuid ${request.uuid_request}`,
        );
      }

      return {
        ...exchangeResponse,
        from_amount_usdt: null,
        to_amount_usdt: null,
        updated_at: new Date().toISOString(),
        recipient_address: null,
        selected_provider: null,
        selected_quote_uid: null,
      };
    }

    // Check if the exchange request already exists
    if (this.exchangeRequests.has(request.uuid_request)) {
      return this.exchangeRequests.get(request.uuid_request);
    }

    // ValidateCurrencies and get Rates
    const currencyValidated = await this.validateCurrencies(
      request.from_currency,
      request.to_currency,
      request.from_network,
      request.to_network,
    );

    if (currencyValidated?.error === true) {
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

    const exchangeResponse = {
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
      quotes: providerQuotes.quotes,
      bestQuote,
      uuid_request: request.uuid_request,
      errors: providerQuotes.error,
    };

    this.exchangeRequests.set(request.uuid_request, {
      ...exchangeResponse,
      from_token_obj: currencyValidated.fromTokenObj,
      to_token_obj: currencyValidated.toTokenObj,
    });

    return exchangeResponse;
  }

  // Get the exchange details from the provider
  private async getExchangeDetails(
    quote: ExchangeQuote,
    exchangeRequest: ExchangeResponse,
  ): Promise<TransactionResponse | null> {
    if (!quote || !exchangeRequest) return null;

    let exchangeDetails: TransactionResponse;
    const createTransactionPayload: CreateTransactionPayload = {
      amount: exchangeRequest.from_amount,
      recipient_address: exchangeRequest.recipient_address,
      refund_address: exchangeRequest.refund_address ?? null,
      fromToken: exchangeRequest.from_token_obj,
      toToken: exchangeRequest.to_token_obj,
    };

    // Switch through the providers
    switch (quote.provider) {
      case AFFILIATES.CHANGENOW:
        exchangeDetails = await this.changeNowProvider.createTransaction(
          createTransactionPayload,
        );
        break;

      case AFFILIATES.EXOLIX:
        exchangeDetails = await this.exolixProvider.createTransaction(
          createTransactionPayload,
        );
        break;

      // TODO: add other exchange providers in here

      default:
        exchangeDetails = null;
        break;
    }

    return exchangeDetails;
  }

  // Delete old exchange Requests to free up the memory using cron job every 2 hours
  @Cron(CronExpression.EVERY_2_HOURS) // Runs every 2 hours
  async deleteOldExchangeRequests() {
    const now = Date.now();
    const twelveHoursAgo = now - 12 * 60 * 60 * 1000;

    for (const [uuid, request] of this.exchangeRequests) {
      const requestTime = new Date(request.created_at).getTime();
      if (requestTime < twelveHoursAgo) {
        this.exchangeRequests.delete(uuid);
      }
    }
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
    fromTokenObj?: TokenResponse;
    toTokenObj?: TokenResponse;
  }> {
    // Checks if currencies exists on specified networks

    // Check if the from token exists
    const fromTokenExists = this.getTokenFromTokens(fromCurrency, fromNetwork);

    // Check if the to token exists
    const toTokenExists = this.getTokenFromTokens(toCurrency, toNetwork);

    if (!fromTokenExists || !toTokenExists) {
      return {
        error: true,
        message: 'Invalid currency or network combination',
      };
    }

    return {
      error: false,
      message: '',
      fromTokenObj: fromTokenExists,
      toTokenObj: toTokenExists,
    };
  }

  // Get Transaction using UUID
  async getTransaction(uuid_request: string) {
    const transaction = await this.transactionModelV2.findOne({
      uuid_request: uuid_request,
    });

    console.log({ transaction });

    if (!transaction) {
      throw new BadRequestException('Transaction not found');
    }

    // Get the provider and the tx_id from the transaction object
    const provider = transaction.selected_provider;
    const tx_id = transaction.tx_id;

    if (!provider || !tx_id) {
      throw new BadRequestException('Provider or transaction ID not found');
    }

    let transactionStatus: any;
    // Get the transaction status from the provider

    transactionStatus = await this.getTransactionStatusFromProvider(
      provider,
      tx_id,
    );

    // Update the transaction if there are any differences in what is coming from the provider and what is in the database
    if (transactionStatus && transactionStatus.status !== transaction.status) {
      console.log({
        transactionStatus: transactionStatus.status,
        generalized: this.generalizeStatus(transactionStatus.status),
      });

      transaction.status = this.generalizeStatus(transactionStatus.status);
      transaction.payin_hash = transactionStatus?.payinHash ?? '';
      transaction.payout_hash = transactionStatus?.payoutHash ?? '';
      transaction.amount = transactionStatus?.amount ?? transaction.amount;
      transaction.amount_to_receiver =
        transactionStatus.amount_to_receiver ?? transaction.amount_to_receiver;

      // Update the transaction in the database
      await transaction.save();
    }

    const transaction_obj = transaction.toObject();
    delete transaction_obj._id;
    delete transaction_obj.__v;
    delete transaction_obj.selected_quote_uid;
    delete transaction_obj.tx_id;
    delete transaction_obj.quote_db_id;

    // Return the transaction_obj in the database
    return transaction_obj;
  }

  // Get the transaction details from the provider using the tx_id
  private async getTransactionStatusFromProvider(
    providerName: string,
    txId: string,
  ): Promise<TransactionResponse | null> {
    // Get the transaction from the provider
    let transaction: TransactionResponse;

    switch (providerName) {
      case AFFILIATES.CHANGENOW:
        transaction =
          await this.changeNowProvider.fetchTransactionByTransactionId(txId);
        break;

      case AFFILIATES.EXOLIX:
        transaction =
          await this.exolixProvider.fetchTransactionByTransactionId(txId);
        break;

      default:
        return null;
    }

    return transaction;
  }

  // get the provider quotes
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

    return {
      uid: this.generateUid(),
      provider: providerName,
      estimated_amount_to: estimatedAmountTo.toString(),
      estimated_amount_from: estimatedAmountFrom.toString(),
      estimated_amount_to_usdt: estimatedAmountToUsdt.toString(),
      estimated_amount_from_usdt: estimatedAmountFromUsdt.toString(),
      exchange_rate: exchangeRate.toString(),
      created_at: new Date().toISOString(),
      // fee: 0,
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

  private getFee(quote: ExchangeQuote) {}

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

  // Generalized the status across providers
  // Using general statuses: PENDING, CONFIRMING, EXCHANGING, COMPLETED, FAILED, REFUNDED
  private generalizeStatus(status: string): string {
    const statusMap: Record<string, string> = {
      new: 'PENDING',
      waiting: 'PENDING',
      confirming: 'CONFIRMING',
      exchanging: 'EXCHANGING',
      sending: 'EXCHANGING',
      verifying: 'CONFIRMING',
      finished: 'COMPLETED',
      failed: 'FAILED',
      refunded: 'REFUNDED',
      wait: 'PENDING',
      confirmation: 'CONFIRMING',
      confirmed: 'CONFIRMING',
      success: 'COMPLETED',
      overdue: 'FAILED',
    };

    return statusMap[status.toLowerCase()] || 'PENDING';
  }
}
