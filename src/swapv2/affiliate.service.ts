import { HttpService } from '@nestjs/axios';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { Transaction } from './types/transaction.interface';

@Injectable()
export class AffiliateService {
  // The goal of this service is to handle all Api calls to the partners privix is affiliateed with.
  // This includes:
  // 1. Fetching affiliate links for a given token
  // 2. Making api calls to the affiliate partners to track swaps
  // 3. Handling any other affiliate related logic

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    @Inject('TRANSACTION_MODEL_V2')
    private transactionModel: Model<Transaction>,
  ) {}

  // private functions
}
