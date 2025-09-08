import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DEV, GLOBAL_PREFIX } from 'utils/constants';
// import { ThrottlerModule } from '@nestjs/throttler';
import { VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const options = new DocumentBuilder()
    .setTitle('Nexar API')
    .setDescription('Nexar API description')
    .setVersion('1.0')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-api-key',
        in: 'header',
        description: 'Enter your API key',
      },
      'x-api-key',
    )
    .addServer('http://localhost:4040/', 'Local environment')
    .addServer('https://staging.yourapi.com/', 'Staging')
    .addServer('https://production.yourapi.com/', 'Production')
    .build();

  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.enableVersioning({
    type: VersioningType.URI,
  });
  app.enableCors({
    origin: '*',
    methods: 'GET,POST,PUT,DELETE',
    allowedHeaders: 'Content-Type, Authorization, x-api-key',
  });

  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
