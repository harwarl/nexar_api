import { Module } from '@nestjs/common';
import { TransferService } from './transfer.service';
import { TransferController } from './transfer.controller';
import { DatabaseModule } from 'src/database/database.module';
import { transactionsProviders } from 'src/swap/schema/transaction.provider';
import { ConfigModule } from '@nestjs/config';
import { WormholeService } from './wormhole.service';

@Module({
  imports: [DatabaseModule, ConfigModule],
  controllers: [TransferController],
  providers: [TransferService, WormholeService, ...transactionsProviders],
})
export class TransferModule {}
