import { Module } from '@nestjs/common';
import { Swapv2Service } from './swapv2.service';
import { Swapv2Controller } from './swapv2.controller';
import { transactionProvidersV2 } from './schema/transaction.provider';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from 'src/database/database.module';
import { TokensModule } from 'src/tokens/tokens.module';
import { ExchangeModule } from 'src/exchange/exchange.module';

@Module({
  imports: [
    HttpModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        timeout: configService.get('HTTP_TIMEOUT'),
        maxRedirects: configService.get('HTTP_MAX_REDIRECTS'),
      }),
      inject: [ConfigService],
    }),
    DatabaseModule,
    TokensModule,
    ExchangeModule,
  ],
  controllers: [Swapv2Controller],
  providers: [Swapv2Service, ...transactionProvidersV2],
})
export class Swapv2Module {}
