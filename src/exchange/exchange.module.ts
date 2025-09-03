import { Module } from '@nestjs/common';
import { ExchangeService } from './exchange.service';
import { ProvidersModule } from 'src/providers/providers.module';
import { TokensModule } from 'src/tokens/tokens.module';
import { ExolixProvider } from 'src/providers/exolix.provider';
import { ChangeNowProvider } from 'src/providers/changeNow.provider';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [ProvidersModule, TokensModule, HttpModule],
  providers: [ExchangeService, ExolixProvider, ChangeNowProvider],
  exports: [ExchangeService],
})
export class ExchangeModule {}
