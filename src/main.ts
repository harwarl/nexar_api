import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DEV, GLOBAL_PREFIX } from 'utils/constants';
import { ThrottlerModule } from '@nestjs/throttler';
import { VersioningType } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // const NODE_ENV = process.env.NODE_ENV || DEV;
  // const FRONT_URL = process.env.FRONT_URL;

  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.enableVersioning({
    type: VersioningType.URI,
  });
  app.enableCors({
    // origin: NODE_ENV === DEV ? '*' : FRONT_URL,
    origin: '*',
    methods: 'GET,POST,PUT,DELETE',
    allowedHeaders: 'Content-Type, Authorization',
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
