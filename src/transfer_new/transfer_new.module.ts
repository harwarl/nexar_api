import { Module } from '@nestjs/common';
import { TransferNewService } from './transfer_new.service';
import { TransferNewController } from './transfer_new.controller';
import { DatabaseModule } from 'src/database/database.module';
import { ConfigModule } from '@nestjs/config';
import { AcrossService } from './across.service';
import { transferProviders } from './schema/transfer.provider';

@Module({
  imports: [DatabaseModule, ConfigModule],
  controllers: [TransferNewController],
  providers: [TransferNewService, ...transferProviders, AcrossService],
})
export class TransferNewModule {}
