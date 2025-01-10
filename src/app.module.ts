import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SwapModule } from './swap/swap.module';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { ENV_FILE_PATH } from 'utils/constants';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        BASE_URL: Joi.string().required(),
        API_KEY: Joi.string().required(),
      }),
      envFilePath: ENV_FILE_PATH,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 2 * 60000,
        limit: 20,
      },
    ]),
    SwapModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
