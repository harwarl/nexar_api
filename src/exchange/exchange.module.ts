import { Module } from '@nestjs/common';
import { ExchangeService } from './exchange.service';
import { ProvidersModule } from 'src/providers/providers.module';
import { TokensModule } from 'src/tokens/tokens.module';
import { ExolixProvider } from 'src/providers/exolix.provider';
import { ChangeNowProvider } from 'src/providers/changenow.provider';
import { HttpModule } from '@nestjs/axios';
import { DatabaseModule } from 'src/database/database.module';
import { QuoteProvider } from 'src/swapv2/schema/quote/quote.provider';
import { TransactionProvidersV2 } from 'src/swapv2/schema/transaction/transaction.provider';
import { SimpleSwapProvider } from 'src/providers/simpleswap.provider';
import { SwapuzProvider } from 'src/providers/swapuz.provider';

@Module({
  imports: [ProvidersModule, TokensModule, HttpModule, DatabaseModule],
  providers: [
    ExchangeService,
    ExolixProvider,
    ChangeNowProvider,
    SimpleSwapProvider,
    SwapuzProvider, // TODO: add more providers in here
    ...QuoteProvider,
    ...TransactionProvidersV2,
  ],
  exports: [ExchangeService],
})
export class ExchangeModule {}
