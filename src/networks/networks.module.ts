import { Module } from '@nestjs/common';
import { NetworkDiscoveryService } from './network-discovery.service';
import { ProvidersService } from 'src/providers/providers.service';

@Module({
  providers: [NetworkDiscoveryService, ProvidersService],
})
export class NetworksModule {}
