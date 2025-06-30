import { Module } from '@nestjs/common';
import { TransferNewService } from './transfer_new.service';
import { TransferNewController } from './transfer_new.controller';

@Module({
  controllers: [TransferNewController],
  providers: [TransferNewService],
})
export class TransferNewModule {}
