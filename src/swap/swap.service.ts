import { HttpService } from '@nestjs/axios';
import { HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { API_KEY, BASE_URL, TOKENS_PATH } from '../../utils/constants';
import { lastValueFrom } from 'rxjs';
import { CreateTransactionDto } from './dto/createTransaction.dto';

@Injectable()
export class SwapServiceV1 {
  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
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
          token.name.includes('Avalanche') ||
          token.name === 'Bitcoin' ||
          token.name === 'Solana' ||
          token.name === 'Ethereum'
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
    const url = `${this.configService.get(BASE_URL)}transactions/${transactionId}/${this.configService.get<string>(API_KEY)}`;
    return this.makeHttpRequest(url);
  }

  async createTransaction(createTransactionPayload: CreateTransactionDto) {
    const url = `${this.configService.get(BASE_URL)}transactions/${this.configService.get<string>(API_KEY)}`;
    return this.makeHttpRequest(url, false, createTransactionPayload);
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
