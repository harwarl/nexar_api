import { Module } from '@nestjs/common';
import { ExchangeService } from './exchange.service';
import { ProvidersModule } from 'src/providers/providers.module';
import { TokensModule } from 'src/tokens/tokens.module';

@Module({
  imports: [ProvidersModule, TokensModule],
  providers: [ExchangeService],
})
export class ExchangeModule {}
