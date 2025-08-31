import { Module } from '@nestjs/common';
import { TokensService } from './tokens.service';
import { NetworkDiscoveryService } from 'src/networks/network-discovery.service';
import { HttpModule } from '@nestjs/axios';
import { ProvidersModule } from 'src/providers/providers.module';

@Module({
  imports: [HttpModule, ProvidersModule],
  providers: [TokensService, NetworkDiscoveryService],
  exports: [TokensService, NetworkDiscoveryService],
})
export class TokensModule {}
