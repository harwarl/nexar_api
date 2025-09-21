import { Module } from '@nestjs/common';
import { ProvidersService } from './providers.service';
import { ExolixProvider } from './exolix.provider';
import { ChangeNowProvider } from './changenow.provider';
import { FixedFloatProvider } from './fixedfloat.provider';
import { HttpModule } from '@nestjs/axios';
import { CoingeckoProvider } from './coingecko.provider';

@Module({
  imports: [HttpModule],
  providers: [
    ProvidersService,
    ExolixProvider,
    ChangeNowProvider,
    FixedFloatProvider,
    CoingeckoProvider,
  ],
  exports: [ProvidersService, CoingeckoProvider],
})
export class ProvidersModule {}
