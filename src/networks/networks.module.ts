import { Module } from '@nestjs/common';
import { NetworkDiscoveryService } from './network-discovery.service';
import { ProvidersModule } from 'src/providers/providers.module';

@Module({
  imports: [ProvidersModule],
  providers: [NetworkDiscoveryService],
})
export class NetworksModule {}
