import { Module } from '@nestjs/common';
import { SwapServiceV1 } from './swap.service';
import { SwapControllerV1 } from './swap.controller';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from 'src/database/database.module';
import { transactionsProviders } from './schema/transaction.provider';

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
    ConfigModule,
    DatabaseModule,
  ],
  controllers: [SwapControllerV1],
  providers: [SwapServiceV1, ...transactionsProviders],
})
export class SwapModule {}
