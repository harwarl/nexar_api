import { HttpService } from '@nestjs/axios';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { API_KEY, BASE_URL, TOKENS_PATH } from '../../utils/constants';
import { lastValueFrom } from 'rxjs';
import { CreateTransactionDto } from './dto/createTransaction.dto';
import { Transaction } from './types/transaction.interface';
import { Model } from 'mongoose';

@Injectable()
export class SwapServiceV1 {
  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    @Inject('TRANSACTION_MODEL') private transactionModel: Model<Transaction>,
  ) {}

  async getTokens() {
    const url = `${this.configService.get(BASE_URL)}${TOKENS_PATH}`;
    const tokens = await this.makeHttpRequest(url);

    return tokens
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
      .filter((name: string | null) => name !== null);
  }

  async getMinimalAmount(from: string, to: string) {
    const url = `${this.configService.get(BASE_URL)}min-amount/${from}_${to}?api_key=${this.configService.get<string>(API_KEY)}`;
    return this.makeHttpRequest(url);
  }

  async getEstimatedExchangeAmount(amount: number, from: string, to: string) {
    const url = `${this.configService.get(BASE_URL)}exchange-amount/${amount}/${from}_${to}?api_key=${this.configService.get<string>(API_KEY)}`;
    return this.makeHttpRequest(url);
  }

  async getTransactionFromId(transactionId: string) {
    const transactionExists = await this.transactionModel.findOne({
      txId: transactionId,
    });

    if (transactionExists) {
      if (transactionExists.isTransfer) {
        return transactionExists;
      } else {
        const url = `${this.configService.get(BASE_URL)}transactions/${transactionId}/${this.configService.get<string>(API_KEY)}`;
        const tx = await this.makeHttpRequest(url);
        if (tx.status === 'finished') {
          const tx_exists = await this.transactionModel.findOne({
            txId: tx.id,
          });

          const value = await this.getEstimatedExchangeAmount(
            tx.amountSend,
            tx.fromCurrency,
            'usdtmatic',
          );

          const updateData = {
            ...tx,
            txId: tx.id,
            volumeInUsdt: value.estimatedAmount,
          };

          if (!tx_exists) {
            await this.transactionModel.create({
              ...updateData,
              inApp: false,
            });
          } else {
            await this.transactionModel.updateOne(
              { txId: tx.id },
              {
                ...updateData,
                inApp: tx_exists.inApp === true,
              },
            );
          }
        }
        return tx;
      }
    }
  }

  async createTransaction(
    createTransactionPayload: CreateTransactionDto,
    identifier: string,
  ) {
    const url = `${this.configService.get(BASE_URL)}transactions/${this.configService.get<string>(API_KEY)}`;
    const tx = await this.makeHttpRequest(url, false, createTransactionPayload);

    await this.transactionModel.create({
      ...tx,
      isTransfer: false,
      inApp: true,
      txId: tx.id,
      volumeInUsdt: 0,
      identifier,
    });

    return tx;
  }

  async getAllTransactionsUsingIdentifier(identifier: string) {
    const txns = await this.transactionModel.find({ identifier });

    return txns;
  }

  async isInAppTx(transactionId: string, address: string) {
    const existingTx = await this.transactionModel.findOne({
      txId: transactionId,
      payinAddress: address.toLowerCase(),
      inApp: true,
    });

    return {
      error: {
        code: 0,
        message: 'Success',
      },
      data: {
        result: !!existingTx,
      },
    };
  }

  async makeHttpRequest(url: string, get = true, data = {}) {
    try {
      let response;
      if (get) {
        response = await lastValueFrom(this.httpService.get(url));
      } else {
        response = await lastValueFrom(this.httpService.post(url, data));
      }

      return response.data;
    } catch (error) {
      if (error.response) {
        throw new HttpException(
          error.response.data,
          error.response.status || 500,
        );
      }
      throw new HttpException('Internal Server Error', 500);
    }
  }
}
