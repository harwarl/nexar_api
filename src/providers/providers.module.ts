import { Module } from '@nestjs/common';
import { ProvidersService } from './providers.service';
import { ExolixProvider } from './exolix.provider';
import { ChangeNowProvider } from './changeNow.provider';
import { FixedFloatProvider } from './fixedfloat.provider';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  providers: [
    ProvidersService,
    ExolixProvider,
    ChangeNowProvider,
    FixedFloatProvider,
  ],
  exports: [
    ProvidersService,
    ExolixProvider,
    ChangeNowProvider,
    FixedFloatProvider,
  ],
})
export class ProvidersModule {}
