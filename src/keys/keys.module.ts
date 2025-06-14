import { Module } from '@nestjs/common';
import { KeysService } from './keys.service';
import { KeysController } from './keys.controller';
// import { DatabaseModule } from 'src/database/database.module';
// import { keysProviders } from './schema/keys.provider';

@Module({
  controllers: [KeysController],
  providers: [KeysService],
})
export class KeysModule {}
