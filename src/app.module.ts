import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SwapModule } from './swap/swap.module';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { ENV_FILE_PATH } from 'utils/constants';
// import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
// import { APP_GUARD } from '@nestjs/core';
import { TransferModule } from './transfer/transfer.module';
import { KeysModule } from './keys/keys.module';
import { KeysService } from './keys/keys.service';
import { ApiKeyMiddleware } from './middleware/key.middleware';
import { TransferNewModule } from './transfer_new/transfer_new.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        BASE_URL: Joi.string().required(),
        API_KEY: Joi.string().required(),
        ETH_RPC: Joi.string().required(),
        ES_API_KEY: Joi.string().required(),
        ETH_API_URL: Joi.string().required(),
        MASTER_KEY: Joi.string().required(),
      }),
      envFilePath: ENV_FILE_PATH,
    }),
    SwapModule,
    TransferModule,
    KeysModule,
    TransferNewModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    KeysService,
    // {
    //   provide: APP_GUARD,
    //   useClass: ThrottlerGuard,
    // },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ApiKeyMiddleware).forRoutes('*');
  }
}
